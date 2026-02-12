// Geocoding Service — Nominatim (OpenStreetMap)
// Converts hospital/location names → lat/lng coordinates
const axios = require('axios');

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Geocode a location name to lat/lng using Nominatim
 * @param {string} locationName - e.g. "Amrita Hospital Kochi"
 * @returns {{ latitude: number, longitude: number, display_name: string }}
 */
const geocode = async (locationName) => {
    try {
        const response = await axios.get(NOMINATIM_URL, {
            params: {
                q: locationName,
                format: 'json',
                limit: 1,
                addressdetails: 1
            },
            headers: {
                'User-Agent': 'GreenNote-CorridorSystem/1.0 (greennote@emergency.dev)'
            },
            timeout: 8000
        });

        if (!response.data || response.data.length === 0) {
            throw new Error(`Geocoding failed: No results for "${locationName}"`);
        }

        const result = response.data[0];
        return {
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon),
            display_name: result.display_name
        };
    } catch (error) {
        if (error.response) {
            throw new Error(`Nominatim API error: ${error.response.status}`);
        }
        throw error;
    }
};

/**
 * Geocode both source and destination
 * @param {string} sourceName
 * @param {string} destinationName
 * @returns {{ source: {lat, lng, displayName}, destination: {lat, lng, displayName} }}
 */
const geocodePair = async (sourceName, destinationName) => {
    const [src, dest] = await Promise.all([
        geocode(sourceName),
        geocode(destinationName)
    ]);

    return {
        source: { lat: src.latitude, lng: src.longitude, displayName: src.display_name },
        destination: { lat: dest.latitude, lng: dest.longitude, displayName: dest.display_name }
    };
};

module.exports = { geocode, geocodePair };
