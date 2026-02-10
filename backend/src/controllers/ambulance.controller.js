const GPSLog = require('../models/GPSLog');
const GreenCorridor = require('../models/GreenCorridor');
const Ambulance = require('../models/Ambulance');
const AuditLog = require('../models/AuditLog');
const { updateFederatedModel } = require('../algorithms/routeOptimizer');

// POST /api/ambulance/gps - send GPS update
const sendGPSUpdate = async (req, res, next) => {
    try {
        const { corridorId, lat, lng, accuracy, speed, heading } = req.body;

        const gpsLog = await GPSLog.create({
            corridorId,
            ambulanceId: req.body.ambulanceId || req.user._id.toString(),
            location: {
                type: 'Point',
                coordinates: [lng, lat]
            },
            accuracy,
            speed,
            heading
        });

        // Update ambulance position
        await Ambulance.findOneAndUpdate(
            { userId: req.user._id },
            {
                currentLocation: { type: 'Point', coordinates: [lng, lat] }
            }
        );

        // Broadcast GPS via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.to(`corridor_${corridorId}`).emit('gps_update', {
                corridorId,
                position: { lat, lng, accuracy, speed, heading },
                timestamp: gpsLog.timestamp
            });
        }

        res.json({ success: true, gpsLog });
    } catch (error) {
        next(error);
    }
};

// GET /api/ambulance/corridor/:id
const getCorridorForDriver = async (req, res, next) => {
    try {
        const corridor = await GreenCorridor.findOne({
            corridorId: req.params.id,
            status: { $in: ['APPROVED', 'IN_PROGRESS'] }
        });

        if (!corridor) {
            return res.status(404).json({ success: false, message: 'Active corridor not found' });
        }

        // Get latest GPS logs for this corridor
        const recentGPS = await GPSLog.find({ corridorId: corridor.corridorId })
            .sort({ timestamp: -1 })
            .limit(10);

        res.json({ success: true, corridor, recentGPS });
    } catch (error) {
        next(error);
    }
};

// POST /api/ambulance/start/:id
const startCorridor = async (req, res, next) => {
    try {
        const corridor = await GreenCorridor.findOne({ corridorId: req.params.id });
        if (!corridor) {
            return res.status(404).json({ success: false, message: 'Corridor not found' });
        }

        if (corridor.status !== 'APPROVED') {
            return res.status(400).json({ success: false, message: 'Corridor is not approved' });
        }

        corridor.status = 'IN_PROGRESS';
        corridor.startedAt = new Date();
        await corridor.save();

        await AuditLog.create({
            action: 'CORRIDOR_STARTED',
            userId: req.user._id,
            corridorId: corridor.corridorId,
            ipAddress: req.ip
        });

        const io = req.app.get('io');
        if (io) {
            io.to('control_room').emit('corridor_status', { type: 'IN_PROGRESS', corridor });
            io.to('traffic').emit('corridor_status', { type: 'IN_PROGRESS', corridor });
            io.to('public').emit('public_alert', {
                type: 'CORRIDOR_IN_PROGRESS',
                corridorId: corridor.corridorId,
                message: `Ambulance is now en route: ${corridor.sourceHospital.name} → ${corridor.destinationHospital.name}`
            });
        }

        res.json({ success: true, message: 'Corridor started', corridor });
    } catch (error) {
        next(error);
    }
};

// POST /api/ambulance/complete/:id
const completeCorridor = async (req, res, next) => {
    try {
        const corridor = await GreenCorridor.findOne({ corridorId: req.params.id });
        if (!corridor) {
            return res.status(404).json({ success: false, message: 'Corridor not found' });
        }

        if (corridor.status !== 'IN_PROGRESS') {
            return res.status(400).json({ success: false, message: 'Corridor is not in progress' });
        }

        corridor.status = 'COMPLETED';
        corridor.completedAt = new Date();

        if (corridor.startedAt) {
            corridor.actualDuration = Math.round((corridor.completedAt - corridor.startedAt) / 1000);
        }

        await corridor.save();

        // Update federated learning model
        try {
            await updateFederatedModel(corridor.corridorId);
        } catch (err) {
            console.error('Federated model update failed:', err.message);
        }

        await AuditLog.create({
            action: 'CORRIDOR_COMPLETED',
            userId: req.user._id,
            corridorId: corridor.corridorId,
            details: { actualDuration: corridor.actualDuration, predictedETA: corridor.predictedETA },
            ipAddress: req.ip
        });

        const io = req.app.get('io');
        if (io) {
            io.to('control_room').emit('corridor_status', { type: 'COMPLETED', corridor });
            io.to('traffic').emit('corridor_status', { type: 'COMPLETED', corridor });
            io.to('public').emit('public_alert', {
                type: 'CORRIDOR_COMPLETED',
                corridorId: corridor.corridorId,
                message: `Green corridor completed successfully`
            });
        }

        // Mark ambulance as available
        if (corridor.ambulance?.driverId) {
            await Ambulance.findOneAndUpdate(
                { driverId: corridor.ambulance.driverId },
                { isAvailable: true, isOnDuty: false }
            );
        }

        res.json({ success: true, message: 'Corridor completed', corridor });
    } catch (error) {
        next(error);
    }
};

module.exports = { sendGPSUpdate, getCorridorForDriver, startCorridor, completeCorridor };
