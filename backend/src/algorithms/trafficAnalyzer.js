// Traffic Analyzer - analyze traffic patterns for route optimization
const GPSLog = require('../models/GPSLog');
const { getDistanceInMeters } = require('./routeOptimizer');

const analyzeRouteTraffic = async (waypoints) => {
    // Get recent GPS logs near the route
    const lats = waypoints.map(p => p[0]);
    const lngs = waypoints.map(p => p[1]);

    const recentLogs = await GPSLog.find({
        timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    }).limit(100);

    if (recentLogs.length === 0) {
        return { congestionLevel: 'LOW', averageSpeed: 12, segments: [] };
    }

    // Calculate average speed from logs
    const speeds = recentLogs.filter(l => l.speed > 0).map(l => l.speed);
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 12;

    let congestionLevel = 'LOW';
    if (avgSpeed < 5) congestionLevel = 'HIGH';
    else if (avgSpeed < 8) congestionLevel = 'MEDIUM';

    return { congestionLevel, averageSpeed: avgSpeed, segments: [] };
};

module.exports = { analyzeRouteTraffic };
