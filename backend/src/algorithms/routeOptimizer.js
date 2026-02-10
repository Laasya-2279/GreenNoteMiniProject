const axios = require('axios');
const Route = require('../models/Route');
const TrafficSignal = require('../models/TrafficSignal');
const FederatedModel = require('../models/FederatedModel');
const GreenCorridor = require('../models/GreenCorridor');
const AuditLog = require('../models/AuditLog');
const { openRouteServiceKey, overpassApiUrl } = require('../config/api-keys');

// 1. HAVERSINE DISTANCE CALCULATION
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Time bucket helper
function getTimeBucket(date) {
    const hour = (date || new Date()).getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'night';
}

// 2. ETA CALCULATION
function calculateETA(route, criticality, signals, federatedBias) {
    const AMBULANCE_SPEED = 12; // m/s (~43 km/h)

    // Calculate total distance
    let distance = 0;
    for (let i = 0; i < route.length - 1; i++) {
        distance += getDistanceInMeters(
            route[i][0], route[i][1],
            route[i + 1][0], route[i + 1][1]
        );
    }

    // Base travel time
    const travelTime = distance / AMBULANCE_SPEED;

    // Signal delay based on criticality
    const delayPerSignal = {
        'STABLE': 10,
        'CRITICAL': 5,
        'VERY_CRITICAL': 2
    }[criticality];

    const redSignals = signals.filter(s => s.state === 'RED').length;
    const signalDelay = redSignals * delayPerSignal;

    // Add federated learning bias
    const timeBucket = getTimeBucket();
    const bias = federatedBias[timeBucket] || 0;

    return Math.round(travelTime + signalDelay + bias);
}

