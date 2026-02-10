import { useState, useEffect } from 'react';
import { controlRoomAPI } from '../../services/api';
import { toast } from 'react-toastify';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1 });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    useEffect(() => { fetchLogs(); }, [pagination.page, filter]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const params = { page: pagination.page, limit: 20 };
            if (filter) params.action = filter;
            const res = await controlRoomAPI.getAuditLogs(params);
            setLogs(res.data.logs || []);
            setPagination(res.data.pagination || { page: 1, pages: 1 });
        } catch { toast.error('Failed to load logs'); }
        finally { setLoading(false); }
    };

    const getActionColor = (action) => {
        if (action.includes('APPROVED')) return '#10b981';
        if (action.includes('REJECTED') || action.includes('ERROR')) return '#ef4444';
        if (action.includes('CREATED') || action.includes('STARTED')) return '#3b82f6';
        if (action.includes('COMPLETED')) return '#059669';
        if (action.includes('SIGNAL')) return '#f59e0b';
        return '#94a3b8';
    };

    return (
        <div className="animate-fadeIn">
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0', marginBottom: '24px' }}>📜 Audit Logs</h1>

            {/* Filter */}
            <div className="glass-card" style={{ marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="select-field" style={{ width: 'auto' }} value={filter} onChange={(e) => { setFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}>
                    <option value="">All Actions</option>
                    {['CORRIDOR_CREATED', 'CORRIDOR_APPROVED', 'CORRIDOR_REJECTED', 'CORRIDOR_STARTED', 'CORRIDOR_COMPLETED', 'SIGNAL_OVERRIDE', 'USER_LOGIN', 'MODEL_UPDATED'].map(a => (
                        <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                    ))}
                </select>
                <button onClick={fetchLogs} className="btn-outline" style={{ padding: '10px 16px' }}>🔄 Refresh</button>
            </div>

            {/* Logs */}
            <div className="glass-card" style={{ overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '30px' }}><div className="spinner"></div></div>
                ) : (
                    <>
                        <table className="data-table">
                            <thead><tr><th>Timestamp</th><th>Action</th><th>User</th><th>Corridor</th><th>Details</th></tr></thead>
                            <tbody>
                                {logs.map((log, i) => (
                                    <tr key={log._id || i}>
                                        <td style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td>
                                            <span style={{ color: getActionColor(log.action), fontWeight: '600', fontSize: '13px' }}>
                                                {log.action?.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td>{log.userId?.name || '-'}</td>
                                        <td style={{ color: '#10b981', fontWeight: '600' }}>{log.corridorId || '-'}</td>
                                        <td style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {log.details ? JSON.stringify(log.details) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {logs.length === 0 && <p style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>No logs found</p>}

                        {/* Pagination */}
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
                            <button
                                onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                                disabled={pagination.page <= 1}
                                className="btn-outline" style={{ padding: '6px 14px', fontSize: '13px' }}
                            >← Prev</button>
                            <span style={{ padding: '6px 12px', color: '#94a3b8', fontSize: '13px' }}>
                                Page {pagination.page} of {pagination.pages}
                            </span>
                            <button
                                onClick={() => setPagination(p => ({ ...p, page: Math.min(p.pages, p.page + 1) }))}
                                disabled={pagination.page >= pagination.pages}
                                className="btn-outline" style={{ padding: '6px 14px', fontSize: '13px' }}
                            >Next →</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AuditLogs;
