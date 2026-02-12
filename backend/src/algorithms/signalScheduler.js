// Signal Scheduler — Backend-only signal state management
// Dynamic green window based on criticality and ambulance position
const TrafficSignal = require('../models/TrafficSignal');
const { getDistanceInMeters, getSignalClearanceThreshold } = require('./emergencyCostEngine');

/**
 * Schedule green window for signals along a corridor route
 * @param {string} corridorId
 * @param {Array<[number,number]>} routeWaypoints - [lat, lng] array
 * @param {string} criticality - STABLE | CRITICAL | VERY_CRITICAL
 * @param {[number,number]} ambulancePosition - [lat, lng]
 * @returns {Array<{ signalId, name, state, distance }>} updated signal states
 */
const scheduleSignals = async (corridorId, routeWaypoints, criticality, ambulancePosition) => {
    const clearanceThreshold = getSignalClearanceThreshold(criticality);

    // Green window duration based on criticality (seconds)
    const greenWindowDuration = {
        'STABLE': 30,
        'CRITICAL': 60,
        'VERY_CRITICAL': 120
    }[criticality] || 60;

    // Find signals near route
    const lats = routeWaypoints.map(p => p[0]);
    const lngs = routeWaypoints.map(p => p[1]);
    const bbox = [Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs)];

    const signals = await TrafficSignal.find({
        isOperational: true,
        location: {
            $geoWithin: {
                $box: [
                    [bbox[1] - 0.005, bbox[0] - 0.005],
                    [bbox[3] + 0.005, bbox[2] + 0.005]
                ]
            }
        }
    });

    const results = [];

    for (const signal of signals) {
        const signalPos = [signal.location.coordinates[1], signal.location.coordinates[0]];
        const distanceToAmbulance = getDistanceInMeters(
            ambulancePosition[0], ambulancePosition[1],
            signalPos[0], signalPos[1]
        );

        // Check if signal is within clearance range
        if (distanceToAmbulance <= clearanceThreshold && signal.currentState === 'RED') {
            signal.currentState = 'GREEN';
            signal.overriddenBy = {
                corridorId,
                overriddenAt: new Date(),
                originalState: 'RED'
            };

            // Schedule restore after green window
            signal.scheduledRestore = new Date(Date.now() + greenWindowDuration * 1000);
            await signal.save();
        }

        results.push({
            signalId: signal.signalId,
            name: signal.name,
            state: signal.currentState,
            distance: Math.round(distanceToAmbulance),
            withinRange: distanceToAmbulance <= clearanceThreshold
        });
    }

    return results;
};

/**
 * Restore overridden signals whose green window has expired
 */
const restoreExpiredSignals = async () => {
    const now = new Date();
    const expiredSignals = await TrafficSignal.find({
        'overriddenBy.corridorId': { $exists: true },
        scheduledRestore: { $lte: now },
        currentState: 'GREEN'
    });

    for (const signal of expiredSignals) {
        signal.currentState = signal.overriddenBy?.originalState || 'RED';
        signal.overriddenBy = undefined;
        signal.scheduledRestore = undefined;
        await signal.save();
    }

    return expiredSignals.length;
};

module.exports = { scheduleSignals, restoreExpiredSignals };
