require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/database');
const corsOptions = require('./config/cors');
const { initWebSocket } = require('./config/websocket');
const { morganMiddleware, logger } = require('./middleware/logger.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');
const routes = require('./routes');
const setupCorridorSocket = require('./sockets/corridorSocket');

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initWebSocket(server);
app.set('io', io);

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morganMiddleware);

// API Routes
app.use('/api', routes);

// Root
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🏥 GreenNote API - Green Corridor Management System',
        version: '2.0.0',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            corridors: '/api/corridors',
            hospitals: '/api/hospitals',
            controlroom: '/api/controlroom',
            ambulance: '/api/ambulance',
            traffic: '/api/traffic',
            public: '/api/public',
            routes: '/api/routes',
            geocode: '/api/routes/geocode'
        }
    });
});

// Setup WebSocket (new corridor-based handler)
setupCorridorSocket(io);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    logger.info(`🚀 GreenNote Server running on port ${PORT}`);
    logger.info(`📡 WebSocket ready (corridor engine active)`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server };
