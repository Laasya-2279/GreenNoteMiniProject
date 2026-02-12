// Emergency Cost Engine — Custom algorithm layer on top of OSRM
// Evaluates routes using: baseDuration + congestionPenalty + signalPenalty + instabilityPenalty
const TrafficSignal = require('../models/TrafficSignal');
const FederatedModel = require('../models/FederatedModel');
const { haversine } = require('./osrmService');

// Signal delay per RED signal based on criticality (seconds)
const SIGNAL_DELAYS = {
    'STABLE': 30,       // Full wait
    'CRITICAL': 12,     // Reduced wait
    'VERY_CRITICAL': 3  // Near-instant clearance
};

// Congestion multipliers
const CONGESTION_PENALTIES = {
    'LOW': 0,
    'MEDIUM': 0.15,   // +15% of base duration
    'HIGH': 0.35      // +35% of base duration
};

// Instability penalty (organ stability risk)
const INSTABILITY_WEIGHTS = {
    'STABLE': 0,
    'CRITICAL': 0.08,      // +8% of base duration
    'VERY_CRITICAL': 0.20  // +20% of base duration
};

/**
 * Time bucket for federated learning bias
 */
function getTimeBucket(date) {
    const hour = (date || new Date()).getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'night';
}

/**
 * Haversine distance (re-exported for convenience)
 */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    return haversine(lat1, lon1, lat2, lon2);
}

/**
 * Find signals on a route (within 50m of any waypoint)
 * Uses local DB first, returns [{id, position, state, name}]
 */
const findSignalsOnRoute = async (routeWaypoints) => {
    try {
        const lats = routeWaypoints.map(p => p[0]);
        const lngs = routeWaypoints.map(p => p[1]);
        const bbox = [
            Math.min(...lats), Math.min(...lngs),
            Math.max(...lats), Math.max(...lngs)
        ];

        const localSignals = await TrafficSignal.find({
            location: {
                $geoWithin: {
                    $box: [
                        [bbox[1] - 0.005, bbox[0] - 0.005],
                        [bbox[3] + 0.005, bbox[2] + 0.005]
                    ]
                }
            }
        });

        return localSignals
            .map(signal => ({
                id: signal.signalId,
                position: [signal.location.coordinates[1], signal.location.coordinates[0]],
                state: signal.currentState || 'RED',
                name: signal.name
            }))
            .filter(signal => {
                const minDist = Math.min(...routeWaypoints.map(p =>
                    getDistanceInMeters(signal.position[0], signal.position[1], p[0], p[1])
                ));
                return minDist <= 50;
            });
    } catch (error) {
        console.error('[CostEngine] Signal detection error:', error.message);
        return [];
    }
};

/**
 * Calculate emergency cost for a single route
 * EmergencyCost = baseDuration + congestionPenalty + signalPenalty + instabilityPenalty + federatedBias
 *
 * @param {{ waypoints, distance, duration }} route - OSRM route
 * @param {string} criticality - STABLE | CRITICAL | VERY_CRITICAL
 * @param {string} congestionLevel - LOW | MEDIUM | HIGH
 * @param {Array} signals - Signals on route
 * @param {Object} federatedBias - { morning, afternoon, night }
 * @returns {{ emergencyCost, breakdown }}
 */
const calculateEmergencyCost = (route, criticality, congestionLevel, signals, federatedBias = {}) => {
    const baseDuration = route.duration;

    // Congestion penalty
    const congestionMultiplier = CONGESTION_PENALTIES[congestionLevel] || 0;
    const congestionPenalty = baseDuration * congestionMultiplier;

    // Signal penalty
    const redSignals = signals.filter(s => s.state === 'RED').length;
    const signalDelay = SIGNAL_DELAYS[criticality] || SIGNAL_DELAYS.CRITICAL;
    const signalPenalty = redSignals * signalDelay;

    // Instability penalty
    const instabilityWeight = INSTABILITY_WEIGHTS[criticality] || 0;
    const instabilityPenalty = baseDuration * instabilityWeight;

    // Federated learning bias
    const timeBucket = getTimeBucket();
    const federatedPenalty = federatedBias[timeBucket] || 0;

    const emergencyCost = baseDuration + congestionPenalty + signalPenalty + instabilityPenalty + federatedPenalty;

    return {
        emergencyCost: Math.round(emergencyCost),
        breakdown: {
            baseDuration: Math.round(baseDuration),
            congestionPenalty: Math.round(congestionPenalty),
            signalPenalty: Math.round(signalPenalty),
            signalCount: redSignals,
            instabilityPenalty: Math.round(instabilityPenalty),
            federatedPenalty: Math.round(federatedPenalty),
            criticality,
            congestionLevel
        }
    };
};

/**
 * Evaluate multiple OSRM routes, apply emergency cost, select best
 *
 * @param {Array} routes - Array of OSRM routes
 * @param {string} criticality
 * @param {string} congestionLevel
 * @returns {{ bestRoute, allEvaluations }}
 */
const evaluateRoutes = async (routes, criticality, congestionLevel = 'LOW') => {
    // Get federated model bias
    let federatedBias = { morning: 0, afternoon: 0, night: 0 };
    try {
        const model = await FederatedModel.findOne({ isActive: true });
        if (model) federatedBias = model.biases;
    } catch { /* use defaults */ }

    const evaluations = [];

    for (const route of routes) {
        const signals = await findSignalsOnRoute(route.waypoints);
        const { emergencyCost, breakdown } = calculateEmergencyCost(
            route, criticality, congestionLevel, signals, federatedBias
        );

        evaluations.push({
            waypoints: route.waypoints,
            distance: route.distance,
            duration: route.duration,
            demoMode: route.demoMode || false,
            emergencyCost,
            breakdown,
            signals
        });
    }

    // Sort by emergency cost (ascending)
    evaluations.sort((a, b) => a.emergencyCost - b.emergencyCost);

    return {
        bestRoute: evaluations[0] || null,
        allEvaluations: evaluations
    };
};

/**
 * Signal clearance threshold based on criticality
 * Returns meters at which a signal should be cleared ahead of the ambulance
 */
function getSignalClearanceThreshold(criticality) {
    return {
        'STABLE': 40,
        'CRITICAL': 80,
        'VERY_CRITICAL': 200
    }[criticality] || 80;
}

/**
 * Determine if a signal should be cleared (ambulance approaching)
 */
function shouldClearSignal(ambulancePosition, signalPosition, criticality) {
    const distance = getDistanceInMeters(
        ambulancePosition[0], ambulancePosition[1],
        signalPosition[0], signalPosition[1]
    );
    return distance <= getSignalClearanceThreshold(criticality);
}

module.exports = {
    calculateEmergencyCost,
    evaluateRoutes,
    findSignalsOnRoute,
    shouldClearSignal,
    getSignalClearanceThreshold,
    getDistanceInMeters,
    getTimeBucket,
    SIGNAL_DELAYS,
    CONGESTION_PENALTIES,
    INSTABILITY_WEIGHTS
};
