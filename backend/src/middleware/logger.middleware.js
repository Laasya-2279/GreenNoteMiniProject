const morgan = require('morgan');
const winston = require('winston');

// Winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Morgan middleware for HTTP request logging
const morganMiddleware = morgan('dev');

module.exports = { logger, morganMiddleware };
