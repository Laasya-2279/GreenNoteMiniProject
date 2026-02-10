import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const user = await login(email, password);
            toast.success(`Welcome, ${user.name}!`);
            switch (user.role) {
                case 'HOSPITAL': navigate('/hospital'); break;
                case 'CONTROL_ROOM': navigate('/controlroom'); break;
                case 'AMBULANCE': navigate('/ambulance'); break;
                case 'TRAFFIC': navigate('/traffic'); break;
                default: navigate('/public');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const demoLogin = async (demoEmail, demoPass) => {
        setEmail(demoEmail);
        setPassword(demoPass);
        setLoading(true);
        try {
            const user = await login(demoEmail, demoPass);
            toast.success(`Welcome, ${user.name}!`);
            switch (user.role) {
                case 'HOSPITAL': navigate('/hospital'); break;
                case 'CONTROL_ROOM': navigate('/controlroom'); break;
                case 'AMBULANCE': navigate('/ambulance'); break;
                case 'TRAFFIC': navigate('/traffic'); break;
                default: navigate('/public');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            padding: '20px'
        }}>
            <div className="animate-fadeIn" style={{ width: '100%', maxWidth: '460px' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '20px',
                        background: 'linear-gradient(135deg, #059669, #10b981)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '36px', marginBottom: '16px',
                        boxShadow: '0 8px 30px rgba(5, 150, 105, 0.3)'
                    }}>
                        🏥
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#e2e8f0' }}>GreenNote</h1>
                    <p style={{ color: '#059669', fontWeight: '600', fontSize: '13px', letterSpacing: '2px', marginTop: '4px' }}>
                        GREEN CORRIDOR MANAGEMENT
                    </p>
                </div>

                {/* Login form */}
                <div className="glass-card">
                    <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#e2e8f0', marginBottom: '6px' }}>Welcome Back</h2>
                    <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>Sign in to continue</p>

                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>
                                Email Address
                            </label>
                            <input
                                type="email"
                                className="input-field"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>
                                Password
                            </label>
                            <input
                                type="password"
                                className="input-field"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <button type="submit" className="btn-primary" style={{ width: '100%' }} disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In →'}
                        </button>
                    </form>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                        <Link to="/forgot-password" style={{ color: '#059669', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}>
                            Forgot password?
                        </Link>
                        <Link to="/signup" style={{ color: '#059669', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}>
                            Create account →
                        </Link>
                    </div>
                </div>

                {/* Demo accounts */}
                <div className="glass-card" style={{ marginTop: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '12px' }}>
                        🎯 Quick Demo Login
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                            { label: '🏥 Hospital', email: 'hospital@demo.com', pass: 'hospital@123' },
                            { label: '🎛️ Control Room', email: 'admin@greennote.com', pass: 'admin@123' },
                            { label: '🚑 Ambulance', email: 'driver@demo.com', pass: 'driver@123' },
                            { label: '🚦 Traffic', email: 'traffic@demo.com', pass: 'traffic@123' },
                        ].map(demo => (
                            <button
                                key={demo.email}
                                onClick={() => demoLogin(demo.email, demo.pass)}
                                disabled={loading}
                                style={{
                                    padding: '10px', background: 'rgba(5, 150, 105, 0.1)',
                                    border: '1px solid rgba(5, 150, 105, 0.2)', borderRadius: '10px',
                                    color: '#a7f3d0', cursor: 'pointer', fontSize: '12px',
                                    fontWeight: '600', transition: 'all 0.2s'
                                }}
                                onMouseOver={(e) => e.target.style.background = 'rgba(5, 150, 105, 0.2)'}
                                onMouseOut={(e) => e.target.style.background = 'rgba(5, 150, 105, 0.1)'}
                            >
                                {demo.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
