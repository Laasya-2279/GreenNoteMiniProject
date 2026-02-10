import { useState, useEffect } from 'react';
import { corridorAPI } from '../../services/api';
import { toast } from 'react-toastify';

const CorridorHistory = () => {
    const [corridors, setCorridors] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const res = await corridorAPI.getAll();
                setCorridors(res.data.corridors || []);
            } catch { toast.error('Failed to load history'); }
            finally { setLoading(false); }
        };
        fetch();
    }, []);

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0', marginBottom: '24px' }}>📋 Corridor History</h1>
            <div className="glass-card" style={{ overflowX: 'auto' }}>
                <table className="data-table">
                    <thead>
                        <tr><th>ID</th><th>Source</th><th>Destination</th><th>Organ</th><th>Urgency</th><th>Status</th><th>Duration</th><th>Date</th></tr>
                    </thead>
                    <tbody>
                        {corridors.map(c => (
                            <tr key={c.corridorId}>
                                <td style={{ fontWeight: '600', color: '#10b981' }}>{c.corridorId}</td>
                                <td>{c.sourceHospital?.name}</td>
                                <td>{c.destinationHospital?.name}</td>
                                <td>{c.organType}</td>
                                <td><span className={`badge ${c.urgencyLevel === 'VERY_CRITICAL' ? 'badge-very-critical' : c.urgencyLevel === 'CRITICAL' ? 'badge-critical' : 'badge-stable'}`}>{c.urgencyLevel?.replace('_', ' ')}</span></td>
                                <td><span className={`badge badge-${c.status?.toLowerCase()?.replace('_', '-')}`}>{c.status?.replace('_', ' ')}</span></td>
                                <td>{c.actualDuration ? `${Math.round(c.actualDuration / 60)} min` : '-'}</td>
                                <td style={{ color: '#94a3b8', fontSize: '13px' }}>{new Date(c.createdAt).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {corridors.length === 0 && <p style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No records found</p>}
            </div>
        </div>
    );
};

export default CorridorHistory;
