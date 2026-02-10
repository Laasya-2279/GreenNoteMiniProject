import { useState, useEffect } from 'react';
import { ambulanceAPI, corridorAPI } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const AmbulanceDashboard = () => {
    const { user } = useAuth();
    const { connected } = useWebSocket();
    const navigate = useNavigate();
    const [assignedCorridor, setAssignedCorridor] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await corridorAPI.getAll({ status: 'APPROVED' });
                const corridors = res.data.corridors || [];
                // Find corridor assigned to this driver
                const assigned = corridors.find(c =>
                    c.ambulance?.driverId === user?.ambulanceDriverId ||
                    c.status === 'APPROVED' || c.status === 'IN_PROGRESS'
                );
                setAssignedCorridor(assigned);
            } catch { /* no corridor yet */ }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    const handleStart = async () => {
        if (!assignedCorridor) return;
        try {
            await ambulanceAPI.startCorridor(assignedCorridor.corridorId);
            toast.success('Corridor started!');
            navigate(`/ambulance/navigate/${assignedCorridor.corridorId}`);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to start');
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#e2e8f0' }}>🚑 Ambulance Dashboard</h1>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Driver: {user?.name}</p>
            </div>

            {/* Connection status */}
            <div className="stat-card" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: connected ? '#10b981' : '#ef4444', boxShadow: `0 0 8px ${connected ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}` }}></div>
                <span style={{ fontWeight: '600', color: connected ? '#10b981' : '#ef4444' }}>
                    {connected ? 'GPS Connected' : 'GPS Disconnected'}
                </span>
            </div>

            {assignedCorridor ? (
                <div className="glass-card" style={{ borderLeft: '4px solid #ef4444' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                        <div>
                            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#e2e8f0' }}>
                                🚨 Active Assignment
                            </h2>
                            <p style={{ color: '#10b981', fontWeight: '700', fontSize: '16px', marginTop: '4px' }}>
                                {assignedCorridor.corridorId}
                            </p>
                        </div>
                        <span className={`badge ${assignedCorridor.urgencyLevel === 'VERY_CRITICAL' ? 'badge-very-critical' : 'badge-critical'}`}>
                            {assignedCorridor.urgencyLevel?.replace('_', ' ')}
                        </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        <div className="stat-card">
                            <p style={{ fontSize: '12px', color: '#64748b' }}>From</p>
                            <p style={{ fontWeight: '700', color: '#e2e8f0' }}>🏥 {assignedCorridor.sourceHospital?.name}</p>
                        </div>
                        <div className="stat-card">
                            <p style={{ fontSize: '12px', color: '#64748b' }}>To</p>
                            <p style={{ fontWeight: '700', color: '#e2e8f0' }}>🏥 {assignedCorridor.destinationHospital?.name}</p>
                        </div>
                        <div className="stat-card">
                            <p style={{ fontSize: '12px', color: '#64748b' }}>Organ</p>
                            <p style={{ fontWeight: '700', color: '#e2e8f0' }}>🫀 {assignedCorridor.organType}</p>
                        </div>
                        <div className="stat-card">
                            <p style={{ fontSize: '12px', color: '#64748b' }}>ETA</p>
                            <p style={{ fontWeight: '700', color: '#10b981', fontSize: '20px' }}>
                                {assignedCorridor.predictedETA ? `${Math.round(assignedCorridor.predictedETA / 60)} min` : '...'}
                            </p>
                        </div>
                    </div>

                    {assignedCorridor.status === 'IN_PROGRESS' ? (
                        <button
                            onClick={() => navigate(`/ambulance/navigate/${assignedCorridor.corridorId}`)}
                            className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '18px' }}
                        >
                            📍 Open Navigation →
                        </button>
                    ) : (
                        <button
                            onClick={handleStart}
                            className="btn-primary" style={{ width: '100%', padding: '16px', fontSize: '18px', background: 'linear-gradient(135deg, #ef4444, #f87171)' }}
                        >
                            🚀 Start Corridor Transport
                        </button>
                    )}
                </div>
            ) : (
                <div className="glass-card" style={{ textAlign: 'center', padding: '60px' }}>
                    <p style={{ fontSize: '60px', marginBottom: '16px' }}>🚑</p>
                    <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#e2e8f0', marginBottom: '8px' }}>No Active Assignment</h3>
                    <p style={{ color: '#94a3b8', fontSize: '14px' }}>Waiting for corridor assignment...</p>
                </div>
            )}
        </div>
    );
};

export default AmbulanceDashboard;
