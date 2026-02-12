// Route Controller — Uses OSRM + Emergency Cost Engine
const { fetchRoutes } = require('../algorithms/osrmService');
const { evaluateRoutes, findSignalsOnRoute } = require('../algorithms/emergencyCostEngine');
const { geocode, geocodePair } = require('../algorithms/geocodingService');
const Route = require('../models/Route');

// POST /api/routes/calculate
// Accepts either { source: {lat,lng}, destination: {lat,lng} }
// or { sourceName: "Hospital Name", destinationName: "Hospital Name" }
const calculateRoute = async (req, res, next) => {
    try {
        const { source, destination, sourceName, destinationName, criticality, corridorId, congestionLevel } = req.body;

        let src = source;
        let dest = destination;

        // Geocode if names provided instead of coordinates
        if ((!src || !dest) && sourceName && destinationName) {
            const geocoded = await geocodePair(sourceName, destinationName);
            src = geocoded.source;
            dest = geocoded.destination;
        }

        if (!src || !dest) {
            return res.status(400).json({ success: false, message: 'Source and destination required (coordinates or names)' });
        }

        // Fetch routes from OSRM (or demo fallback)
        const osrmRoutes = await fetchRoutes(src, dest);

        // Apply emergency cost engine
        const { bestRoute, allEvaluations } = await evaluateRoutes(
            osrmRoutes,
            criticality || 'CRITICAL',
            congestionLevel || 'LOW'
        );

        // Save routes to DB
        const savedRoutes = [];
        for (let i = 0; i < allEvaluations.length; i++) {
            const ev = allEvaluations[i];
            const routeDoc = await Route.create({
                corridorId: corridorId || 'temp',
                waypoints: ev.waypoints,
                distance: ev.distance,
                estimatedDuration: ev.emergencyCost,
                routeType: i === 0 ? 'PRIMARY' : 'ALTERNATE',
                isSelected: i === 0,
                trafficSignalsOnRoute: ev.signals.map(s => ({
                    signalId: s.id,
                    name: s.name,
                    location: {
                        type: 'Point',
                        coordinates: [s.position[1], s.position[0]]
                    }
                }))
            });
            savedRoutes.push(routeDoc);
        }

        res.json({
            success: true,
            bestRoute: {
                ...bestRoute,
                _id: savedRoutes[0]?._id
            },
            alternateRoutes: allEvaluations.slice(1),
            geocoded: (!source && sourceName) ? { source: src, destination: dest } : undefined,
            demoMode: bestRoute?.demoMode || false
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/routes/geocode?q=Hospital+Name
const geocodeLocation = async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) return res.status(400).json({ success: false, message: 'Query parameter "q" required' });

        const result = await geocode(q);
        res.json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
};

// GET /api/signals/on-route
const getSignalsOnRoute = async (req, res, next) => {
    try {
        const { waypoints } = req.query;
        let parsedWaypoints;
        if (typeof waypoints === 'string') parsedWaypoints = JSON.parse(waypoints);
        else parsedWaypoints = waypoints;

        if (!parsedWaypoints || !Array.isArray(parsedWaypoints)) {
            return res.status(400).json({ success: false, message: 'Waypoints array required' });
        }

        const signals = await findSignalsOnRoute(parsedWaypoints);
        res.json({ success: true, signals });
    } catch (error) {
        next(error);
    }
};

// GET /api/routes/:corridorId
const getRoutesForCorridor = async (req, res, next) => {
    try {
        const routes = await Route.find({ corridorId: req.params.corridorId });
        res.json({ success: true, routes });
    } catch (error) {
        next(error);
    }
};

module.exports = { calculateRoute, geocodeLocation, getSignalsOnRoute, getRoutesForCorridor };
