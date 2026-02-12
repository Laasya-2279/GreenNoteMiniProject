// Corridor Socket — Socket.IO handler for live green corridor operations
// Replaces old websocket/socketHandler.js with new event structure:
//   ambulance:gpsUpdate → backend processes → corridor:update broadcast
const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const User = require('../models/User');
const { processGPSUpdate } = require('../algorithms/movementEngine');

const setupCorridorSocket = (io) => {
    // JWT Auth middleware
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
            socket.user = { role: 'PUBLIC' };
            next();
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket] Connected: ${socket.id} (${socket.user?.role || 'PUBLIC'})`);

        // Auto-join role room
        if (socket.user?.role) {
            socket.join(socket.user.role.toLowerCase());
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

        // ─── AMBULANCE GPS UPDATE (core event) ───
        // From Ambulance: ambulance:gpsUpdate → Backend processes → corridor:update broadcast
        socket.on('ambulance:gpsUpdate', async ({ corridorId, lat, lng, accuracy, speed, heading }) => {
            try {
                if (!corridorId || lat == null || lng == null) return;

                const position = { lat, lng, accuracy, speed, heading };

                // Process through movement engine (save, detect deviation, reroute, signals)
                const result = await processGPSUpdate({
                    corridorId,
                    position,
                    userId: socket.user?._id?.toString(),
                    io
                });

                // Broadcast corridor:update to all watchers
                const updatePayload = {
                    corridorId,
                    position: result.position,
                    route: result.route,
                    signals: result.signals,
                    eta: result.eta,
                    criticality: result.criticality,
                    rerouted: result.rerouted,
                    demoMode: result.demoMode,
                    timestamp: Date.now()
                };

                // Broadcast to: corridor room, control room, traffic, hospital, public
                io.to(`corridor_${corridorId}`).emit('corridor:update', updatePayload);
                io.to('control_room').emit('corridor:update', updatePayload);
                io.to('traffic').emit('corridor:update', updatePayload);
                io.to('hospital').emit('corridor:update', updatePayload);
                io.to('public').emit('corridor:update', updatePayload);

                // Also emit legacy gps_update for backward compatibility
                io.to(`corridor_${corridorId}`).emit('gps_update', {
                    corridorId,
                    position: result.position,
                    timestamp: Date.now()
                });
                io.to('control_room').emit('gps_update', {
                    corridorId,
                    position: result.position,
                    timestamp: Date.now()
                });

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
                        newETA: result.eta
                    });
                }
            } catch (error) {
                console.error('[Socket] GPS processing error:', error.message);
            }
        });

        // ─── LEGACY: send_gps (backward compat for existing ambulance frontend) ───
        socket.on('send_gps', async (data) => {
            const { corridorId, position } = data || {};
            if (!corridorId || !position) return;

            // Delegate to the new handler
            socket.emit('ambulance:gpsUpdate', {
                corridorId,
                lat: position.lat,
                lng: position.lng,
                accuracy: position.accuracy,
                speed: position.speed,
                heading: position.heading
            });
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
