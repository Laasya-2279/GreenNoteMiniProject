// OSRM Routing Service — Public OSRM server
// Fetches real road geometry with alternatives
const axios = require('axios');

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

// Demo fallback routes (Kochi area)
const DEMO_ROUTES = [
    {
        waypoints: [
            [9.9930, 76.2990], [9.9935, 76.2970], [9.9945, 76.2945],
            [9.9960, 76.2920], [9.9970, 76.2900], [9.9985, 76.2880],
            [10.0000, 76.2865], [10.0015, 76.2850], [10.0030, 76.2840],
            [10.0045, 76.2830], [10.0060, 76.2820], [10.0070, 76.2810],
            [10.0080, 76.2800], [10.0090, 76.2790], [10.0100, 76.2780]
        ],
        distance: 3200,
        duration: 420,
        demoMode: true
    },
    {
        waypoints: [
            [9.9930, 76.2990], [9.9925, 76.2975], [9.9920, 76.2955],
            [9.9925, 76.2930], [9.9935, 76.2905], [9.9950, 76.2885],
            [9.9970, 76.2865], [9.9990, 76.2850], [10.0010, 76.2840],
            [10.0035, 76.2830], [10.0055, 76.2815], [10.0075, 76.2800],
            [10.0090, 76.2790], [10.0100, 76.2780]
        ],
        distance: 3800,
        duration: 500,
        demoMode: true
    }
];

/**
 * Fetch routes from OSRM (with alternatives)
 * @param {{ lat: number, lng: number }} source
 * @param {{ lat: number, lng: number }} destination
 * @returns {Array<{ waypoints, distance, duration, demoMode }>}
 */
const fetchRoutes = async (source, destination) => {
    // Demo mode check
    if (process.env.NODE_ENV === 'demo') {
        console.log('[OSRM] Demo mode — using fallback routes');
        return getDemoRoutes(source, destination);
    }

    try {
        // OSRM expects lng,lat format
        const coords = `${source.lng},${source.lat};${destination.lng},${destination.lat}`;
        const url = `${OSRM_BASE}/${coords}`;

        const response = await axios.get(url, {
            params: {
                overview: 'full',
                geometries: 'geojson',
                alternatives: 'true',
                steps: 'false'
            },
            timeout: 10000
        });

        if (response.data.code !== 'Ok' || !response.data.routes?.length) {
            console.warn('[OSRM] No routes returned, falling back to demo');
            return getDemoRoutes(source, destination);
        }

        return response.data.routes.map(route => ({
            waypoints: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]), // GeoJSON is [lng,lat], we use [lat,lng]
            distance: route.distance, // meters
            duration: route.duration, // seconds
            demoMode: false
        }));
    } catch (error) {
        console.error('[OSRM] API error:', error.message, '— using demo fallback');
        return getDemoRoutes(source, destination);
    }
};

/**
 * Generate demo routes anchored to actual source/destination
 */
const getDemoRoutes = (source, destination) => {
    const latStep = (destination.lat - source.lat) / 14;
    const lngStep = (destination.lng - source.lng) / 14;

    // Generate a realistic-looking route by interpolation with slight offsets
    const primaryRoute = [];
    const altRoute = [];

    for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        // Primary: slight curve via sine wave
        const offsetLat = Math.sin(t * Math.PI) * 0.002;
        const offsetLng = Math.sin(t * Math.PI) * 0.001;
        primaryRoute.push([
            source.lat + latStep * i + offsetLat,
            source.lng + lngStep * i + offsetLng
        ]);

        // Alt: curve the other way
        altRoute.push([
            source.lat + latStep * i - offsetLat * 0.8,
            source.lng + lngStep * i - offsetLng * 1.2
        ]);
    }

    const dist = haversine(source.lat, source.lng, destination.lat, destination.lng);

    return [
        { waypoints: primaryRoute, distance: dist, duration: Math.round(dist / 12), demoMode: true },
        { waypoints: altRoute, distance: dist * 1.15, duration: Math.round(dist * 1.15 / 12), demoMode: true }
    ];
};

/** Haversine distance in meters */
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = { fetchRoutes, getDemoRoutes, haversine };
