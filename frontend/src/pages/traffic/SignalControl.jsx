import { useState, useEffect } from 'react';
import { trafficAPI } from '../../services/api';
import { useWebSocket } from '../../context/WebSocketContext';
import { toast } from 'react-toastify';

const SignalControl = () => {
    const [signals, setSignals] = useState([]);
    const [loading, setLoading] = useState(true);
    const { overrideSignal } = useWebSocket();

    useEffect(() => { fetchSignals(); }, []);

    const fetchSignals = async () => {
        try {
            const res = await trafficAPI.getSignals();
            setSignals(res.data.signals || []);
        } catch { toast.error('Failed to load signals'); }
        finally { setLoading(false); }
    };

    const handleOverride = async (signal, state) => {
        try {
            await trafficAPI.overrideSignal(signal.signalId, { state });
            overrideSignal({ signalId: signal.signalId, state });
            toast.success(`Signal ${signal.name} → ${state}`);
            fetchSignals();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Override failed');
        }
    };

    const handleRestore = async (signal) => {
        try {
            await trafficAPI.restoreSignal(signal.signalId);
            toast.success(`Signal ${signal.name} restored`);
            fetchSignals();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Restore failed');
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}><div className="spinner"></div></div>;

    return (
        <div className="animate-fadeIn">
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0', marginBottom: '24px' }}>🚦 Signal Control Panel</h1>

            <div style={{ display: 'grid', gap: '16px' }}>
                {signals.map(s => (
                    <div key={s.signalId} className="glass-card" style={{ borderLeft: `4px solid ${s.currentState === 'GREEN' ? '#10b981' : s.currentState === 'RED' ? '#ef4444' : '#f59e0b'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                            <div>
                                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#e2e8f0' }}>{s.name}</h3>
                                <p style={{ color: '#94a3b8', fontSize: '13px' }}>{s.signalId} | {s.signalType} | Zone: {s.zone}</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                                    <div style={{
                                        width: '16px', height: '16px', borderRadius: '50%',
                                        background: s.currentState === 'GREEN' ? '#10b981' : s.currentState === 'RED' ? '#ef4444' : '#f59e0b'
                                    }}></div>
                                    <span style={{ fontWeight: '600', color: '#e2e8f0' }}>{s.currentState}</span>
                                    {s.overriddenBy && (
                                        <span style={{ fontSize: '11px', color: '#f59e0b', marginLeft: '8px' }}>
                                            ⚠️ Overridden ({s.overriddenBy.corridorId})
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleOverride(s, 'GREEN')} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px', background: 'linear-gradient(135deg, #059669, #10b981)' }}>
                                    🟢 GREEN
                                </button>
                                <button onClick={() => handleOverride(s, 'RED')} style={{ padding: '8px 16px', fontSize: '13px', background: 'linear-gradient(135deg, #ef4444, #f87171)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600' }}>
                                    🔴 RED
                                </button>
                                {s.overriddenBy && (
                                    <button onClick={() => handleRestore(s)} className="btn-outline" style={{ padding: '8px 16px', fontSize: '13px' }}>
                                        ↩ Restore
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SignalControl;
