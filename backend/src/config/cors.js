const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:4173',
    process.env.FRONTEND_URL
].filter(Boolean);

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(allowed => origin === allowed || origin.endsWith('.onrender.com'))) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

module.exports = corsOptions;
