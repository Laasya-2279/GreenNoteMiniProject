import { useState, useEffect } from 'react';
import { publicAPI } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { toast } from 'react-toastify';

const PublicView = () => {
    const [corridors, setCorridors] = useState([]);
    const [loading, setLoading] = useState(true);
    const { socket } = useWebSocket();

    useEffect(() => { fetchCorridors(); }, []);

    useEffect(() => {
        if (!socket) return;
        socket.emit('join_public');
        socket.on('public_alert', (data) => {
            toast.info(`🚨 Alert: ${data.message || 'New corridor update'}`, { autoClose: 6000 });
            fetchCorridors();
        });
        socket.on('corridor_status', () => fetchCorridors());
        return () => { socket.off('public_alert'); socket.off('corridor_status'); };
    }, [socket]);

    const fetchCorridors = async () => {
        try {
            const res = await publicAPI.getActiveCorridors();
            setCorridors(res.data.corridors || []);
        } catch { /* public view may fail without data */ }
        finally { setLoading(false); }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#e2e8f0' }}>🌍 Green Corridor Public View</h1>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
                    Active emergency organ transport corridors in your area
                </p>
            </div>

            {/* Alert banner */}
            {corridors.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(245, 158, 11, 0.1))',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '14px', padding: '16px 20px',
                    marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px'
                }}>
                    <span style={{ fontSize: '24px' }}>⚠️</span>
                    <div>
                        <p style={{ fontWeight: '700', color: '#fbbf24' }}>
                            {corridors.length} Active Green Corridor{corridors.length > 1 ? 's' : ''}
                        </p>
                        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
                            Please clear the way for emergency ambulances on these routes
                        </p>
                    </div>
                </div>
            )}

            {/* Corridors */}
            {corridors.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '60px' }}>
                    <p style={{ fontSize: '60px', marginBottom: '16px' }}>✅</p>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#e2e8f0', marginBottom: '8px' }}>All Clear</h3>
                    <p style={{ color: '#94a3b8' }}>No active green corridors at the moment</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {corridors.map(c => (
                        <div key={c.corridorId} className="glass-card" style={{
                            borderLeft: `4px solid ${c.urgencyLevel === 'VERY_CRITICAL' ? '#ef4444' : c.urgencyLevel === 'CRITICAL' ? '#f59e0b' : '#059669'}`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span className={`badge ${c.urgencyLevel === 'VERY_CRITICAL' ? 'badge-very-critical' : c.urgencyLevel === 'CRITICAL' ? 'badge-critical' : 'badge-stable'}`}>
                                            {c.urgencyLevel?.replace('_', ' ')}
                                        </span>
                                        <span style={{ color: '#94a3b8', fontSize: '13px' }}>Emergency Organ Transport</span>
                                    </div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#e2e8f0', marginTop: '12px' }}>
                                        Route Active
                                    </h3>
                                </div>
                            </div>

                            <div style={{
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: '12px', marginTop: '16px'
                            }}>
                                <div>
                                    <p style={{ fontSize: '12px', color: '#64748b' }}>From Area</p>
                                    <p style={{ fontWeight: '600', color: '#e2e8f0' }}>{c.sourceHospital?.name || 'Hospital'}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '12px', color: '#64748b' }}>To Area</p>
                                    <p style={{ fontWeight: '600', color: '#e2e8f0' }}>{c.destinationHospital?.name || 'Hospital'}</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '12px', color: '#64748b' }}>Status</p>
                                    <p style={{ fontWeight: '600', color: '#10b981' }}>🚑 In Transit</p>
                                </div>
                            </div>

                            <div style={{
                                marginTop: '16px', padding: '12px', background: 'rgba(245, 158, 11, 0.1)',
                                borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.2)'
                            }}>
                                <p style={{ fontSize: '13px', color: '#fbbf24', fontWeight: '600' }}>
                                    🚗 Please yield to emergency vehicles on this route
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Info */}
            <div className="glass-card" style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginBottom: '12px' }}>ℹ️ What is a Green Corridor?</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.6' }}>
                    A Green Corridor is a special traffic route created for the emergency transportation of organs for transplant.
                    Traffic signals along the route are cleared to ensure the ambulance reaches the destination hospital as quickly as possible.
                    Please cooperate by yielding to emergency vehicles and avoiding the marked routes.
                </p>
            </div>
        </div>
    );
};

export default PublicView;
