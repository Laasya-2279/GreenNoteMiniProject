// Movement Engine — Deviation detection + route recalculation
// Handles live ambulance movement, triggers rerouting when off-corridor
const { fetchRoutes } = require('./osrmService');
const { evaluateRoutes, findSignalsOnRoute, shouldClearSignal, getDistanceInMeters } = require('./emergencyCostEngine');
const { calculateLiveETA } = require('./etaCalculator');
const TrafficSignal = require('../models/TrafficSignal');
const GreenCorridor = require('../models/GreenCorridor');
const GPSLog = require('../models/GPSLog');
const Ambulance = require('../models/Ambulance');
const FederatedModel = require('../models/FederatedModel');

const DEVIATION_THRESHOLD = 50; // meters — reroute if ambulance is > 50m from corridor

/**
 * Find the minimum distance from a point to any segment of the route
 * @param {[number, number]} point - [lat, lng]
 * @param {Array<[number, number]>} route - Array of [lat, lng]
 * @returns {number} distance in meters
 */
function distanceToRoute(point, route) {
    let minDist = Infinity;
    for (const wp of route) {
        const d = getDistanceInMeters(point[0], point[1], wp[0], wp[1]);
        if (d < minDist) minDist = d;
    }
    return minDist;
}

/**
 * Check if ambulance has deviated from corridor route
 */
function isDeviated(ambulancePosition, routeWaypoints) {
    if (!routeWaypoints || routeWaypoints.length === 0) return false;
    const dist = distanceToRoute(ambulancePosition, routeWaypoints);
    return dist > DEVIATION_THRESHOLD;
}

/**
 * Get federated model bias for ETA adjustments
 */
async function getFederatedBias() {
    try {
        const model = await FederatedModel.findOne({ isActive: true });
        return model ? model.biases : { morning: 0, afternoon: 0, night: 0 };
    } catch {
        return { morning: 0, afternoon: 0, night: 0 };
    }
}

/**
 * Process a GPS update from an ambulance:
 * 1. Save GPS log
 * 2. Update ambulance position
 * 3. Detect deviation → reroute if needed
 * 4. Calculate REAL ETA (polyline-aware + signal + ML bias)
 * 5. Check signal clearance
 * 6. Return updated corridor state for broadcast
 */
const processGPSUpdate = async ({ corridorId, position, userId, io }) => {
    // 1. Save GPS log (non-blocking error handling)
    try {
        await GPSLog.create({
            corridorId,
            ambulanceId: userId || 'unknown',
            location: {
                type: 'Point',
                coordinates: [position.lng, position.lat]
            },
            accuracy: position.accuracy,
            speed: position.speed,
            heading: position.heading
        });
    } catch (err) {
        console.error('[MovementEngine] GPS log save error:', err.message);
    }

    // 2. Update ambulance position in DB
    if (userId) {
        try {
            await Ambulance.findOneAndUpdate(
                { driverId: userId },
                { currentLocation: { type: 'Point', coordinates: [position.lng, position.lat] } }
            );
        } catch (err) {
            // Non-critical — ambulance doc may not exist yet
        }
    }

    // 3. Get corridor
    const corridor = await GreenCorridor.findOne({ corridorId });
    if (!corridor) {
        return {
            position,
            route: null,
            signals: [],
            eta: null,
            etaFormatted: '--:--',
            criticality: 'CRITICAL',
            rerouted: false,
            demoMode: false,
            clearedSignals: []
        };
    }

    const currentRoute = corridor.selectedRoute?.waypoints || [];
    const criticality = corridor.urgencyLevel || 'CRITICAL';
    let rerouted = false;
    let route = {
        waypoints: currentRoute,
        distance: corridor.selectedRoute?.distance,
        duration: corridor.selectedRoute?.duration
    };
    let signals = [];
    let demoMode = corridor.selectedRoute?.demoMode || false;

    // 4. Deviation detection — reroute if > 50m off corridor
    const ambulancePos = [position.lat, position.lng];

    if (currentRoute.length > 0 && isDeviated(ambulancePos, currentRoute)) {
        console.log(`[MovementEngine] Deviation detected for ${corridorId} — rerouting via OSRM`);

        // Destination = stored destination hospital coordinates or last waypoint
        const destCoords = corridor.destinationHospital?.location?.coordinates;
        const destination = destCoords
            ? { lat: destCoords[1], lng: destCoords[0] }
            : { lat: currentRoute[currentRoute.length - 1][0], lng: currentRoute[currentRoute.length - 1][1] };

        // Fetch new routes from current position via OSRM
        const newRoutes = await fetchRoutes(
            { lat: position.lat, lng: position.lng },
            destination
        );

        // Apply emergency cost engine — picks lowest cost route
        const { bestRoute } = await evaluateRoutes(newRoutes, criticality);

        if (bestRoute) {
            // Persist new route to corridor document
            corridor.selectedRoute = {
                waypoints: bestRoute.waypoints,
                distance: bestRoute.distance,
                duration: bestRoute.duration,
                demoMode: bestRoute.demoMode
            };
            corridor.predictedETA = bestRoute.emergencyCost;
            await corridor.save();

            route = bestRoute;
            signals = bestRoute.signals || [];
            demoMode = bestRoute.demoMode;
            rerouted = true;
        }
    } else {
        // No deviation — find signals on current route
        signals = await findSignalsOnRoute(currentRoute);
    }

    // 5. Calculate PROPER ETA using polyline-based remaining distance
    const federatedBias = await getFederatedBias();
    const etaResult = calculateLiveETA(position, route.waypoints || currentRoute, criticality, signals, federatedBias);

    // Update corridor's predicted ETA
    if (corridor && etaResult.etaSeconds > 0) {
        corridor.predictedETA = etaResult.etaSeconds;
        await corridor.save();
    }

    // 6. Check signal clearance — clear RED signals as ambulance approaches
    const clearedSignals = [];
    for (const signal of signals) {
        if (signal.state === 'RED' && shouldClearSignal(ambulancePos, signal.position, criticality)) {
            try {
                await TrafficSignal.findOneAndUpdate(
                    { signalId: signal.id },
                    {
                        currentState: 'GREEN',
                        overriddenBy: {
                            corridorId,
                            overriddenAt: new Date(),
                            originalState: 'RED'
                        }
                    }
                );
                signal.state = 'GREEN';
                clearedSignals.push(signal);

                // Notify traffic department via socket
                if (io) {
                    io.to('traffic').emit('signal_cleared', {
                        signalId: signal.id,
                        name: signal.name,
                        state: 'GREEN',
                        corridorId
                    });
                }
            } catch (err) {
                console.error('[MovementEngine] Signal clearance error:', err.message);
            }
        }
    }

    return {
        position,
        route: {
            waypoints: route.waypoints || currentRoute,
            distance: route.distance,
            duration: route.duration
        },
        signals,
        eta: etaResult.etaSeconds,
        etaFormatted: etaResult.etaFormatted,
        remainingDistance: etaResult.remainingDistance,
        etaBreakdown: etaResult.breakdown,
        criticality,
        rerouted,
        demoMode,
        clearedSignals
    };
};

module.exports = {
    processGPSUpdate,
    isDeviated,
    distanceToRoute,
    DEVIATION_THRESHOLD
};
