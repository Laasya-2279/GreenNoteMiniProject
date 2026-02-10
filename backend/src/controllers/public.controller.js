const GreenCorridor = require('../models/GreenCorridor');

// GET /api/public/corridors/active
const getActiveCorridors = async (req, res, next) => {
    try {
        const corridors = await GreenCorridor.find({
            status: { $in: ['APPROVED', 'IN_PROGRESS'] }
        })
            .select('corridorId sourceHospital.name destinationHospital.name organType urgencyLevel status selectedRoute.distance predictedETA createdAt')
            .sort({ createdAt: -1 });

        res.json({ success: true, corridors });
    } catch (error) {
        next(error);
    }
};

// GET /api/public/alerts
const getAlerts = async (req, res, next) => {
    try {
        const activeCorridors = await GreenCorridor.find({
            status: 'IN_PROGRESS'
        })
            .select('corridorId sourceHospital.name destinationHospital.name selectedRoute.waypoints urgencyLevel')
            .sort({ createdAt: -1 });

        const alerts = activeCorridors.map(corridor => ({
            corridorId: corridor.corridorId,
            message: `Active green corridor: ${corridor.sourceHospital.name} → ${corridor.destinationHospital.name}`,
            urgencyLevel: corridor.urgencyLevel,
            avoidRoutes: corridor.selectedRoute?.waypoints ? true : false
        }));

        res.json({ success: true, alerts });
    } catch (error) {
        next(error);
    }
};

module.exports = { getActiveCorridors, getAlerts };