// Decode polyline from OpenRouteService
function decodePolyline(encodedStr) {
    let index = 0, lat = 0, lng = 0;
    const points = [];

    while (index < encodedStr.length) {
        let b, shift = 0, result = 0;
        do {
            b = encodedStr.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += dlat;

        shift = 0;
        result = 0;
        do {
            b = encodedStr.charCodeAt(index++) - 63;
            result |= (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += dlng;

        points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
}

// Fetch routes from OpenRouteService API
const fetchRoutesFromAPI = async (source, destination) => {
    if (!openRouteServiceKey) {
        // Fallback: create direct route if no API key
        const directRoute = [
            [source.lat, source.lng],
            [destination.lat, destination.lng]
        ];
        const distance = getDistanceInMeters(source.lat, source.lng, destination.lat, destination.lng);
        return [{
            waypoints: directRoute,
            distance: distance,
            duration: Math.round(distance / 12) // ~43 km/h
        }];
    }

    try {
        const response = await axios.post(
            'https://api.openrouteservice.org/v2/directions/driving-car',
            {
                coordinates: [
                    [source.lng, source.lat],
                    [destination.lng, destination.lat]
                ],
                preference: 'fastest',
                alternative_routes: { target_count: 3 }
            },
            {
                headers: { 'Authorization': openRouteServiceKey },
                timeout: 10000
            }
        );

        return response.data.routes.map(route => ({
            waypoints: decodePolyline(route.geometry),
            distance: route.summary.distance,
            duration: route.summary.duration
        }));
    } catch (error) {
        console.error('OpenRouteService error:', error.message);
        // Fallback to direct route
        const distance = getDistanceInMeters(source.lat, source.lng, destination.lat, destination.lng);
        return [{
            waypoints: [[source.lat, source.lng], [destination.lat, destination.lng]],
            distance: distance,
            duration: Math.round(distance / 12)
        }];
    }
};

// Find signals on route using Overpass API or local DB
const findSignalsOnRoute = async (routeWaypoints) => {
    try {
        // First check local database
        const lats = routeWaypoints.map(p => p[0]);
        const lngs = routeWaypoints.map(p => p[1]);

        const bbox = [
            Math.min(...lats),
            Math.min(...lngs),
            Math.max(...lats),
            Math.max(...lngs)
        ];

        // Query local DB signals within bounding box
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

        if (localSignals.length > 0) {
            // Filter signals within 50m of route
            return localSignals
                .map(signal => ({
                    id: signal.signalId,
                    position: [signal.location.coordinates[1], signal.location.coordinates[0]],
                    state: signal.currentState || 'RED',
                    name: signal.name
                }))
                .filter(signal => {
                    const minDistance = Math.min(...routeWaypoints.map(point =>
                        getDistanceInMeters(signal.position[0], signal.position[1], point[0], point[1])
                    ));
                    return minDistance <= 50;
                });
        }

        // Fallback to Overpass API
        const query = `
      [out:json];
      node["highway"="traffic_signals"](${bbox.join(',')});
      out body;
    `;

        try {
            const response = await axios.get(
                `${overpassApiUrl}?data=${encodeURIComponent(query)}`,
                { timeout: 10000 }
            );

            const signals = response.data.elements.map(el => ({
                id: el.id.toString(),
                position: [el.lat, el.lon],
                state: 'RED',
                name: el.tags?.name || `Signal ${el.id}`
            }));

            // Filter signals within 50m of route
            return signals.filter(signal => {
                const minDistance = Math.min(...routeWaypoints.map(point =>
                    getDistanceInMeters(signal.position[0], signal.position[1], point[0], point[1])
                ));
                return minDistance <= 50;
            });
        } catch (err) {
            console.error('Overpass API error:', err.message);
            return [];
        }
    } catch (error) {
        console.error('Signal detection error:', error.message);
        return [];
    }
};

// 3. ROUTE SELECTION
async function selectBestRoute(source, destination, criticality, corridorId) {
    // Fetch multiple routes
    const routes = await fetchRoutesFromAPI(source, destination);

    // Get current federated learning model
    const model = await FederatedModel.findOne({ isActive: true });
    const bias = model ? model.biases : { morning: 0, afternoon: 0, night: 0 };

    // Evaluate each route
    let bestRoute = null;
    let lowestCost = Infinity;
    const routeResults = [];

    for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        const signals = await findSignalsOnRoute(route.waypoints);
        const eta = calculateETA(route.waypoints, criticality, signals, bias);

        const routeDoc = await Route.create({
            corridorId,
            waypoints: route.waypoints,
            distance: route.distance,
            estimatedDuration: eta,
            routeType: i === 0 ? 'PRIMARY' : 'ALTERNATE',
            trafficSignalsOnRoute: signals.map(s => ({
                signalId: s.id,
                name: s.name,
                location: {
                    type: 'Point',
                    coordinates: [s.position[1], s.position[0]]
                }
            }))
        });

        routeResults.push(routeDoc);

        if (eta < lowestCost) {
            lowestCost = eta;
            bestRoute = routeDoc;
        }
    }

    // Mark best route as selected
    if (bestRoute) {
        bestRoute.isSelected = true;
        bestRoute.routeType = 'PRIMARY';
        await bestRoute.save();
    }

    return bestRoute;
}

// 4. SIGNAL CLEARANCE LOGIC
function shouldClearSignal(ambulancePosition, signalPosition, criticality) {
    const distance = getDistanceInMeters(
        ambulancePosition[0], ambulancePosition[1],
        signalPosition[0], signalPosition[1]
    );

    const thresholds = {
        'STABLE': 40,
        'CRITICAL': 80,
        'VERY_CRITICAL': 200
    };

    return distance <= thresholds[criticality];
}

// 5. FEDERATED LEARNING UPDATE
async function updateFederatedModel(corridorId) {
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
        details: {
            timeBucket,
            error,
            newBias: model.biases[timeBucket],
            samples: model.samples[timeBucket]
        }
    });

    return model;
}

module.exports = {
    getDistanceInMeters,
    calculateETA,
    selectBestRoute,
    shouldClearSignal,
    updateFederatedModel,
    findSignalsOnRoute,
    fetchRoutesFromAPI,
    getTimeBucket,
    decodePolyline
};
