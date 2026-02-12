import { useState, useEffect, useRef } from 'react';
import { trafficAPI } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { toast } from 'react-toastify';

const CRITICALITY_COLORS = {
    STABLE: '#3b82f6',
    CRITICAL: '#f97316',
    VERY_CRITICAL: '#ef4444'
};

const ActiveCorridorsMap = () => {
    const [corridors, setCorridors] = useState([]);
    const [loading, setLoading] = useState(true);
    const { socket } = useWebSocket();
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const layersRef = useRef([]); // Track all layers for cleanup

    useEffect(() => {
        fetchCorridors();
    }, []);

    // Listen for corridor status changes (complete/cancel) to refresh map
    useEffect(() => {
        if (!socket) return;
        socket.on('corridor_status', () => {
            fetchCorridors();
        });
        socket.on('corridor:update', (data) => {
            // Live GPS update — update ambulance marker position
            updateAmbulanceOnMap(data.corridorId, data.position);
        });
        return () => {
            socket.off('corridor_status');
            socket.off('corridor:update');
        };
    }, [socket]);

    const fetchCorridors = async () => {
        try {
            const res = await trafficAPI.getActiveCorridors();
            const corrs = res.data.corridors || [];
            setCorridors(corrs);
            // Redraw map with fresh data
            drawCorridors(corrs);
        } catch {
            toast.error('Failed to load corridors');
        } finally {
            setLoading(false);
        }
    };

    const initMap = async () => {
        if (!mapRef.current) return null;
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');

        // Fix Leaflet icon issue
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
            iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
            iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
        });

        const map = L.map(mapRef.current, {
            center: [9.9930419, 76.3017048],
            zoom: 12,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
        }).addTo(map);

        mapInstance.current = map;
        return map;
    };

    const drawCorridors = async (corrs) => {
        if (!mapRef.current) return;
        const L = await import('leaflet');

        // Initialize map if not yet done
        if (!mapInstance.current) {
            await initMap();
        }
        const map = mapInstance.current;
        if (!map) return;

        // CRITICAL: Remove ALL old layers before redrawing
        // This prevents the "spaghetti routes" issue
        layersRef.current.forEach(layer => {
            try { map.removeLayer(layer); } catch { }
        });
        layersRef.current = [];

        const allBounds = [];

        corrs.forEach((c, idx) => {
            const color = CRITICALITY_COLORS[c.urgencyLevel] || CRITICALITY_COLORS.CRITICAL;

            // Source marker
            if (c.sourceHospital?.location?.coordinates) {
                const [lng, lat] = c.sourceHospital.location.coordinates;
                const marker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: '',
                        html: `<div style="
                            background: #22c55e; color: white;
                            width: 30px; height: 30px; border-radius: 50%;
                            display: flex; align-items: center; justify-content: center;
                            font-size: 14px; border: 2px solid white;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        ">🏥</div>`,
                        iconSize: [30, 30], iconAnchor: [15, 15]
                    })
                }).addTo(map).bindPopup(`<b>${c.sourceHospital.name}</b><br/>Source — ${c.corridorId}`);
                layersRef.current.push(marker);
                allBounds.push([lat, lng]);
            }

            // Destination marker
            if (c.destinationHospital?.location?.coordinates) {
                const [lng, lat] = c.destinationHospital.location.coordinates;
                const marker = L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: '',
                        html: `<div style="
                            background: #a855f7; color: white;
                            width: 30px; height: 30px; border-radius: 50%;
                            display: flex; align-items: center; justify-content: center;
                            font-size: 14px; border: 2px solid white;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                        ">🏁</div>`,
                        iconSize: [30, 30], iconAnchor: [15, 15]
                    })
                }).addTo(map).bindPopup(
                    `<b>${c.destinationHospital.name}</b><br/>Destination — ${c.corridorId}<br/><span style="color:${color}">${c.urgencyLevel?.replace('_', ' ')}</span>`
                );
                layersRef.current.push(marker);
                allBounds.push([lat, lng]);
            }

            // Route polyline — each corridor gets its own color
            if (c.selectedRoute?.waypoints?.length > 1) {
                const routeCoords = c.selectedRoute.waypoints.map(w => [w[0], w[1]]);
                const polyline = L.polyline(routeCoords, {
                    color: color,
                    weight: 4,
                    opacity: 0.8,
                    dashArray: c.urgencyLevel === 'VERY_CRITICAL' ? '10, 6' : null
                }).addTo(map).bindPopup(
                    `<b>${c.corridorId}</b><br/>${c.sourceHospital?.name} → ${c.destinationHospital?.name}<br/>${c.urgencyLevel?.replace('_', ' ')}`
                );
                layersRef.current.push(polyline);

                routeCoords.forEach(coord => allBounds.push(coord));
            }
        });

        // Fit map to show all corridors
        if (allBounds.length > 0) {
            try {
                map.fitBounds(allBounds, { padding: [30, 30], maxZoom: 14 });
            } catch { }
        }
    };

    const updateAmbulanceOnMap = async (corridorId, position) => {
        if (!mapInstance.current || !position) return;
        // Ambulance positions on the traffic map are handled by corridor:update
        // For now, just refresh corridors on significant updates
    };

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
            <div className="spinner"></div>
        </div>
    );

    return (
        <div className="animate-fadeIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0' }}>🗺️ Active Corridors Map</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                        {corridors.length} corridor{corridors.length !== 1 ? 's' : ''} active
                    </span>
                    <button
                        onClick={fetchCorridors}
                        style={{
                            padding: '8px 16px', background: 'rgba(16, 185, 129, 0.2)',
                            color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)',
                            borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600'
                        }}
                    >
                        🔄 Refresh
                    </button>
                </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {Object.entries(CRITICALITY_COLORS).map(([key, color]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
                        <div style={{ width: 12, height: 4, background: color, borderRadius: 2 }} />
                        {key.replace('_', ' ')}
                    </div>
                ))}
            </div>

            <div className="glass-card" style={{ padding: '4px' }}>
                <div ref={mapRef} style={{ width: '100%', height: '550px', borderRadius: '12px' }}></div>
            </div>

            {/* Corridor list below map */}
            {corridors.length > 0 && (
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                    {corridors.map(c => (
                        <div key={c.corridorId} className="glass-card" style={{
                            borderLeft: `4px solid ${CRITICALITY_COLORS[c.urgencyLevel] || '#3b82f6'}`,
                            padding: '12px 16px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '700', color: '#e2e8f0', fontSize: '13px' }}>{c.corridorId}</span>
                                <span style={{
                                    fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                                    background: c.status === 'IN_PROGRESS' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                    color: c.status === 'IN_PROGRESS' ? '#60a5fa' : '#fbbf24',
                                    fontWeight: '600'
                                }}>
                                    {c.status?.replace('_', ' ')}
                                </span>
                            </div>
                            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                                {c.sourceHospital?.name} → {c.destinationHospital?.name}
                            </p>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '11px', color: '#64748b' }}>
                                <span>🫀 {c.organType}</span>
                                <span>📏 {c.selectedRoute?.distance ? `${(c.selectedRoute.distance / 1000).toFixed(1)} km` : '-'}</span>
                                <span>⏱️ {c.predictedETA ? `${Math.round(c.predictedETA / 60)} min` : '-'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ActiveCorridorsMap;
