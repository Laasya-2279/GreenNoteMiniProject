// ML Predictor — Congestion prediction for Emergency Cost Engine
// Uses federated learning model biases + GPS log analysis
const GPSLog = require('../models/GPSLog');
const FederatedModel = require('../models/FederatedModel');
const GreenCorridor = require('../models/GreenCorridor');
const AuditLog = require('../models/AuditLog');

/**
 * Get time bucket for federated model
 */
function getTimeBucket(date) {
    const hour = (date || new Date()).getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'night';
}

/**
 * Predict congestion level along a route
 * @param {Array<[number,number]>} waypoints
 * @returns {string} LOW | MEDIUM | HIGH
 */
const predictCongestion = async (waypoints) => {
    try {
        // Analyze recent GPS logs in the route area
        const recentLogs = await GPSLog.find({
            timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
        }).limit(200);

        if (recentLogs.length < 5) return 'LOW';

        // Calculate average speed
        const speeds = recentLogs.filter(l => l.speed > 0).map(l => l.speed);
        if (speeds.length === 0) return 'LOW';

        const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;

        if (avgSpeed < 5) return 'HIGH';
        if (avgSpeed < 8) return 'MEDIUM';
        return 'LOW';
    } catch (error) {
        console.error('[MLPredictor] Congestion prediction error:', error.message);
        return 'LOW';
    }
};

/**
 * Get federated model biases for ETA prediction
 * @returns {{ morning: number, afternoon: number, night: number }}
 */
const getFederatedBias = async () => {
    try {
        const model = await FederatedModel.findOne({ isActive: true });
        return model ? model.biases : { morning: 0, afternoon: 0, night: 0 };
    } catch {
        return { morning: 0, afternoon: 0, night: 0 };
    }
};

/**
 * Update federated model after corridor completion
 * @param {string} corridorId
 */
const updateFederatedModel = async (corridorId) => {
    const corridor = await GreenCorridor.findOne({ corridorId });
    if (!corridor || !corridor.startedAt || !corridor.completedAt) return;

    const actualTime = (corridor.completedAt - corridor.startedAt) / 1000;
    const predictedETA = corridor.predictedETA || actualTime;
    const error = actualTime - predictedETA;

    const timeBucket = getTimeBucket(corridor.startedAt);
    const learningRate = 0.2;

    let model = await FederatedModel.findOne({ isActive: true });
    if (!model) {
        model = await FederatedModel.create({
            version: 1,
            biases: { morning: 0, afternoon: 0, night: 0 },
            samples: { morning: 0, afternoon: 0, night: 0 },
            isActive: true
        });
    }

    // Update bias with weighted learning
    model.biases[timeBucket] += learningRate * error;
    model.samples[timeBucket] += 1;

    // Update accuracy metrics
    model.accuracy.totalPredictions += 1;
    const absError = Math.abs(error);
    const prevMAE = model.accuracy.meanAbsoluteError;
    const n = model.accuracy.totalPredictions;
    model.accuracy.meanAbsoluteError = prevMAE + (absError - prevMAE) / n;
    model.accuracy.meanSquaredError = model.accuracy.meanSquaredError + (error * error - model.accuracy.meanSquaredError) / n;

    await model.save();

    await AuditLog.create({
        action: 'MODEL_UPDATED',
        corridorId,
        details: { timeBucket, error, newBias: model.biases[timeBucket], samples: model.samples[timeBucket] }
    });

    return model;
};

module.exports = { predictCongestion, getFederatedBias, updateFederatedModel, getTimeBucket };
