import { useState, useEffect } from 'react';
import { controlRoomAPI } from '../../services/api';
import { toast } from 'react-toastify';

const RequestQueue = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    useEffect(() => { fetchRequests(); }, []);

    const fetchRequests = async () => {
        try {
            const res = await controlRoomAPI.getPendingRequests();
            setRequests(res.data.requests || []);
        } catch { toast.error('Failed to load requests'); }
        finally { setLoading(false); }
    };

    const handleApprove = async (corridorId, urgency) => {
        setActionLoading(corridorId);
        try {
            await controlRoomAPI.approve(corridorId, { urgencyLevel: urgency });
            toast.success(`✅ Corridor ${corridorId} approved`);
            fetchRequests();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Approval failed');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (corridorId) => {
        const reason = prompt('Rejection reason:');
        if (!reason) return;
        setActionLoading(corridorId);
        try {
            await controlRoomAPI.reject(corridorId, { reason });
            toast.success(`Corridor ${corridorId} rejected`);
            fetchRequests();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Rejection failed');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0', marginBottom: '24px' }}>📥 Request Queue</h1>

            {requests.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
                    <p style={{ fontSize: '40px', marginBottom: '12px' }}>✅</p>
                    <p style={{ color: '#94a3b8', fontSize: '16px' }}>No pending requests</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '16px' }}>
                    {requests.map(c => (
                        <div key={c.corridorId} className="glass-card animate-slideIn" style={{ borderLeft: `4px solid ${c.urgencyLevel === 'VERY_CRITICAL' ? '#ef4444' : c.urgencyLevel === 'CRITICAL' ? '#f59e0b' : '#059669'}` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#e2e8f0' }}>{c.corridorId}</h3>
                                        <span className={`badge ${c.urgencyLevel === 'VERY_CRITICAL' ? 'badge-very-critical' : c.urgencyLevel === 'CRITICAL' ? 'badge-critical' : 'badge-stable'}`}>
                                            {c.urgencyLevel?.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '6px' }}>
                                        📍 {c.sourceHospital?.name} → {c.destinationHospital?.name}
                                    </p>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '16px', marginBottom: '16px' }}>
                                <div><p style={{ color: '#64748b', fontSize: '12px' }}>Organ</p><p style={{ color: '#e2e8f0', fontWeight: '600' }}>🫀 {c.organType}</p></div>
                                <div><p style={{ color: '#64748b', fontSize: '12px' }}>Driver</p><p style={{ color: '#e2e8f0', fontWeight: '600' }}>{c.ambulance?.driverName || 'Unassigned'}</p></div>
                                <div><p style={{ color: '#64748b', fontSize: '12px' }}>Vehicle</p><p style={{ color: '#e2e8f0', fontWeight: '600' }}>{c.ambulance?.vehicleNumber || '-'}</p></div>
                                <div><p style={{ color: '#64748b', fontSize: '12px' }}>Requested By</p><p style={{ color: '#e2e8f0', fontWeight: '600' }}>{c.requestedBy?.name || '-'}</p></div>
                            </div>

                            {/* Urgency selection + actions */}
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <select
                                    defaultValue={c.urgencyLevel}
                                    id={`urgency-${c.corridorId}`}
                                    className="select-field"
                                    style={{ width: 'auto', flex: '0 0 200px' }}
                                >
                                    <option value="STABLE">🟢 Stable</option>
                                    <option value="CRITICAL">🟡 Critical</option>
                                    <option value="VERY_CRITICAL">🔴 Very Critical</option>
                                </select>
                                <button
                                    onClick={() => {
                                        const urgency = document.getElementById(`urgency-${c.corridorId}`).value;
                                        handleApprove(c.corridorId, urgency);
                                    }}
                                    className="btn-primary"
                                    disabled={actionLoading === c.corridorId}
                                    style={{ padding: '10px 24px' }}
                                >
                                    {actionLoading === c.corridorId ? '⏳' : '✅'} Approve
                                </button>
                                <button
                                    onClick={() => handleReject(c.corridorId)}
                                    className="btn-danger"
                                    disabled={actionLoading === c.corridorId}
                                >
                                    ❌ Reject
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default RequestQueue;
