import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ambulanceAPI, corridorAPI } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { toast } from 'react-toastify';

const NavigationView = () => {
    const { corridorId } = useParams();
    const navigate = useNavigate();
    const { sendGPS, sendGPSUpdate, socket, joinCorridor } = useWebSocket();
    const [corridor, setCorridor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [gpsActive, setGpsActive] = useState(false);
    const [currentPosition, setCurrentPosition] = useState(null);
    const [speed, setSpeed] = useState(0);
    const [clearedSignals, setClearedSignals] = useState([]);
    const [etaCountdown, setEtaCountdown] = useState(null);
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const watchIdRef = useRef(null);
    const ambulanceMarkerRef = useRef(null);

    useEffect(() => {
        fetchCorridor();
        joinCorridor(corridorId);
    }, [corridorId]);

    // Listen for real-time corridor updates (ETA, signals, rerouting)
    useEffect(() => {
        if (!socket) return;

        // corridor:update — live ETA from backend
        socket.on('corridor:update', (data) => {
            if (data.corridorId !== corridorId) return;
            // Update ETA with backend-computed value (polyline-aware + signals + ML)
            if (data.eta != null) setEtaCountdown(data.eta);
        });

        socket.on('signal_cleared', (data) => {
            setClearedSignals(prev => [...prev, data.signalId]);
            toast.success(`🚦 Signal ${data.name || data.signalId} cleared!`, { autoClose: 5000 });
            try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgA').play(); } catch { }
        });
        socket.on('route_updated', (data) => {
            toast.info('🛤️ Route recalculated — deviation detected');
            fetchCorridor(); // Reload to get new waypoints on the map
        });
        return () => {
            socket.off('corridor:update');
            socket.off('signal_cleared');
            socket.off('route_updated');
        };
    }, [socket, corridorId]);

    // Continuous GPS tracking - uses both watchPosition AND a periodic interval
    // watchPosition alone only fires when position actually changes, which means
    // on desktop or when stationary, the marker appears frozen. The interval
    // ensures we poll + emit GPS continuously every 2 seconds.
    useEffect(() => {
        if (!corridor) return;
        if (!('geolocation' in navigator)) return;

        const gpsOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

        const handlePosition = (position) => {
            const pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                speed: position.coords.speed,
                heading: position.coords.heading,
                timestamp: Date.now()
            };
            setCurrentPosition(pos);
            setSpeed(pos.speed || 0);
            setGpsActive(true);

            // Send GPS to server via new event (ambulance:gpsUpdate)
            sendGPSUpdate({ corridorId, lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy, speed: pos.speed, heading: pos.heading });

            // Update marker on map (smooth transition)
            updateAmbulanceMarker(pos);
        };

        const handleError = (error) => {
            console.error('GPS Error:', error);
            setGpsActive(false);
        };

        // 1) watchPosition for instant movement detection
        watchIdRef.current = navigator.geolocation.watchPosition(
            handlePosition, handleError, gpsOptions
        );

        // 2) Periodic polling every 2s to ensure continuous GPS emission
        //    This fixes the "static marker" issue where watchPosition fires once
        const intervalId = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                handlePosition, handleError, gpsOptions
            );
        }, 2000);

        return () => {
            if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
            clearInterval(intervalId);
        };
    }, [corridor, corridorId, sendGPS]);

    // Initialize map
    useEffect(() => {
        if (!mapRef.current || mapInstance.current || !corridor) return;

        const initMap = async () => {
            const L = await import('leaflet');
            await import('leaflet/dist/leaflet.css');

            const srcCoords = corridor.sourceHospital?.location?.coordinates || [76.288166, 9.988078];
            const map = L.map(mapRef.current).setView([srcCoords[1], srcCoords[0]], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(map);

            // Source marker
            if (corridor.sourceHospital?.location) {
                const [lng, lat] = corridor.sourceHospital.location.coordinates;
                L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: '', html: '<div style="background:#059669;color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏥</div>', iconSize: [34, 34]
                    })
                }).addTo(map).bindPopup(`<b>Start:</b> ${corridor.sourceHospital.name}`);
            }

            // Destination marker
            if (corridor.destinationHospital?.location) {
                const [lng, lat] = corridor.destinationHospital.location.coordinates;
                L.marker([lat, lng], {
                    icon: L.divIcon({
                        className: '', html: '<div style="background:#3b82f6;color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">🏁</div>', iconSize: [34, 34]
                    })
                }).addTo(map).bindPopup(`<b>Dest:</b> ${corridor.destinationHospital.name}`);
            }

            // Draw route
            if (corridor.selectedRoute?.waypoints) {
                const routeCoords = corridor.selectedRoute.waypoints.map(wp => [wp[0], wp[1]]);
                L.polyline(routeCoords, { color: '#059669', weight: 5, opacity: 0.8 }).addTo(map);
                map.fitBounds(routeCoords);
            }

            mapInstance.current = map;
        };

        initMap();
    }, [corridor]);

    const updateAmbulanceMarker = async (pos) => {
        if (!mapInstance.current) return;
        const L = await import('leaflet');

        if (ambulanceMarkerRef.current) {
            ambulanceMarkerRef.current.setLatLng([pos.lat, pos.lng]);
        } else {
            ambulanceMarkerRef.current = L.marker([pos.lat, pos.lng], {
                icon: L.divIcon({
                    className: 'ambulance-live-marker', html: '<div style="background:#ef4444;color:white;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid white;box-shadow:0 0 15px rgba(239,68,68,0.5);transition:all 0.5s ease">🚑</div>', iconSize: [40, 40]
                })
            }).addTo(mapInstance.current);
        }
        mapInstance.current.panTo([pos.lat, pos.lng], { animate: true, duration: 0.5 });
    };

    const fetchCorridor = async () => {
        try {
            const res = await corridorAPI.getById(corridorId);
            setCorridor(res.data.corridor);
            if (res.data.corridor?.predictedETA) {
                setEtaCountdown(res.data.corridor.predictedETA);
            }
        } catch { toast.error('Failed to load corridor'); }
        finally { setLoading(false); }
    };

    const handleComplete = async () => {
        if (!confirm('Mark corridor as completed?')) return;
        try {
            await ambulanceAPI.completeCorridor(corridorId);
            toast.success('✅ Corridor completed!');
            navigate('/ambulance');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to complete');
        }
    };

    // ETA countdown
    useEffect(() => {
        if (!etaCountdown) return;
        const interval = setInterval(() => {
            setEtaCountdown(prev => Math.max(0, (prev || 0) - 1));
        }, 1000);
        return () => clearInterval(interval);
    }, [etaCountdown]);

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    return (
        <div className="animate-fadeIn">
            {/* Header with ETA */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#e2e8f0' }}>📍 Navigation</h1>
                    <p style={{ color: '#10b981', fontWeight: '600' }}>{corridorId}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '12px', color: '#64748b' }}>ETA</p>
                    <p style={{ fontSize: '28px', fontWeight: '800', color: etaCountdown < 120 ? '#ef4444' : '#10b981' }}>
                        {etaCountdown ? formatTime(etaCountdown) : '--:--'}
                    </p>
                </div>
            </div>

            {/* Status bar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div className="stat-card" style={{ flex: 1, minWidth: '100px', padding: '12px' }}>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>GPS</p>
                    <p style={{ fontWeight: '700', color: gpsActive ? '#10b981' : '#ef4444' }}>{gpsActive ? '🟢 Active' : '🔴 Inactive'}</p>
                </div>
                <div className="stat-card" style={{ flex: 1, minWidth: '100px', padding: '12px' }}>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>Speed</p>
                    <p style={{ fontWeight: '700', color: '#e2e8f0' }}>{(speed * 3.6).toFixed(0)} km/h</p>
                </div>
                <div className="stat-card" style={{ flex: 1, minWidth: '100px', padding: '12px' }}>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>Signals Cleared</p>
                    <p style={{ fontWeight: '700', color: '#10b981' }}>{clearedSignals.length}</p>
                </div>
                <div className="stat-card" style={{ flex: 1, minWidth: '100px', padding: '12px' }}>
                    <p style={{ fontSize: '11px', color: '#64748b' }}>Accuracy</p>
                    <p style={{ fontWeight: '700', color: '#e2e8f0' }}>{currentPosition?.accuracy ? `${currentPosition.accuracy.toFixed(0)}m` : '--'}</p>
                </div>
            </div>

            {/* Map */}
            <div className="glass-card" style={{ padding: '4px', marginBottom: '16px' }}>
                <div ref={mapRef} style={{ width: '100%', height: '400px', borderRadius: '12px' }}></div>
            </div>

            {/* Route info */}
            <div className="glass-card" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
                            🏥 {corridor?.sourceHospital?.name} → 🏁 {corridor?.destinationHospital?.name}
                        </p>
                        <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                            🫀 {corridor?.organType} | {corridor?.selectedRoute?.distance ? `${(corridor.selectedRoute.distance / 1000).toFixed(1)} km` : '-'}
                        </p>
                    </div>
                    <span className={`badge ${corridor?.urgencyLevel === 'VERY_CRITICAL' ? 'badge-very-critical' : 'badge-critical'}`}>
                        {corridor?.urgencyLevel?.replace('_', ' ')}
                    </span>
                </div>
            </div>

            {/* Complete button */}
            <button onClick={handleComplete} className="btn-primary" style={{
                width: '100%', padding: '16px', fontSize: '16px',
                background: 'linear-gradient(135deg, #059669, #10b981)'
            }}>
                ✅ Mark As Completed
            </button>
        </div>
    );
};

export default NavigationView;
