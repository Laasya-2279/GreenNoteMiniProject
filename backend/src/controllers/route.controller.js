const { selectBestRoute, findSignalsOnRoute, getDistanceInMeters } = require('../algorithms/routeOptimizer');
const Route = require('../models/Route');
const TrafficSignal = require('../models/TrafficSignal');

// POST /api/routes/calculate
const calculateRoute = async (req, res, next) => {
    try {
        const { source, destination, criticality, corridorId } = req.body;

        if (!source || !destination) {
            return res.status(400).json({ success: false, message: 'Source and destination required' });
        }

        const bestRoute = await selectBestRoute(
            source, destination,
            criticality || 'CRITICAL',
            corridorId || 'temp'
        );

        // Get all routes for this corridor
        const allRoutes = await Route.find({ corridorId: corridorId || 'temp' });

        res.json({
            success: true,
            bestRoute,
            alternateRoutes: allRoutes.filter(r => !r.isSelected)
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/signals/on-route
const getSignalsOnRoute = async (req, res, next) => {
    try {
        const { waypoints } = req.query;

        let parsedWaypoints;
        if (typeof waypoints === 'string') {
            parsedWaypoints = JSON.parse(waypoints);
        } else {
            parsedWaypoints = waypoints;
        }

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

module.exports = { calculateRoute, getSignalsOnRoute, getRoutesForCorridor };
