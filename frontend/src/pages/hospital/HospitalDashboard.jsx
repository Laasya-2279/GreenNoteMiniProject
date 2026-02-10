import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { corridorAPI, hospitalAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const HospitalDashboard = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({ pending: 0, active: 0, completed: 0, total: 0 });
    const [recentCorridors, setRecentCorridors] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await corridorAPI.getAll();
            const corridors = res.data.corridors || [];
            setRecentCorridors(corridors.slice(0, 5));
            setStats({
                pending: corridors.filter(c => c.status === 'PENDING').length,
                active: corridors.filter(c => ['APPROVED', 'IN_PROGRESS'].includes(c.status)).length,
                completed: corridors.filter(c => c.status === 'COMPLETED').length,
                total: corridors.length
            });
        } catch (err) {
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const getStatusBadge = (status) => {
        const classes = {
            PENDING: 'badge-pending', APPROVED: 'badge-approved',
            IN_PROGRESS: 'badge-in-progress', COMPLETED: 'badge-completed',
            REJECTED: 'badge-critical'
        };
        return <span className={`badge ${classes[status] || ''}`}>{status?.replace('_', ' ')}</span>;
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <div style={{ marginBottom: '24px' }}>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#e2e8f0' }}>Hospital Dashboard</h1>
                <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Welcome, {user?.name} 👋</p>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {[
                    { label: 'Pending', value: stats.pending, icon: '⏳', color: '#f59e0b' },
                    { label: 'Active', value: stats.active, icon: '🚨', color: '#3b82f6' },
                    { label: 'Completed', value: stats.completed, icon: '✅', color: '#059669' },
                    { label: 'Total', value: stats.total, icon: '📊', color: '#8b5cf6' }
                ].map(s => (
                    <div key={s.label} className="stat-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <p style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>{s.label}</p>
                                <p style={{ fontSize: '32px', fontWeight: '800', color: s.color, marginTop: '4px' }}>{s.value}</p>
                            </div>
                            <div style={{ fontSize: '32px', opacity: 0.6 }}>{s.icon}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Quick action */}
            <Link to="/hospital/create" style={{ textDecoration: 'none' }}>
                <div className="glass-card" style={{
                    background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.15), rgba(16, 185, 129, 0.1))',
                    borderColor: 'rgba(5, 150, 105, 0.3)', cursor: 'pointer', marginBottom: '24px',
                    display: 'flex', alignItems: 'center', gap: '16px'
                }}>
                    <div style={{
                        width: '50px', height: '50px', borderRadius: '14px',
                        background: 'linear-gradient(135deg, #059669, #10b981)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px'
                    }}>➕</div>
                    <div>
                        <p style={{ fontWeight: '700', fontSize: '16px', color: '#e2e8f0' }}>Create Green Corridor Request</p>
                        <p style={{ fontSize: '13px', color: '#94a3b8' }}>Request emergency green corridor for organ transport</p>
                    </div>
                </div>
            </Link>

            {/* Recent corridors */}
            <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#e2e8f0' }}>Recent Requests</h3>
                    <Link to="/hospital/history" style={{ color: '#059669', fontSize: '13px', textDecoration: 'none', fontWeight: '600' }}>View All →</Link>
                </div>
                {recentCorridors.length === 0 ? (
                    <p style={{ color: '#64748b', textAlign: 'center', padding: '20px' }}>No corridor requests yet</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Corridor ID</th>
                                    <th>Destination</th>
                                    <th>Organ</th>
                                    <th>Urgency</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentCorridors.map(c => (
                                    <tr key={c.corridorId}>
                                        <td style={{ fontWeight: '600', color: '#10b981' }}>{c.corridorId}</td>
                                        <td>{c.destinationHospital?.name}</td>
                                        <td>{c.organType}</td>
                                        <td>
                                            <span className={`badge ${c.urgencyLevel === 'VERY_CRITICAL' ? 'badge-very-critical' : c.urgencyLevel === 'CRITICAL' ? 'badge-critical' : 'badge-stable'}`}>
                                                {c.urgencyLevel?.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td>{getStatusBadge(c.status)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HospitalDashboard;
