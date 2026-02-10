import { useState, useEffect, useRef } from 'react';
import { publicAPI } from '../../services/api';
import { toast } from 'react-toastify';

const ActiveAlertsMap = () => {
    const [corridors, setCorridors] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                const [cRes, aRes] = await Promise.all([
                    publicAPI.getActiveCorridors(),
                    publicAPI.getAlerts()
                ]);
                setCorridors(cRes.data.corridors || []);
                setAlerts(aRes.data.alerts || []);
            } catch { /* public may fail */ }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    useEffect(() => {
        if (!mapRef.current || mapInstance.current || loading) return;
        const initMap = async () => {
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');
            const map = L.map(mapRef.current).setView([9.9930419, 76.3017048], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);

            corridors.forEach(c => {
                if (c.selectedRoute?.waypoints) {
                    const coords = c.selectedRoute.waypoints.map(w => [w[0], w[1]]);
                    L.polyline(coords, { color: '#ef4444', weight: 5, opacity: 0.7, dashArray: '10, 5' }).addTo(map);
                }
                if (c.sourceHospital?.location?.coordinates) {
                    const [lng, lat] = c.sourceHospital.location.coordinates;
                    L.circleMarker([lat, lng], { radius: 10, color: '#059669', fillColor: '#10b981', fillOpacity: 0.8 })
                        .addTo(map).bindPopup(`Source: ${c.sourceHospital.name}`);
                }
                if (c.destinationHospital?.location?.coordinates) {
                    const [lng, lat] = c.destinationHospital.location.coordinates;
                    L.circleMarker([lat, lng], { radius: 10, color: '#3b82f6', fillColor: '#60a5fa', fillOpacity: 0.8 })
                        .addTo(map).bindPopup(`Destination: ${c.destinationHospital.name}`);
                }
            });

            mapInstance.current = map;
        };
        initMap();
    }, [loading, corridors]);

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0', marginBottom: '6px' }}>🚨 Active Alerts & Routes</h1>
            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>
                Roads highlighted in red should be avoided or yield to emergency vehicles
            </p>

            <div className="glass-card" style={{ padding: '4px', marginBottom: '20px' }}>
                <div ref={mapRef} style={{ width: '100%', height: '450px', borderRadius: '12px' }}></div>
            </div>

            {/* Legend */}
            <div className="glass-card">
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0', marginBottom: '12px' }}>Map Legend</h3>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '30px', height: '4px', background: '#ef4444', borderRadius: '2px' }}></div>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Active Corridor Route (Avoid)</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '12px', height: '12px', background: '#10b981', borderRadius: '50%' }}></div>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Source Hospital</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '12px', height: '12px', background: '#60a5fa', borderRadius: '50%' }}></div>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Destination Hospital</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ActiveAlertsMap;
