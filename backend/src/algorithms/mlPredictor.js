// ML Predictor - wraps federated learning model for predictions
const FederatedModel = require('../models/FederatedModel');
const { getTimeBucket } = require('./routeOptimizer');

const getPredictionBias = async () => {
    const model = await FederatedModel.findOne({ isActive: true });
    if (!model) return { morning: 0, afternoon: 0, night: 0 };
    return model.biases;
};

const getCurrentBias = async () => {
    const biases = await getPredictionBias();
    const bucket = getTimeBucket();
    return biases[bucket] || 0;
};

module.exports = { getPredictionBias, getCurrentBias };
