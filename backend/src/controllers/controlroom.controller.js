const GreenCorridor = require('../models/GreenCorridor');
const AuditLog = require('../models/AuditLog');
const { selectBestRoute } = require('../algorithms/routeOptimizer');

// GET /api/controlroom/requests - pending requests
const getPendingRequests = async (req, res, next) => {
    try {
        const requests = await GreenCorridor.find({ status: 'PENDING' })
            .sort({ createdAt: -1 })
            .populate('requestedBy', 'name email');
        res.json({ success: true, requests });
    } catch (error) {
        next(error);
    }
};

// PATCH /api/controlroom/requests/:id/approve
const approveRequest = async (req, res, next) => {
    try {
        const corridor = await GreenCorridor.findOne({ corridorId: req.params.id });
        if (!corridor) {
            return res.status(404).json({ success: false, message: 'Corridor not found' });
        }

        if (corridor.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Request is not pending' });
        }

        // Update urgency if provided
        if (req.body.urgencyLevel) {
            corridor.urgencyLevel = req.body.urgencyLevel;
        }

        corridor.status = 'APPROVED';
        corridor.approvedBy = req.user._id;

        // Calculate optimal route
        try {
            const routeResult = await selectBestRoute(
                {
                    lat: corridor.sourceHospital.location.coordinates[1],
                    lng: corridor.sourceHospital.location.coordinates[0]
                },
                {
                    lat: corridor.destinationHospital.location.coordinates[1],
                    lng: corridor.destinationHospital.location.coordinates[0]
                },
                corridor.urgencyLevel,
                corridor.corridorId
            );

            if (routeResult) {
                corridor.selectedRoute = {
                    routeId: routeResult._id?.toString(),
                    distance: routeResult.distance,
                    estimatedDuration: routeResult.estimatedDuration,
                    waypoints: routeResult.waypoints
                };
                corridor.predictedETA = routeResult.estimatedDuration;
            }
        } catch (routeErr) {
            console.error('Route calculation failed, approving without route:', routeErr.message);
        }

        await corridor.save();

        await AuditLog.create({
            action: 'CORRIDOR_APPROVED',
            userId: req.user._id,
            corridorId: corridor.corridorId,
            details: { urgencyLevel: corridor.urgencyLevel },
            ipAddress: req.ip
        });

        // Notify all parties via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.to('control_room').emit('corridor_status', { type: 'APPROVED', corridor });
            io.to(`corridor_${corridor.corridorId}`).emit('corridor_status', { type: 'APPROVED', corridor });
            io.to('traffic').emit('corridor_status', { type: 'APPROVED', corridor });
            io.to('public').emit('public_alert', {
                type: 'CORRIDOR_ACTIVE',
                corridorId: corridor.corridorId,
                message: `Green corridor activated: ${corridor.sourceHospital.name} → ${corridor.destinationHospital.name}`
            });
        }

        res.json({ success: true, message: 'Request approved', corridor });
    } catch (error) {
        next(error);
    }
};

// PATCH /api/controlroom/requests/:id/reject
const rejectRequest = async (req, res, next) => {
    try {
        const corridor = await GreenCorridor.findOne({ corridorId: req.params.id });
        if (!corridor) {
            return res.status(404).json({ success: false, message: 'Corridor not found' });
        }

        if (corridor.status !== 'PENDING') {
            return res.status(400).json({ success: false, message: 'Request is not pending' });
        }

        corridor.status = 'REJECTED';
        corridor.rejectionReason = req.body.reason || 'No reason provided';
        corridor.approvedBy = req.user._id;
        await corridor.save();

        await AuditLog.create({
            action: 'CORRIDOR_REJECTED',
            userId: req.user._id,
            corridorId: corridor.corridorId,
            details: { reason: corridor.rejectionReason },
            ipAddress: req.ip
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`corridor_${corridor.corridorId}`).emit('corridor_status', { type: 'REJECTED', corridor });
        }

        res.json({ success: true, message: 'Request rejected', corridor });
    } catch (error) {
        next(error);
    }
};

// GET /api/controlroom/corridors/active
const getActiveCorridors = async (req, res, next) => {
    try {
        const corridors = await GreenCorridor.find({
            status: { $in: ['APPROVED', 'IN_PROGRESS'] }
        }).sort({ createdAt: -1 })
            .populate('requestedBy', 'name email')
            .populate('approvedBy', 'name email');
        res.json({ success: true, corridors });
    } catch (error) {
        next(error);
    }
};

// GET /api/controlroom/audit-logs
const getAuditLogs = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.action) filter.action = req.query.action;
        if (req.query.corridorId) filter.corridorId = req.query.corridorId;

        const [logs, total] = await Promise.all([
            AuditLog.find(filter)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .populate('userId', 'name email role'),
            AuditLog.countDocuments(filter)
        ]);

        res.json({
            success: true,
            logs,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) }
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/controlroom/corridors/cleanup - batch complete stale corridors
const cleanupCorridors = async (req, res, next) => {
    try {
        // Mark corridors older than 24 hours as COMPLETED
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const staleCorridors = await GreenCorridor.find({
            status: { $in: ['APPROVED', 'IN_PROGRESS'] },
            createdAt: { $lt: cutoff }
        });

        let cleaned = 0;
        for (const corridor of staleCorridors) {
            corridor.status = 'COMPLETED';
            corridor.completedAt = new Date();
            corridor.completionReason = 'AUTO_CLEANUP';
            if (corridor.startedAt) {
                corridor.actualDuration = Math.round((corridor.completedAt - corridor.startedAt) / 1000);
            }
            await corridor.save();
            cleaned++;
        }

        // Notify all dashboards
        const io = req.app.get('io');
        if (io && cleaned > 0) {
            io.to('control_room').emit('corridor_status', { type: 'CLEANUP', cleaned });
            io.to('traffic').emit('corridor_status', { type: 'CLEANUP', cleaned });
        }

        await AuditLog.create({
            action: 'CORRIDORS_CLEANUP',
            userId: req.user._id,
            details: { cleaned, cutoffDate: cutoff },
            ipAddress: req.ip
        });

        res.json({ success: true, message: `Cleaned ${cleaned} stale corridor(s)`, cleaned });
    } catch (error) {
        next(error);
    }
};

module.exports = { getPendingRequests, approveRequest, rejectRequest, getActiveCorridors, getAuditLogs, cleanupCorridors };
