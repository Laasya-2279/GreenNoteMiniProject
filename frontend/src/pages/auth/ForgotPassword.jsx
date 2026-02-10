import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { toast } from 'react-toastify';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await authAPI.forgotPassword({ email });
            setSent(true);
            toast.success('Reset link sent to your email');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to send reset email');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', padding: '20px'
        }}>
            <div className="animate-fadeIn" style={{ width: '100%', maxWidth: '420px' }}>
                <div className="glass-card" style={{ textAlign: 'center' }}>
                    <div style={{
                        width: '60px', height: '60px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '28px', marginBottom: '16px'
                    }}>🔐</div>

                    <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#e2e8f0', marginBottom: '8px' }}>
                        {sent ? 'Check Your Email' : 'Reset Password'}
                    </h2>

                    {sent ? (
                        <div>
                            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
                                If an account exists for <strong style={{ color: '#10b981' }}>{email}</strong>, we sent a reset link.
                            </p>
                            <Link to="/login" className="btn-primary" style={{ display: 'inline-block', textDecoration: 'none' }}>
                                ← Back to Login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
                                Enter your email to receive a password reset link.
                            </p>
                            <input
                                type="email" className="input-field"
                                placeholder="you@example.com"
                                value={email} onChange={(e) => setEmail(e.target.value)}
                                required style={{ marginBottom: '16px' }}
                            />
                            <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                            <div style={{ marginTop: '16px' }}>
                                <Link to="/login" style={{ color: '#059669', fontSize: '13px', textDecoration: 'none' }}>
                                    ← Back to Login
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
