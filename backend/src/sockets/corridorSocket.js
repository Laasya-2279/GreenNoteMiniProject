// Corridor Socket — Socket.IO handler for live green corridor operations
// Event flow: ambulance:gpsUpdate → backend processes → corridor:update broadcast
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const User = require('../models/User');
const { processGPSUpdate } = require('../algorithms/movementEngine');

/**
 * Core GPS processing function — shared between ambulance:gpsUpdate and legacy send_gps
 */
async function handleGPSEvent(io, socket, { corridorId, lat, lng, accuracy, speed, heading }) {
    if (!corridorId || lat == null || lng == null) return;

    const position = { lat, lng, accuracy, speed, heading };

    // Process through movement engine (save, detect deviation, reroute, signals, ETA)
    const result = await processGPSUpdate({
        corridorId,
        position,
        userId: socket.user?._id?.toString(),
        io
    });

    // Build broadcast payload with full corridor state
    const updatePayload = {
        corridorId,
        position: result.position,
        route: result.route,
        signals: result.signals,
        eta: result.eta,                          // seconds
        etaFormatted: result.etaFormatted,        // "3m 42s"
        remainingDistance: result.remainingDistance,// meters
        etaBreakdown: result.etaBreakdown,        // debug info
        criticality: result.criticality,
        rerouted: result.rerouted,
        demoMode: result.demoMode,
        timestamp: Date.now()
    };

    // Broadcast corridor:update to ALL role rooms + corridor-specific room
    io.to(`corridor_${corridorId}`).emit('corridor:update', updatePayload);
    io.to('control_room').emit('corridor:update', updatePayload);
    io.to('traffic').emit('corridor:update', updatePayload);
    io.to('hospital').emit('corridor:update', updatePayload);
    io.to('public').emit('corridor:update', updatePayload);

    // Also emit legacy gps_update for backward compatibility with old frontend views
    const legacyPayload = {
        corridorId,
        position: result.position,
        eta: result.eta,
        etaFormatted: result.etaFormatted,
        timestamp: Date.now()
    };
    io.to(`corridor_${corridorId}`).emit('gps_update', legacyPayload);
    io.to('control_room').emit('gps_update', legacyPayload);

    // Notify about cleared signals
    if (result.clearedSignals?.length > 0) {
        for (const sig of result.clearedSignals) {
            io.to(`corridor_${corridorId}`).emit('signal_cleared', {
                signalId: sig.id,
                name: sig.name,
                state: 'GREEN',
                location: sig.position
            });
        }
    }

    // Notify if rerouted
    if (result.rerouted) {
        io.to(`corridor_${corridorId}`).emit('route_updated', {
            corridorId,
            reason: 'DEVIATION_DETECTED',
            newETA: result.eta,
            newETAFormatted: result.etaFormatted
        });
    }
}

const setupCorridorSocket = (io) => {
    // JWT Auth middleware — allows unauthenticated connections as PUBLIC
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            if (!token) {
                socket.user = { role: 'PUBLIC' };
                return next();
            }
            const decoded = jwt.verify(token, jwtSecret);
            const user = await User.findById(decoded.id).select('-password');
            if (!user) return next(new Error('Authentication error'));
            socket.user = user;
            next();
        } catch (err) {
            // Allow connection but as PUBLIC
            socket.user = { role: 'PUBLIC' };
            next();
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] Connected: ${socket.id} | role: ${socket.user?.role || 'PUBLIC'}`);

        // Auto-join role-based room
        if (socket.user?.role) {
            const roleRoom = socket.user.role.toLowerCase();
            socket.join(roleRoom);
            console.log(`[Socket] ${socket.id} joined room: ${roleRoom}`);
        }

        // ─── Room Management ───
        socket.on('join_corridor', ({ corridorId }) => {
            if (corridorId) {
                socket.join(`corridor_${corridorId}`);
                console.log(`[Socket] ${socket.id} joined corridor_${corridorId}`);
            }
        });

        socket.on('leave_corridor', ({ corridorId }) => {
            if (corridorId) socket.leave(`corridor_${corridorId}`);
        });

        socket.on('join_public', () => socket.join('public'));

        // ─── AMBULANCE GPS UPDATE (primary event) ───
        socket.on('ambulance:gpsUpdate', async (data) => {
            try {
                await handleGPSEvent(io, socket, data);
            } catch (error) {
                console.error('[Socket] ambulance:gpsUpdate error:', error.message);
            }
        });

        // ─── LEGACY: send_gps (backward compat for old ambulance views) ───
        // FIX: Previously this did socket.emit() which sent event back to client.
        // Now it directly calls the same handler function.
        socket.on('send_gps', async (data) => {
            try {
                const { corridorId, position } = data || {};
                if (!corridorId || !position) return;

                // Call the same core handler — no recursive emit
                await handleGPSEvent(io, socket, {
                    corridorId,
                    lat: position.lat,
                    lng: position.lng,
                    accuracy: position.accuracy,
                    speed: position.speed,
                    heading: position.heading
                });
            } catch (error) {
                console.error('[Socket] send_gps error:', error.message);
            }
        });

        // ─── Signal Override (Traffic Department) ───
        socket.on('signal_override', async (data) => {
            try {
                const { signalId, state, corridorId } = data;
                const TrafficSignal = require('../models/TrafficSignal');
                const signal = await TrafficSignal.findOne({ signalId });
                if (signal) {
                    const originalState = signal.currentState;
                    signal.currentState = state || 'GREEN';
                    signal.overriddenBy = {
                        corridorId,
                        overriddenAt: new Date(),
                        originalState
                    };
                    await signal.save();

                    io.to(`corridor_${corridorId}`).emit('signal_cleared', {
                        signalId, state: signal.currentState, location: signal.location
                    });
                    io.to('control_room').emit('signal_cleared', {
                        signalId, state: signal.currentState
                    });
                    io.to('traffic').emit('signal_cleared', {
                        signalId, state: signal.currentState, corridorId
                    });
                }
            } catch (error) {
                console.error('[Socket] Signal override error:', error.message);
            }
        });

        socket.on('disconnect', () => {
            console.log(`[Socket] Disconnected: ${socket.id}`);
        });
    });

    return io;
};

module.exports = setupCorridorSocket;
