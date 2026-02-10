import { useState, useEffect, useRef } from 'react';
import { trafficAPI } from '../../services/api';
import { toast } from 'react-toastify';

const ActiveCorridorsMap = () => {
    const [corridors, setCorridors] = useState([]);
    const [loading, setLoading] = useState(true);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await trafficAPI.getActiveCorridors();
                setCorridors(res.data.corridors || []);
            } catch { toast.error('Failed to load corridors'); }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;
        const initMap = async () => {
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');
            const map = L.map(mapRef.current).setView([9.9930419, 76.3017048], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);

            corridors.forEach(c => {
                if (c.sourceHospital?.location?.coordinates) {
                    const [lng, lat] = c.sourceHospital.location.coordinates;
                    L.marker([lat, lng]).addTo(map).bindPopup(`<b>${c.sourceHospital.name}</b><br>Source - ${c.corridorId}`);
                }
                if (c.destinationHospital?.location?.coordinates) {
                    const [lng, lat] = c.destinationHospital.location.coordinates;
                    L.marker([lat, lng]).addTo(map).bindPopup(`<b>${c.destinationHospital.name}</b><br>Destination - ${c.corridorId}`);
                }
                if (c.selectedRoute?.waypoints) {
                    L.polyline(c.selectedRoute.waypoints.map(w => [w[0], w[1]]), { color: '#059669', weight: 4 }).addTo(map);
                }
            });

            mapInstance.current = map;
        };
        if (!loading) initMap();
    }, [loading, corridors]);

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0', marginBottom: '24px' }}>🗺️ Active Corridors Map</h1>
            <div className="glass-card" style={{ padding: '4px' }}>
                <div ref={mapRef} style={{ width: '100%', height: '550px', borderRadius: '12px' }}></div>
            </div>
        </div>
    );
};

export default ActiveCorridorsMap;
