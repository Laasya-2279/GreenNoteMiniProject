const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const User = require('../models/User');
const GPSLog = require('../models/GPSLog');
const Ambulance = require('../models/Ambulance');
const { shouldClearSignal } = require('../algorithms/routeOptimizer');
const TrafficSignal = require('../models/TrafficSignal');
const GreenCorridor = require('../models/GreenCorridor');

const setupWebSocket = (io) => {
    // Auth middleware for WebSocket
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.query.token;
            if (!token) {
                // Allow unauthenticated connections for public view
                socket.user = { role: 'PUBLIC' };
                return next();
            }
            const decoded = jwt.verify(token, jwtSecret);
            const user = await User.findById(decoded.id).select('-password');
            if (!user) return next(new Error('Authentication error'));
            socket.user = user;
            next();
        } catch (err) {
            // Allow connection but mark as public
            socket.user = { role: 'PUBLIC' };
            next();
        }
    });

    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id} (${socket.user?.role || 'unknown'})`);

        // Auto-join role-based rooms
        if (socket.user?.role) {
            const roleRoom = socket.user.role.toLowerCase();
            socket.join(roleRoom);
        }

        // Join corridor room
        socket.on('join_corridor', (data) => {
            const { corridorId } = data;
            if (corridorId) {
                socket.join(`corridor_${corridorId}`);
                console.log(`${socket.id} joined corridor_${corridorId}`);
            }
        });

        // Leave corridor room
        socket.on('leave_corridor', (data) => {
            const { corridorId } = data;
            if (corridorId) {
                socket.leave(`corridor_${corridorId}`);
            }
        });

        // Receive GPS updates from ambulance
        socket.on('send_gps', async (data) => {
            try {
                const { corridorId, position } = data;
                if (!corridorId || !position) return;

                // Save GPS log
                await GPSLog.create({
                    corridorId,
                    ambulanceId: socket.user?._id?.toString() || 'unknown',
                    location: {
                        type: 'Point',
                        coordinates: [position.lng, position.lat]
                    },
                    accuracy: position.accuracy,
                    speed: position.speed,
                    heading: position.heading
                });

                // Update ambulance position
                if (socket.user?._id) {
                    await Ambulance.findOneAndUpdate(
                        { userId: socket.user._id },
                        { currentLocation: { type: 'Point', coordinates: [position.lng, position.lat] } }
                    );
                }

                // Broadcast to corridor watchers
                io.to(`corridor_${corridorId}`).emit('gps_update', {
                    corridorId,
                    position,
                    timestamp: Date.now()
                });

                // Also broadcast to control room
                io.to('control_room').emit('gps_update', {
                    corridorId,
                    position,
                    timestamp: Date.now()
                });

                // Check signal clearance
                try {
                    const corridor = await GreenCorridor.findOne({ corridorId });
                    if (corridor && corridor.selectedRoute?.waypoints) {
                        const signals = await TrafficSignal.find({
                            currentState: 'RED',
                            isOperational: true
                        });

                        for (const signal of signals) {
                            const signalPos = [signal.location.coordinates[1], signal.location.coordinates[0]];
                            const ambulancePos = [position.lat, position.lng];

                            if (shouldClearSignal(ambulancePos, signalPos, corridor.urgencyLevel)) {
                                // Auto-clear signal
                                signal.currentState = 'GREEN';
                                signal.overriddenBy = {
                                    corridorId,
                                    overriddenAt: new Date(),
                                    originalState: 'RED'
                                };
                                await signal.save();

                                io.to(`corridor_${corridorId}`).emit('signal_cleared', {
                                    signalId: signal.signalId,
                                    name: signal.name,
                                    state: 'GREEN',
                                    location: signal.location
                                });

                                io.to('traffic').emit('signal_cleared', {
                                    signalId: signal.signalId,
                                    name: signal.name,
                                    state: 'GREEN',
                                    corridorId
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error('Signal clearance check error:', err.message);
                }
            } catch (error) {
                console.error('GPS save error:', error.message);
            }
        });

        // Signal override from traffic department
        socket.on('signal_override', async (data) => {
            try {
                const { signalId, state, corridorId } = data;
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
                }
            } catch (error) {
                console.error('Signal override error:', error.message);
            }
        });

        // Join public room for alerts
        socket.on('join_public', () => {
            socket.join('public');
        });

        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};

module.exports = setupWebSocket;
