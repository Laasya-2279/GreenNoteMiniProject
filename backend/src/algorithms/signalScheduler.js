// Signal Scheduler - schedule signal changes for corridor passage
const TrafficSignal = require('../models/TrafficSignal');
const { getDistanceInMeters } = require('./routeOptimizer');

const scheduleSignalClearance = async (corridorId, waypoints, signals, urgencyLevel) => {
    const AMBULANCE_SPEED = 12; // m/s
    const schedule = [];

    for (const signal of signals) {
        // Calculate when ambulance will reach this signal
        let distanceToSignal = 0;
        const signalPos = signal.position || [signal.location?.coordinates?.[1], signal.location?.coordinates?.[0]];

        for (let i = 0; i < waypoints.length - 1; i++) {
            const segDist = getDistanceInMeters(waypoints[i][0], waypoints[i][1], waypoints[i + 1][0], waypoints[i + 1][1]);
            const distToSig = getDistanceInMeters(waypoints[i][0], waypoints[i][1], signalPos[0], signalPos[1]);

            if (distToSig < 100) {
                distanceToSignal += distToSig;
                break;
            }
            distanceToSignal += segDist;
        }

        const timeToReach = distanceToSignal / AMBULANCE_SPEED;
        const clearanceBefore = { 'STABLE': 15, 'CRITICAL': 30, 'VERY_CRITICAL': 60 }[urgencyLevel] || 30;

        schedule.push({
            signalId: signal.signalId || signal.id,
            clearAt: Math.max(0, timeToReach - clearanceBefore),
            restoreAt: timeToReach + 30
        });
    }

    return schedule.sort((a, b) => a.clearAt - b.clearAt);
};

module.exports = { scheduleSignalClearance };
