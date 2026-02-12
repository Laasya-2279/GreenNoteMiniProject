// ETA Calculator — Polyline-aware remaining distance + signal delays + ML bias
// This is the DEFINITIVE ETA computation used across the system
const { getDistanceInMeters, SIGNAL_DELAYS, getTimeBucket } = require('./emergencyCostEngine');

const AMBULANCE_SPEED_MS = 12; // ~43 km/h default ambulance speed in m/s

/**
 * Find the nearest point on a polyline to a given position
 * Returns { index, distance } — index of nearest waypoint
 */
function findNearestWaypointIndex(position, waypoints) {
    let minDist = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < waypoints.length; i++) {
        const d = getDistanceInMeters(position[0], position[1], waypoints[i][0], waypoints[i][1]);
        if (d < minDist) {
            minDist = d;
            nearestIdx = i;
        }
    }
    return { index: nearestIdx, distance: minDist };
}

/**
 * Sum remaining route distance from a waypoint index onwards
 */
function sumRemainingDistance(waypoints, fromIndex) {
    let total = 0;
    for (let i = fromIndex; i < waypoints.length - 1; i++) {
        total += getDistanceInMeters(
            waypoints[i][0], waypoints[i][1],
            waypoints[i + 1][0], waypoints[i + 1][1]
        );
    }
    return total;
}

/**
 * Calculate full ETA with all factors
 *
 * @param {{ lat: number, lng: number, speed?: number }} currentPosition
 * @param {Array<[number, number]>} routeWaypoints - [lat, lng] route
 * @param {string} criticality - STABLE | CRITICAL | VERY_CRITICAL
 * @param {Array<{ state: string }>} signals - signals on route
 * @param {{ morning?: number, afternoon?: number, night?: number }} federatedBias
 * @returns {{ etaSeconds: number, etaFormatted: string, remainingDistance: number, breakdown: Object }}
 */
function calculateLiveETA(currentPosition, routeWaypoints, criticality, signals = [], federatedBias = {}) {
    if (!routeWaypoints || routeWaypoints.length < 2) {
        return { etaSeconds: 0, etaFormatted: '--:--', remainingDistance: 0, breakdown: {} };
    }

    // 1. Find nearest point on polyline
    const pos = [currentPosition.lat, currentPosition.lng];
    const { index: nearestIdx } = findNearestWaypointIndex(pos, routeWaypoints);

    // 2. Calculate remaining distance along the polyline from nearest point
    // Include partial segment from current position to nearest waypoint
    const distToNearest = getDistanceInMeters(pos[0], pos[1], routeWaypoints[nearestIdx][0], routeWaypoints[nearestIdx][1]);
    const remainingPolyDist = sumRemainingDistance(routeWaypoints, nearestIdx);
    const remainingDistance = distToNearest + remainingPolyDist;

    // 3. Base travel time using actual speed or default
    const speed = (currentPosition.speed > 0) ? currentPosition.speed : AMBULANCE_SPEED_MS;
    const baseTravelTime = remainingDistance / speed;

    // 4. Signal delay — count RED signals ahead of current position
    const signalDelay = SIGNAL_DELAYS[criticality] || SIGNAL_DELAYS.CRITICAL;
    const redSignalsAhead = signals.filter(s => {
        if (s.state !== 'RED') return false;
        // Only count signals ahead on the route (after nearest waypoint)
        if (!s.position) return true; // If no position info, count it
        const sigIdx = findNearestWaypointIndex(s.position, routeWaypoints);
        return sigIdx.index >= nearestIdx;
    }).length;
    const totalSignalDelay = redSignalsAhead * signalDelay;

    // 5. Federated learning bias
    const timeBucket = getTimeBucket();
    const mlBias = federatedBias[timeBucket] || 0;

    // 6. Total ETA
    const etaSeconds = Math.max(0, Math.round(baseTravelTime + totalSignalDelay + mlBias));

    // 7. Format
    const minutes = Math.floor(etaSeconds / 60);
    const seconds = etaSeconds % 60;
    const etaFormatted = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;

    return {
        etaSeconds,
        etaFormatted,
        remainingDistance: Math.round(remainingDistance),
        breakdown: {
            baseTravelTime: Math.round(baseTravelTime),
            signalDelay: totalSignalDelay,
            redSignalsAhead,
            mlBias: Math.round(mlBias),
            speed: Math.round(speed * 10) / 10,
            nearestWaypointIndex: nearestIdx,
            totalWaypoints: routeWaypoints.length
        }
    };
}

module.exports = { calculateLiveETA, findNearestWaypointIndex, sumRemainingDistance, AMBULANCE_SPEED_MS };
