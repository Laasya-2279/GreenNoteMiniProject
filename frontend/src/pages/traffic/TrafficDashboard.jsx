import { useState, useEffect } from 'react';
import { trafficAPI } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const TrafficDashboard = () => {
    const { user } = useAuth();
    const { socket, connected } = useWebSocket();
    const [corridors, setCorridors] = useState([]);
    const [signals, setSignals] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchAll(); }, []);

    useEffect(() => {
        if (!socket) return;
        socket.on('corridor_status', () => fetchAll());
        socket.on('signal_cleared', (data) => {
            toast.info(`🚦 Signal ${data.signalId} → ${data.state}`);
            fetchAll();
        });
        return () => { socket.off('corridor_status'); socket.off('signal_cleared'); };
    }, [socket]);

    const fetchAll = async () => {
        try {
            const [cRes, sRes] = await Promise.all([
                trafficAPI.getActiveCorridors(),
                trafficAPI.getSignals()
            ]);
            setCorridors(cRes.data.corridors || []);
            setSignals(sRes.data.signals || []);
        } catch { toast.error('Failed to load data'); }
        finally { setLoading(false); }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#e2e8f0' }}>🚦 Traffic Department</h1>
                    <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>{user?.name}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: connected ? '#10b981' : '#ef4444' }}></div>
                    <span style={{ fontSize: '13px', color: connected ? '#10b981' : '#ef4444', fontWeight: '600' }}>{connected ? 'Live' : 'Offline'}</span>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Active Corridors', value: corridors.length, icon: '🚨', color: '#ef4444' },
                    { label: 'Total Signals', value: signals.length, icon: '🚦', color: '#f59e0b' },
                    { label: 'Overridden', value: signals.filter(s => s.overriddenBy).length, icon: '🟢', color: '#10b981' },
                    { label: 'Operational', value: signals.filter(s => s.isOperational).length, icon: '⚡', color: '#3b82f6' }
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

            {/* Active corridors */}
            <div className="glass-card" style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#e2e8f0', marginBottom: '16px' }}>🚨 Active Corridors</h3>
                {corridors.length === 0 ? (
                    <p style={{ color: '#64748b', textAlign: 'center', padding: '16px' }}>No active corridors</p>
                ) : (
                    corridors.map(c => (
                        <div key={c.corridorId} style={{ padding: '12px', background: 'rgba(15,23,42,0.5)', borderRadius: '10px', marginBottom: '8px', borderLeft: `3px solid ${c.urgencyLevel === 'VERY_CRITICAL' ? '#ef4444' : '#f59e0b'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontWeight: '600', color: '#10b981' }}>{c.corridorId}</span>
                                    <span style={{ color: '#94a3b8', fontSize: '13px', marginLeft: '12px' }}>
                                        {c.sourceHospital?.name} → {c.destinationHospital?.name}
                                    </span>
                                </div>
                                <span className={`badge ${c.urgencyLevel === 'VERY_CRITICAL' ? 'badge-very-critical' : 'badge-critical'}`}>
                                    {c.urgencyLevel?.replace('_', ' ')}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Signal status */}
            <div className="glass-card">
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#e2e8f0', marginBottom: '16px' }}>🚦 Signal Status</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                    {signals.map(s => (
                        <div key={s.signalId} className="stat-card" style={{ borderLeft: `3px solid ${s.currentState === 'GREEN' ? '#10b981' : s.currentState === 'RED' ? '#ef4444' : '#f59e0b'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <p style={{ fontWeight: '600', color: '#e2e8f0' }}>{s.name}</p>
                                    <p style={{ fontSize: '12px', color: '#64748b' }}>{s.signalId} | {s.zone}</p>
                                </div>
                                <div style={{
                                    width: '24px', height: '24px', borderRadius: '50%',
                                    background: s.currentState === 'GREEN' ? '#10b981' : s.currentState === 'RED' ? '#ef4444' : '#f59e0b',
                                    boxShadow: `0 0 10px ${s.currentState === 'GREEN' ? 'rgba(16,185,129,0.5)' : s.currentState === 'RED' ? 'rgba(239,68,68,0.5)' : 'rgba(245,158,11,0.5)'}`
                                }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TrafficDashboard;
