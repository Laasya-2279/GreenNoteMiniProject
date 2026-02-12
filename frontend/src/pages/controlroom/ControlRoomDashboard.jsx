import { useState, useEffect } from 'react';
import { controlRoomAPI } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';

const ControlRoomDashboard = () => {
    const { user } = useAuth();
    const { socket, connected } = useWebSocket();
    const [pending, setPending] = useState([]);
    const [active, setActive] = useState([]);
    const [liveETAs, setLiveETAs] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchAll(); }, []);

    useEffect(() => {
        if (!socket) return;

        // Listen for corridor lifecycle events
        socket.on('corridor_status', () => fetchAll());

        // Listen for LIVE corridor updates from backend
        // This provides real-time ETA, not stale DB value
        socket.on('corridor:update', (data) => {
            if (data.eta != null) {
                setLiveETAs(prev => ({
                    ...prev,
                    [data.corridorId]: {
                        eta: data.eta,
                        etaFormatted: data.etaFormatted,
                        rerouted: data.rerouted
                    }
                }));
            }
        });

        return () => {
            socket.off('corridor_status');
            socket.off('corridor:update');
        };
    }, [socket]);

    const fetchAll = async () => {
        try {
            const [pRes, aRes] = await Promise.all([
                controlRoomAPI.getPendingRequests(),
                controlRoomAPI.getActiveCorridors()
            ]);
            setPending(pRes.data.requests || []);
            setActive(aRes.data.corridors || []);
        } catch { toast.error('Failed to load data'); }
        finally { setLoading(false); }
    };

    // Cleanup stale corridors (mark old ones as COMPLETED)
    const handleCleanup = async () => {
        try {
            const res = await controlRoomAPI.cleanupCorridors();
            const count = res.data?.cleaned || 0;
            if (count > 0) {
                toast.success(`🧹 Cleaned ${count} stale corridor(s)`);
                fetchAll();
            } else {
                toast.info('No stale corridors to clean');
            }
        } catch {
            toast.error('Cleanup failed');
        }
    };

    // Get display ETA — prefer live socket value, fallback to DB value
    const getETADisplay = (corridor) => {
        const live = liveETAs[corridor.corridorId];
        if (live?.etaFormatted) return live.etaFormatted;
        if (live?.eta) return `${Math.round(live.eta / 60)} min`;
        if (corridor.predictedETA) return `ETA: ${Math.round(corridor.predictedETA / 60)} min`;
        return 'Awaiting GPS...';
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#e2e8f0' }}>Control Room</h1>
                    <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Welcome, {user?.name}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                            width: '10px', height: '10px', borderRadius: '50%',
                            background: connected ? '#10b981' : '#ef4444',
                            boxShadow: connected ? '0 0 8px #10b981' : '0 0 8px #ef4444'
                        }}></div>
                        <span style={{ fontSize: '13px', color: connected ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                            {connected ? 'Live' : 'Reconnecting...'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Pending', value: pending.length, icon: '📥', color: '#f59e0b' },
                    { label: 'Active', value: active.length, icon: '🚨', color: '#3b82f6' },
                    { label: 'WS Status', value: connected ? 'Live' : 'Off', icon: connected ? '📡' : '🔌', color: connected ? '#10b981' : '#ef4444' }
                ].map(s => (
                    <div key={s.label} className="stat-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ fontSize: '12px', color: '#94a3b8' }}>{s.label}</p>
                                <p style={{ fontSize: '28px', fontWeight: '800', color: s.color }}>{s.value}</p>
                            </div>
                            <span style={{ fontSize: '28px', opacity: 0.6 }}>{s.icon}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pending Requests */}
            <div className="glass-card" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#e2e8f0' }}>📥 Pending Requests ({pending.length})</h3>
                    <Link to="/controlroom/requests" style={{ color: '#059669', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>View All →</Link>
                </div>
                {pending.length === 0 ? (
                    <p style={{ color: '#64748b', textAlign: 'center', padding: '16px' }}>No pending requests</p>
                ) : (
                    pending.slice(0, 3).map(c => (
                        <div key={c.corridorId} style={{ padding: '12px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '10px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontWeight: '600', color: '#10b981' }}>{c.corridorId}</span>
                                <span style={{ color: '#94a3b8', marginLeft: '12px', fontSize: '13px' }}>{c.sourceHospital?.name} → {c.destinationHospital?.name}</span>
                            </div>
                            <span className={`badge ${c.urgencyLevel === 'VERY_CRITICAL' ? 'badge-very-critical' : 'badge-critical'}`}>{c.urgencyLevel?.replace('_', ' ')}</span>
                        </div>
                    ))
                )}
            </div>

            {/* Active Corridors */}
            <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#e2e8f0' }}>🗺️ Active Corridors ({active.length})</h3>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {active.length > 3 && (
                            <button onClick={handleCleanup} style={{
                                padding: '4px 10px', background: 'rgba(239, 68, 68, 0.15)',
                                color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600'
                            }}>
                                🧹 Cleanup stale
                            </button>
                        )}
                        <Link to="/controlroom/monitoring" style={{ color: '#059669', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>Live Map →</Link>
                    </div>
                </div>
                {active.length === 0 ? (
                    <p style={{ color: '#64748b', textAlign: 'center', padding: '16px' }}>No active corridors</p>
                ) : (
                    active.map(c => {
                        const etaDisplay = getETADisplay(c);
                        const borderColor = c.urgencyLevel === 'VERY_CRITICAL' ? '#ef4444' : c.urgencyLevel === 'CRITICAL' ? '#f97316' : '#3b82f6';
                        return (
                            <div key={c.corridorId} style={{
                                padding: '12px', background: 'rgba(15, 23, 42, 0.5)',
                                borderRadius: '10px', marginBottom: '8px',
                                borderLeft: `3px solid ${borderColor}`
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{c.corridorId}</span>
                                        <span style={{ color: '#94a3b8', marginLeft: '8px', fontSize: '13px' }}>{c.organType}</span>
                                    </div>
                                    <span style={{
                                        color: liveETAs[c.corridorId] ? '#10b981' : '#93c5fd',
                                        fontWeight: '700', fontSize: '14px'
                                    }}>
                                        {etaDisplay}
                                    </span>
                                </div>
                                {liveETAs[c.corridorId]?.rerouted && (
                                    <span style={{ fontSize: '10px', color: '#f97316', marginTop: '2px', display: 'block' }}>⚡ Rerouted</span>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default ControlRoomDashboard;
