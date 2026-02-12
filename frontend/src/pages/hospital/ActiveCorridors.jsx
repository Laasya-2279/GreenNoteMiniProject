import { useState, useEffect } from 'react';
import { corridorAPI } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { toast } from 'react-toastify';

const ActiveCorridors = () => {
    const [corridors, setCorridors] = useState([]);
    const [loading, setLoading] = useState(true);
    const { socket } = useWebSocket();

    useEffect(() => {
        fetchCorridors();
    }, []);

    useEffect(() => {
        if (!socket) return;
        socket.on('corridor_status', (data) => {
            fetchCorridors();
            toast.info(`Corridor ${data.corridor?.corridorId}: ${data.type}`);
        });
        return () => socket.off('corridor_status');
    }, [socket]);

    const fetchCorridors = async () => {
        try {
            const res = await corridorAPI.getAll({ status: 'APPROVED' });
            const res2 = await corridorAPI.getAll({ status: 'IN_PROGRESS' });
            setCorridors([...(res.data.corridors || []), ...(res2.data.corridors || [])]);
        } catch (err) {
            toast.error('Failed to load corridors');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0', marginBottom: '24px' }}>🚨 Active Corridors</h1>

            {corridors.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ fontSize: '40px', marginBottom: '12px' }}>🟢</p>
                    <p style={{ color: '#94a3b8', fontSize: '16px' }}>No active corridors</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {corridors.map(c => (
                        <div key={c.corridorId} className="glass-card animate-slideIn" style={{ borderLeft: `4px solid ${c.urgencyLevel === 'VERY_CRITICAL' ? '#ef4444' : c.urgencyLevel === 'CRITICAL' ? '#f59e0b' : '#059669'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                                <div>
                                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#e2e8f0' }}>{c.corridorId}</h3>
                                    <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>
                                        {c.sourceHospital?.name} → {c.destinationHospital?.name}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span className={`badge ${c.urgencyLevel === 'VERY_CRITICAL' ? 'badge-very-critical' : c.urgencyLevel === 'CRITICAL' ? 'badge-critical' : 'badge-stable'}`}>
                                        {c.urgencyLevel?.replace('_', ' ')}
                                    </span>
                                    <span className={`badge badge-${c.status?.toLowerCase()?.replace('_', '-')}`}>
                                        {c.status?.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginTop: '16px' }}>
                                <div><p style={{ color: '#64748b', fontSize: '12px' }}>Organ</p><p style={{ color: '#e2e8f0', fontWeight: '600' }}>{c.organType}</p></div>
                                <div><p style={{ color: '#64748b', fontSize: '12px' }}>ETA</p><p style={{ color: '#e2e8f0', fontWeight: '600' }}>{c.predictedETA ? `${Math.round(c.predictedETA / 60)} min` : 'Awaiting GPS...'}</p></div>
                                <div><p style={{ color: '#64748b', fontSize: '12px' }}>Driver</p><p style={{ color: '#e2e8f0', fontWeight: '600' }}>{c.ambulance?.driverName || 'Unassigned'}</p></div>
                                <div><p style={{ color: '#64748b', fontSize: '12px' }}>Distance</p><p style={{ color: '#e2e8f0', fontWeight: '600' }}>{c.selectedRoute?.distance ? `${(c.selectedRoute.distance / 1000).toFixed(1)} km` : '-'}</p></div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ActiveCorridors;
