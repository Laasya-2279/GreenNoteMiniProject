const TrafficSignal = require('../models/TrafficSignal');
const GreenCorridor = require('../models/GreenCorridor');
const AuditLog = require('../models/AuditLog');

// GET /api/traffic/corridors/active
const getActiveCorridors = async (req, res, next) => {
    try {
        const corridors = await GreenCorridor.find({
            status: { $in: ['APPROVED', 'IN_PROGRESS'] }
        }).sort({ createdAt: -1 });
        res.json({ success: true, corridors });
    } catch (error) {
        next(error);
    }
};

// GET /api/traffic/signals
const getSignals = async (req, res, next) => {
    try {
        const signals = await TrafficSignal.find().sort({ name: 1 });
        res.json({ success: true, signals });
    } catch (error) {
        next(error);
    }
};

// PATCH /api/traffic/signals/:id - manual override
const overrideSignal = async (req, res, next) => {
    try {
        const signal = await TrafficSignal.findOne({ signalId: req.params.id });
        if (!signal) {
            return res.status(404).json({ success: false, message: 'Signal not found' });
        }

        const originalState = signal.currentState;
        signal.currentState = req.body.state || 'GREEN';
        signal.overriddenBy = {
            corridorId: req.body.corridorId,
            overriddenAt: new Date(),
            originalState
        };
        await signal.save();

        await AuditLog.create({
            action: 'SIGNAL_OVERRIDE',
            userId: req.user._id,
            corridorId: req.body.corridorId,
            details: { signalId: signal.signalId, from: originalState, to: signal.currentState },
            ipAddress: req.ip
        });

        // Broadcast signal cleared
        const io = req.app.get('io');
        if (io) {
            io.to(`corridor_${req.body.corridorId}`).emit('signal_cleared', {
                signalId: signal.signalId,
                state: signal.currentState,
                location: signal.location
            });
            io.to('control_room').emit('signal_cleared', {
                signalId: signal.signalId,
                state: signal.currentState
            });
        }

        res.json({ success: true, message: 'Signal overridden', signal });
    } catch (error) {
        next(error);
    }
};

// PATCH /api/traffic/signals/:id/restore
const restoreSignal = async (req, res, next) => {
    try {
        const signal = await TrafficSignal.findOne({ signalId: req.params.id });
        if (!signal) {
            return res.status(404).json({ success: false, message: 'Signal not found' });
        }

        if (signal.overriddenBy?.originalState) {
            signal.currentState = signal.overriddenBy.originalState;
        }
        signal.overriddenBy = undefined;
        await signal.save();

        await AuditLog.create({
            action: 'SIGNAL_RESTORED',
            userId: req.user._id,
            details: { signalId: signal.signalId },
            ipAddress: req.ip
        });

        res.json({ success: true, message: 'Signal restored', signal });
    } catch (error) {
        next(error);
    }
};

module.exports = { getActiveCorridors, getSignals, overrideSignal, restoreSignal };
