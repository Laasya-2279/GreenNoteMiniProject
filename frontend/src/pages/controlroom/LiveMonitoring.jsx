import { useState, useEffect, useRef } from 'react';
import { controlRoomAPI } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { toast } from 'react-toastify';

const LiveMonitoring = () => {
    const [corridors, setCorridors] = useState([]);
    const [gpsPositions, setGpsPositions] = useState({});
    const [loading, setLoading] = useState(true);
    const { socket } = useWebSocket();
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef({});

    useEffect(() => { fetchCorridors(); }, []);

    useEffect(() => {
        if (!socket) return;

        socket.on('gps_update', (data) => {
            setGpsPositions(prev => ({
                ...prev,
                [data.corridorId]: data.position
            }));
            // Update marker on map
            updateMarker(data.corridorId, data.position);
        });

        socket.on('corridor_status', () => fetchCorridors());
        socket.on('signal_cleared', (data) => {
            toast.info(`🚦 Signal ${data.signalId} cleared to ${data.state}`);
        });

        return () => {
            socket.off('gps_update');
            socket.off('corridor_status');
            socket.off('signal_cleared');
        };
    }, [socket]);

    // Initialize Leaflet map
    useEffect(() => {
        if (!mapRef.current || mapInstance.current) return;

        const initMap = async () => {
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');

            const map = L.map(mapRef.current).setView([9.9930419, 76.3017048], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            }).addTo(map);

            mapInstance.current = map;

            // Add hospital markers
            corridors.forEach(c => {
                if (c.sourceHospital?.location?.coordinates) {
                    const [lng, lat] = c.sourceHospital.location.coordinates;
                    L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'custom-marker',
                            html: '<div style="background:#059669;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏥</div>',
                            iconSize: [30, 30]
                        })
                    }).addTo(map).bindPopup(`<b>${c.sourceHospital.name}</b><br>Source`);
                }
                if (c.destinationHospital?.location?.coordinates) {
                    const [lng, lat] = c.destinationHospital.location.coordinates;
                    L.marker([lat, lng], {
                        icon: L.divIcon({
                            className: 'custom-marker',
                            html: '<div style="background:#3b82f6;color:white;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏥</div>',
                            iconSize: [30, 30]
                        })
                    }).addTo(map).bindPopup(`<b>${c.destinationHospital.name}</b><br>Destination`);
                }
            });
        };

        initMap();
    }, [corridors]);

    const updateMarker = async (corridorId, position) => {
        if (!mapInstance.current) return;
        const L = await import('leaflet');

        if (markersRef.current[corridorId]) {
            // Smooth marker movement via setLatLng
            markersRef.current[corridorId].setLatLng([position.lat, position.lng]);
        } else {
            // First time seeing this ambulance — create a pulsing marker
            const marker = L.marker([position.lat, position.lng], {
                icon: L.divIcon({
                    className: 'ambulance-marker',
                    html: `<div style="background:#ef4444;color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 10px rgba(239,68,68,0.5);animation:pulse-glow 1.5s infinite;">🚑</div>`,
                    iconSize: [34, 34]
                })
            }).addTo(mapInstance.current).bindPopup(`<b>Ambulance</b><br>Corridor: ${corridorId}`);
            markersRef.current[corridorId] = marker;
        }

        // Auto-pan map to follow latest ambulance
        mapInstance.current.panTo([position.lat, position.lng], { animate: true, duration: 0.5 });
    };

    const fetchCorridors = async () => {
        try {
            const res = await controlRoomAPI.getActiveCorridors();
            const corrs = res.data.corridors || [];
            setCorridors(corrs);
            // Join all corridor rooms
            corrs.forEach(c => {
                if (socket) socket.emit('join_corridor', { corridorId: c.corridorId });
            });
        } catch { toast.error('Failed to load corridors'); }
        finally { setLoading(false); }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0', marginBottom: '24px' }}>🗺️ Live Monitoring</h1>

            {/* Map */}
            <div className="glass-card" style={{ padding: '4px', marginBottom: '20px' }}>
                <div ref={mapRef} style={{ width: '100%', height: '450px', borderRadius: '12px' }}></div>
            </div>

            {/* Active corridors sidebar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {corridors.map(c => {
                    const gps = gpsPositions[c.corridorId];
                    return (
                        <div key={c.corridorId} className="glass-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <h4 style={{ fontWeight: '700', color: '#e2e8f0' }}>{c.corridorId}</h4>
                                <span className={`badge badge-${c.status?.toLowerCase()?.replace('_', '-')}`}>{c.status?.replace('_', ' ')}</span>
                            </div>
                            <p style={{ fontSize: '13px', color: '#94a3b8' }}>{c.sourceHospital?.name} → {c.destinationHospital?.name}</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px' }}>
                                <div><span style={{ fontSize: '11px', color: '#64748b' }}>Organ</span><br /><span style={{ fontWeight: '600' }}>{c.organType}</span></div>
                                <div><span style={{ fontSize: '11px', color: '#64748b' }}>ETA</span><br /><span style={{ fontWeight: '600', color: '#10b981' }}>{c.predictedETA ? `${Math.round(c.predictedETA / 60)} min` : '-'}</span></div>
                                <div><span style={{ fontSize: '11px', color: '#64748b' }}>Speed</span><br /><span style={{ fontWeight: '600' }}>{gps?.speed ? `${(gps.speed * 3.6).toFixed(0)} km/h` : '-'}</span></div>
                                <div><span style={{ fontSize: '11px', color: '#64748b' }}>Accuracy</span><br /><span style={{ fontWeight: '600' }}>{gps?.accuracy ? `${gps.accuracy.toFixed(0)}m` : '-'}</span></div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LiveMonitoring;
