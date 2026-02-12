// Route Optimizer — Backward Compatibility Redirect
// All real logic has moved to:
//   - osrmService.js (routing)
//   - emergencyCostEngine.js (cost evaluation)
//   - movementEngine.js (deviation/rerouting)
//   - mlPredictor.js (federated learning)
//
// This file re-exports for any code still importing from routeOptimizer
const { fetchRoutes, haversine } = require('./osrmService');
const { evaluateRoutes, findSignalsOnRoute, shouldClearSignal, getDistanceInMeters, getTimeBucket } = require('./emergencyCostEngine');
const { updateFederatedModel } = require('./mlPredictor');

// Backward compat: selectBestRoute
async function selectBestRoute(source, destination, criticality, corridorId) {
    const routes = await fetchRoutes(source, destination);
    const { bestRoute } = await evaluateRoutes(routes, criticality);
    return bestRoute;
}

// Backward compat: calculateETA
function calculateETA(waypoints, criticality, signals, federatedBias) {
    const { calculateEmergencyCost } = require('./emergencyCostEngine');
    const route = {
        waypoints,
        distance: 0,
        duration: 0
    };
    // Calculate distance
    for (let i = 0; i < waypoints.length - 1; i++) {
        route.distance += getDistanceInMeters(waypoints[i][0], waypoints[i][1], waypoints[i + 1][0], waypoints[i + 1][1]);
    }
    route.duration = Math.round(route.distance / 12);
    const { emergencyCost } = calculateEmergencyCost(route, criticality, 'LOW', signals, federatedBias);
    return emergencyCost;
}

module.exports = {
    getDistanceInMeters,
    calculateETA,
    selectBestRoute,
    shouldClearSignal,
    updateFederatedModel,
    findSignalsOnRoute,
    fetchRoutesFromAPI: fetchRoutes,
    getTimeBucket,
    decodePolyline: () => [] // No longer used (OSRM returns GeoJSON)
};
