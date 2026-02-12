import { useState, useEffect, useRef, useCallback } from 'react';
import { useWebSocket } from '../context/WebSocketContext';

// Criticality → color mapping
const CRITICALITY_COLORS = {
    STABLE: { primary: '#3b82f6', gradient: 'linear-gradient(135deg, #3b82f6, #60a5fa)', label: 'Stable' },
    CRITICAL: { primary: '#f97316', gradient: 'linear-gradient(135deg, #f97316, #fb923c)', label: 'Critical' },
    VERY_CRITICAL: { primary: '#ef4444', gradient: 'linear-gradient(135deg, #ef4444, #f87171)', label: 'Very Critical' }
};

// Signal state → color
const SIGNAL_COLORS = { GREEN: '#22c55e', RED: '#ef4444', YELLOW: '#eab308' };

/**
 * LiveCorridorMap — Socket-driven visualization only (zero algorithm logic)
 * Listens to `corridor:update` and renders:
 *   - Ambulance marker
 *   - Corridor polyline (colored by criticality)
 *   - Traffic signals
 *   - ETA display
 *
 * @param {{ corridorId: string, height?: string }} props
 */
const LiveCorridorMap = ({ corridorId, height = '500px' }) => {
    const { socket, connected, joinCorridor, leaveCorridor } = useWebSocket();
    const mapContainerRef = useRef(null);
    const mapInstance = useRef(null);
    const ambulanceMarkerRef = useRef(null);
    const routePolylineRef = useRef(null);
    const signalMarkersRef = useRef([]);
    const [corridorState, setCorridorState] = useState(null);
    const [eta, setEta] = useState(null);
    const [criticality, setCriticality] = useState('CRITICAL');
    const [rerouted, setRerouted] = useState(false);
    const [demoMode, setDemoMode] = useState(false);

    // Initialize Leaflet map
    useEffect(() => {
        const initMap = async () => {
            if (!mapContainerRef.current || mapInstance.current) return;
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');

            const map = L.map(mapContainerRef.current, {
                center: [10.0, 76.28],
                zoom: 13,
                zoomControl: true,
                attributionControl: true
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
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

    // Update map elements from corridor state
    const updateMap = useCallback(async (data) => {
        if (!mapInstance.current) return;
        const L = await import('leaflet');

        const { position, route, signals, criticality: crit } = data;
        const colors = CRITICALITY_COLORS[crit] || CRITICALITY_COLORS.CRITICAL;

        // 1. Ambulance marker
        if (position) {
            if (ambulanceMarkerRef.current) {
                ambulanceMarkerRef.current.setLatLng([position.lat, position.lng]);
            } else {
                ambulanceMarkerRef.current = L.marker([position.lat, position.lng], {
                    icon: L.divIcon({
                        className: 'live-ambulance-marker',
                        html: `<div style="
                            background: ${colors.primary};
                            color: white;
                            width: 42px; height: 42px;
                            border-radius: 50%;
                            display: flex; align-items: center; justify-content: center;
                            font-size: 22px;
                            border: 3px solid white;
                            box-shadow: 0 0 20px ${colors.primary}80;
                            animation: pulse-glow 1.5s infinite;
                        ">🚑</div>`,
                        iconSize: [42, 42]
                    })
                }).addTo(mapInstance.current);
            }
            mapInstance.current.panTo([position.lat, position.lng], { animate: true, duration: 0.5 });
        }

        // 2. Route polyline (colored by criticality)
        if (route?.waypoints?.length > 1) {
            if (routePolylineRef.current) {
                mapInstance.current.removeLayer(routePolylineRef.current);
            }
            routePolylineRef.current = L.polyline(route.waypoints, {
                color: colors.primary,
                weight: 5,
                opacity: 0.85,
                dashArray: crit === 'VERY_CRITICAL' ? '10, 8' : null,
                className: 'corridor-route'
            }).addTo(mapInstance.current);
        }

        // 3. Signal markers
        signalMarkersRef.current.forEach(m => mapInstance.current.removeLayer(m));
        signalMarkersRef.current = [];

        if (signals?.length > 0) {
            for (const sig of signals) {
                const sigColor = SIGNAL_COLORS[sig.state] || SIGNAL_COLORS.RED;
                const marker = L.circleMarker(sig.position, {
                    radius: 8,
                    fillColor: sigColor,
                    fillOpacity: 0.9,
                    color: '#fff',
                    weight: 2
                }).addTo(mapInstance.current).bindPopup(`<b>${sig.name || sig.id}</b><br>State: ${sig.state}`);
                signalMarkersRef.current.push(marker);
            }
        }
    }, []);

    // Listen for corridor:update events
    useEffect(() => {
        if (!socket) return;

        const handleUpdate = (data) => {
            if (data.corridorId !== corridorId) return;
            setCorridorState(data);
            setEta(data.eta);
            setCriticality(data.criticality || 'CRITICAL');
            setRerouted(data.rerouted || false);
            setDemoMode(data.demoMode || false);
            updateMap(data);
        };

        socket.on('corridor:update', handleUpdate);

        // Also listen to legacy gps_update for backward compat
        socket.on('gps_update', (data) => {
            if (data.corridorId !== corridorId) return;
            updateMap({ position: data.position, criticality });
        });

        return () => {
            socket.off('corridor:update', handleUpdate);
            socket.off('gps_update');
        };
    }, [socket, corridorId, criticality, updateMap]);

    const colors = CRITICALITY_COLORS[criticality] || CRITICALITY_COLORS.CRITICAL;

    const formatETA = (seconds) => {
        if (!seconds) return '--:--';
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}m ${sec}s`;
    };

    return (
        <div className="live-corridor-map-container" style={{ position: 'relative' }}>
            {/* Map */}
            <div ref={mapContainerRef} style={{ height, width: '100%', borderRadius: '12px', overflow: 'hidden' }} />

            {/* Overlay: ETA + Status */}
            <div style={{
                position: 'absolute', top: 12, right: 12, zIndex: 1000,
                background: 'rgba(15, 23, 42, 0.92)', backdropFilter: 'blur(10px)',
                borderRadius: '12px', padding: '14px 18px',
                color: 'white', minWidth: '180px',
                border: `1px solid ${colors.primary}40`
            }}>
                {/* Criticality badge */}
                <div style={{
                    display: 'inline-block',
                    background: colors.gradient,
                    padding: '4px 12px', borderRadius: '20px',
                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.5px', marginBottom: '8px'
                }}>
                    {colors.label}
                </div>

                {/* ETA */}
                <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'monospace', marginBottom: '4px' }}>
                    {formatETA(eta)}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.7 }}>Estimated Arrival</div>

                {/* Rerouted indicator */}
                {rerouted && (
                    <div style={{
                        marginTop: '8px', padding: '4px 8px', borderRadius: '6px',
                        background: '#f97316', fontSize: '10px', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                        ⚡ Route recalculated
                    </div>
                )}

                {/* Demo mode badge */}
                {demoMode && (
                    <div style={{
                        marginTop: '6px', padding: '3px 8px', borderRadius: '6px',
                        background: 'rgba(168, 85, 247, 0.3)', fontSize: '10px', opacity: 0.8,
                        border: '1px solid rgba(168, 85, 247, 0.5)'
                    }}>
                        Demo Mode
                    </div>
                )}

                {/* Connection status */}
                <div style={{
                    marginTop: '8px', fontSize: '10px',
                    display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                    <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: connected ? '#22c55e' : '#ef4444',
                        display: 'inline-block'
                    }} />
                    {connected ? 'Live' : 'Disconnected'}
                </div>
            </div>

            {/* Signal count overlay */}
            {corridorState?.signals?.length > 0 && (
                <div style={{
                    position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
                    background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)',
                    borderRadius: '10px', padding: '10px 14px',
                    color: 'white', fontSize: '12px',
                    display: 'flex', gap: '12px'
                }}>
                    <span>
                        <span style={{ color: '#22c55e' }}>●</span>{' '}
                        {corridorState.signals.filter(s => s.state === 'GREEN').length} Green
                    </span>
                    <span>
                        <span style={{ color: '#ef4444' }}>●</span>{' '}
                        {corridorState.signals.filter(s => s.state === 'RED').length} Red
                    </span>
                </div>
            )}

            {/* Keyframe animation */}
            <style>{`
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 10px ${colors.primary}60; transform: scale(1); }
                    50% { box-shadow: 0 0 25px ${colors.primary}90; transform: scale(1.05); }
                }
                .corridor-route { transition: stroke 0.5s ease; }
            `}</style>
        </div>
    );
};

export default LiveCorridorMap;
