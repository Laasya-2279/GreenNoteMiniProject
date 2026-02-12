const { Server } = require('socket.io');

let io;

const initWebSocket = (server) => {
    // Allowed origins for CORS — includes deployed Render URLs
    const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:3000',
        process.env.FRONTEND_URL
    ].filter(Boolean);

    io = new Server(server, {
        cors: {
            origin: function (origin, callback) {
                // Allow requests with no origin (mobile apps, curl, Postman)
                if (!origin) return callback(null, true);
                // Allow any .onrender.com subdomain + explicit whitelist
                if (allowedOrigins.some(allowed => origin === allowed) || origin.endsWith('.onrender.com')) {
                    callback(null, true);
                } else {
                    console.warn(`[WebSocket] CORS blocked origin: ${origin}`);
                    callback(new Error('Not allowed by CORS'));
                }
            },
            methods: ['GET', 'POST'],
            credentials: true
        },
        // CRITICAL for Render: allow both transports
        // Render proxies WebSocket via HTTP upgrade, polling is the reliable fallback
        transports: ['websocket', 'polling'],
        allowUpgrades: true,
        pingTimeout: 60000,
        pingInterval: 25000,
        // Increase buffer for mobile connections
        maxHttpBufferSize: 1e6
    });

    console.log('[WebSocket] Server initialized with CORS origins:', allowedOrigins.join(', '));
    return io;
};

const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized — call initWebSocket(server) first');
    }
    return io;
};

module.exports = { initWebSocket, getIO };
