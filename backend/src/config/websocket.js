const { Server } = require('socket.io');

let io;

const initWebSocket = (server) => {
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:4173',
        process.env.FRONTEND_URL
    ].filter(Boolean);

    io = new Server(server, {
        cors: {
            origin: function (origin, callback) {
                if (!origin) return callback(null, true);
                if (allowedOrigins.some(allowed => origin === allowed || origin.endsWith('.onrender.com'))) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ['GET', 'POST'],
            credentials: true
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });
    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized');
    }
    return io;
};

module.exports = { initWebSocket, getIO };
