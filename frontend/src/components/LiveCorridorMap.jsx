import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

// Criticality → color mapping
const CRITICALITY_COLORS = {
    STABLE: { primary: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)', label: 'Stable' },
    CRITICAL: { primary: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #fb923c)', label: 'Critical' },
    VERY_CRITICAL: { primary: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #f87171)', label: 'Very Critical' }
};

const SIGNAL_COLORS = { GREEN: '#22c55e', RED: '#ef4444', YELLOW: '#eab308' };

/**
 * LiveCorridorMap — Socket-driven visualization component (no algorithm logic)
 * Listens to `corridor:update` and renders:
 *   - Ambulance marker (pulsing, colored by criticality)
 *   - Corridor polyline (solid/dashed by criticality)
 *   - Traffic signals (green/red circles)
 *   - Source + Destination markers
 *   - ETA display with breakdown
 *   - Reroute + Demo mode indicators
 *   - Signal counts overlay
 */
const LiveCorridorMap = ({ corridorId, height = '500px', sourceLabel, destLabel }) => {
    const { socket, connected, joinCorridor, leaveCorridor } = useWebSocket();
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    const ambulanceMarkerRef = useRef(null);
    const routePolylineRef = useRef(null);
    const signalMarkersRef = useRef([]);
    const endpointMarkersRef = useRef([]);
    const [corridorState, setCorridorState] = useState(null);
    const [eta, setEta] = useState(null);
    const [etaFormatted, setEtaFormatted] = useState('--:--');
    const [remainingDistance, setRemainingDistance] = useState(null);
    const [criticality, setCriticality] = useState('CRITICAL');
    const [rerouted, setRerouted] = useState(false);
    const [demoMode, setDemoMode] = useState(false);

    // Initialize Leaflet map
    useEffect(() => {
        const initMap = async () => {
            if (!mapContainerRef.current || mapInstance.current) return;
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');

            // Fix Leaflet default icon issue
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
                iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png'
            });

            const map = L.map(mapContainerRef.current, {
                center: [10.0, 76.28],
                zoom: 13,
                zoomControl: true,
                attributionControl: true
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19
            }).addTo(map);

            mapInstance.current = map;
        };
        initMap();
        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    // Join/leave corridor socket room
    useEffect(() => {
        if (corridorId && connected) {
            joinCorridor(corridorId);
            return () => leaveCorridor(corridorId);
        }
    }, [corridorId, connected, joinCorridor, leaveCorridor]);

    // Update map elements from corridor:update data
    const updateMap = useCallback(async (data) => {
        if (!mapInstance.current) return;
        const L = await import('leaflet');
        const { position, route, signals, criticality: crit } = data;
        const colors = CRITICALITY_COLORS[crit] || CRITICALITY_COLORS.CRITICAL;

        // 1. Ambulance marker — smooth transition via CSS
        if (position) {
            const latlng = [position.lat, position.lng];
            if (ambulanceMarkerRef.current) {
                ambulanceMarkerRef.current.setLatLng(latlng);
            } else {
                ambulanceMarkerRef.current = L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'live-ambulance-marker',
                        html: `<div style="
                            background: ${colors.primary};
                            color: white;
                            width: 44px; height: 44px;
                            border-radius: 50%;
                            display: flex; align-items: center; justify-content: center;
                            font-size: 22px;
                            border: 3px solid white;
                            box-shadow: 0 0 20px ${colors.primary}80;
                            animation: ambulance-pulse 1.5s infinite;
                            transition: transform 0.3s ease;
                        ">🚑</div>`,
                        iconSize: [44, 44],
                        iconAnchor: [22, 22]
                    }),
                    zIndexOffset: 1000
                }).addTo(mapInstance.current);
            }
            mapInstance.current.panTo(latlng, { animate: true, duration: 0.5 });
        }

        // 2. Route polyline
        if (route?.waypoints?.length > 1) {
            if (routePolylineRef.current) {
                mapInstance.current.removeLayer(routePolylineRef.current);
            }
            routePolylineRef.current = L.polyline(route.waypoints, {
                color: colors.primary,
                weight: 5,
                opacity: 0.85,
                dashArray: crit === 'VERY_CRITICAL' ? '10, 8' : null
            }).addTo(mapInstance.current);

            // Source + Destination markers
            endpointMarkersRef.current.forEach(m => mapInstance.current.removeLayer(m));
            endpointMarkersRef.current = [];

            const start = route.waypoints[0];
            const end = route.waypoints[route.waypoints.length - 1];

            const srcMarker = L.marker(start, {
                icon: L.divIcon({
                    className: '',
                    html: `<div style="
                        background: #22c55e; color: white;
                        width: 32px; height: 32px; border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 14px; border: 2px solid white;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    ">🏥</div>`,
                    iconSize: [32, 32], iconAnchor: [16, 16]
                })
            }).addTo(mapInstance.current).bindPopup(sourceLabel || 'Source Hospital');

            const destMarker = L.marker(end, {
                icon: L.divIcon({
                    className: '',
                    html: `<div style="
                        background: #a855f7; color: white;
                        width: 32px; height: 32px; border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        font-size: 14px; border: 2px solid white;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    ">🏥</div>`,
                    iconSize: [32, 32], iconAnchor: [16, 16]
                })
            }).addTo(mapInstance.current).bindPopup(destLabel || 'Destination Hospital');

            endpointMarkersRef.current.push(srcMarker, destMarker);
        }

        // 3. Signal markers
        signalMarkersRef.current.forEach(m => {
            if (mapInstance.current) mapInstance.current.removeLayer(m);
        });
        signalMarkersRef.current = [];

        if (signals?.length > 0) {
            for (const sig of signals) {
                if (!sig.position) continue;
                const sigColor = SIGNAL_COLORS[sig.state] || SIGNAL_COLORS.RED;
                const marker = L.circleMarker(sig.position, {
                    radius: 8,
                    fillColor: sigColor,
                    fillOpacity: 0.9,
                    color: '#fff',
                    weight: 2
                }).addTo(mapInstance.current).bindPopup(
                    `<b>${sig.name || sig.id}</b><br/>State: <b style="color:${sigColor}">${sig.state}</b>`
                );
                signalMarkersRef.current.push(marker);
            }
        }
    }, [sourceLabel, destLabel]);

    // Listen for corridor:update events
    useEffect(() => {
        if (!socket) return;

        const handleUpdate = (data) => {
            if (data.corridorId !== corridorId) return;
            setCorridorState(data);
            setEta(data.eta);
            setEtaFormatted(data.etaFormatted || formatETA(data.eta));
            setRemainingDistance(data.remainingDistance);
            setCriticality(data.criticality || 'CRITICAL');
            setRerouted(data.rerouted || false);
            setDemoMode(data.demoMode || false);
            updateMap(data);
        };

        socket.on('corridor:update', handleUpdate);

        // Legacy gps_update fallback
        const handleLegacy = (data) => {
            if (data.corridorId !== corridorId) return;
            if (data.eta) {
                setEta(data.eta);
                setEtaFormatted(data.etaFormatted || formatETA(data.eta));
            }
            updateMap({ position: data.position, criticality });
        };
        socket.on('gps_update', handleLegacy);

        return () => {
            socket.off('corridor:update', handleUpdate);
            socket.off('gps_update', handleLegacy);
        };
    }, [socket, corridorId, criticality, updateMap]);

    const colors = CRITICALITY_COLORS[criticality] || CRITICALITY_COLORS.CRITICAL;

    const formatETA = (seconds) => {
        if (!seconds && seconds !== 0) return '--:--';
        const min = Math.floor(seconds / 60);
        const sec = Math.round(seconds % 60);
        return `${min}m ${sec.toString().padStart(2, '0')}s`;
    };

    const formatDistance = (meters) => {
        if (!meters) return '';
        if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
        return `${Math.round(meters)} m`;
    };

    return (
        <div className="live-corridor-map-container" style={{ position: 'relative' }}>
            {/* Map */}
            <div ref={mapContainerRef} style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden' }} />

            {/* Overlay: ETA + Status */}
            <div style={{
                position: 'absolute', top: 12, right: 12, zIndex: 1000,
                background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(10px)',
                borderRadius: '12px', padding: '16px 20px',
                color: 'white', minWidth: '200px',
                border: `1px solid ${colors.primary}40`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}>
                {/* Criticality badge */}
                <div style={{
                    display: 'inline-block',
                    background: colors.gradient,
                    padding: '4px 14px', borderRadius: '20px',
                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.5px', marginBottom: '10px'
                }}>
                    {colors.label}
                </div>

                {/* ETA */}
                <div style={{ fontSize: '30px', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", marginBottom: '2px' }}>
                    {etaFormatted}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.6, marginBottom: '6px' }}>Estimated Arrival</div>

                {/* Remaining distance */}
                {remainingDistance != null && (
                    <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '8px', fontWeight: 500 }}>
                        📍 {formatDistance(remainingDistance)} remaining
                    </div>
                )}

                {/* Rerouted indicator */}
                {rerouted && (
                    <div style={{
                        marginTop: '4px', padding: '5px 10px', borderRadius: '6px',
                        background: 'rgba(249, 115, 22, 0.3)', fontSize: '11px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '4px',
                        border: '1px solid rgba(249, 115, 22, 0.5)'
                    }}>
                        ⚡ Route recalculated
                    </div>
                )}

                {/* Demo mode badge */}
                {demoMode && (
                    <div style={{
                        marginTop: '6px', padding: '4px 10px', borderRadius: '6px',
                        background: 'rgba(168, 85, 247, 0.2)', fontSize: '10px', opacity: 0.8,
                        border: '1px solid rgba(168, 85, 247, 0.4)'
                    }}>
                        🧪 Demo Mode
                    </div>
                )}

                {/* Connection status */}
                <div style={{
                    marginTop: '10px', fontSize: '10px',
                    display: 'flex', alignItems: 'center', gap: '5px'
                }}>
                    <span style={{
                        width: 7, height: 7, borderRadius: '50%',
                        background: connected ? '#22c55e' : '#ef4444',
                        display: 'inline-block',
                        boxShadow: connected ? '0 0 6px #22c55e' : '0 0 6px #ef4444'
                    }} />
                    {connected ? 'Live Connection' : 'Disconnected'}
                </div>
            </div>

            {/* Signal count overlay (bottom-left) */}
            {corridorState?.signals?.length > 0 && (
                <div style={{
                    position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
                    background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)',
                    borderRadius: '10px', padding: '10px 16px',
                    color: 'white', fontSize: '12px',
                    display: 'flex', gap: '14px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
                }}>
                    <span>🟢 {corridorState.signals.filter(s => s.state === 'GREEN').length} Green</span>
                    <span>🔴 {corridorState.signals.filter(s => s.state === 'RED').length} Red</span>
                </div>
            )}

            {/* CSS Animations */}
            <style>{`
                @keyframes ambulance-pulse {
                    0%, 100% { box-shadow: 0 0 12px ${colors.primary}60; transform: scale(1); }
                    50% { box-shadow: 0 0 28px ${colors.primary}90; transform: scale(1.06); }
                }
                .live-ambulance-marker { transition: transform 0.5s ease !important; }
                .leaflet-marker-icon { transition: transform 0.5s ease !important; }
            `}</style>
        </div>
    );
};

export default LiveCorridorMap;
