// Movement Engine — Deviation detection + route recalculation
// Handles live ambulance movement, triggers rerouting when off-corridor
const { fetchRoutes } = require('./osrmService');
const { evaluateRoutes, findSignalsOnRoute, shouldClearSignal, getDistanceInMeters } = require('./emergencyCostEngine');
const TrafficSignal = require('../models/TrafficSignal');
const GreenCorridor = require('../models/GreenCorridor');
const GPSLog = require('../models/GPSLog');
const Ambulance = require('../models/Ambulance');

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
 * Process a GPS update from an ambulance:
 * 1. Save GPS log
 * 2. Update ambulance position
 * 3. Detect deviation → reroute if needed
 * 4. Check signal clearance
 * 5. Return updated corridor state for broadcast
 *
 * @param {Object} params
 * @param {string} params.corridorId
 * @param {{ lat: number, lng: number, accuracy?, speed?, heading? }} params.position
 * @param {string} params.userId - ambulance driver user ID
 * @param {Object} params.io - Socket.IO server instance
 * @returns {{ position, route, signals, eta, criticality, rerouted, demoMode }}
 */
const processGPSUpdate = async ({ corridorId, position, userId, io }) => {
    // 1. Save GPS log
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

    // 2. Update ambulance position in DB
    if (userId) {
        await Ambulance.findOneAndUpdate(
            { userId },
            { currentLocation: { type: 'Point', coordinates: [position.lng, position.lat] } }
        );
    }

    // 3. Get corridor
    const corridor = await GreenCorridor.findOne({ corridorId });
    if (!corridor) {
        return { position, route: null, signals: [], eta: null, criticality: 'CRITICAL', rerouted: false };
    }

    const currentRoute = corridor.selectedRoute?.waypoints || [];
    const criticality = corridor.urgencyLevel || 'CRITICAL';
    let rerouted = false;
    let route = { waypoints: currentRoute, distance: corridor.selectedRoute?.distance, duration: corridor.selectedRoute?.duration };
    let signals = [];
    let eta = corridor.predictedETA;
    let demoMode = corridor.selectedRoute?.demoMode || false;

    // 4. Deviation detection — reroute if > 50m off corridor
    const ambulancePos = [position.lat, position.lng];

    if (currentRoute.length > 0 && isDeviated(ambulancePos, currentRoute)) {
        console.log(`[MovementEngine] Deviation detected for ${corridorId} — rerouting`);

        // Destination = last waypoint of current route or stored destination
        const destCoords = corridor.destinationHospital?.location?.coordinates;
        const destination = destCoords
            ? { lat: destCoords[1], lng: destCoords[0] }
            : { lat: currentRoute[currentRoute.length - 1][0], lng: currentRoute[currentRoute.length - 1][1] };

        // Fetch new route from current position
        const newRoutes = await fetchRoutes(
            { lat: position.lat, lng: position.lng },
            destination
        );

        // Apply emergency cost
        const { bestRoute } = await evaluateRoutes(newRoutes, criticality);

        if (bestRoute) {
            // Update corridor with new route
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
            eta = bestRoute.emergencyCost;
            demoMode = bestRoute.demoMode;
            rerouted = true;
        }
    } else {
        // No deviation — just update signals and ETA
        signals = await findSignalsOnRoute(currentRoute);

        // Recalculate ETA based on remaining distance
        const destCoords = corridor.destinationHospital?.location?.coordinates;
        if (destCoords) {
            const remainingDist = getDistanceInMeters(
                position.lat, position.lng, destCoords[1], destCoords[0]
            );
            const speed = position.speed > 0 ? position.speed : 12; // m/s default
            eta = Math.round(remainingDist / speed);
        }
    }

    // 5. Check signal clearance
    const clearedSignals = [];
    for (const signal of signals) {
        if (signal.state === 'RED' && shouldClearSignal(ambulancePos, signal.position, criticality)) {
            // Clear signal in DB
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

                // Notify traffic department
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
            waypoints: route.waypoints,
            distance: route.distance,
            duration: route.duration
        },
        signals,
        eta,
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
