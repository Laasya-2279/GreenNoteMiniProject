import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const Signup = () => {
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', confirmPassword: '',
        phone: '', role: 'PUBLIC'
    });
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState(1); // 1: form, 2: OTP
    const [loading, setLoading] = useState(false);
    const { signup, verifyOTP } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            return toast.error('Passwords do not match');
        }
        setLoading(true);
        try {
            await signup({
                name: formData.name, email: formData.email,
                password: formData.password, phone: formData.phone,
                role: formData.role
            });
            toast.success('Account created! Check email for OTP.');
            setStep(2);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await verifyOTP(formData.email, otp);
            toast.success('Email verified!');
            navigate('/login');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', padding: '20px'
        }}>
            <div className="animate-fadeIn" style={{ width: '100%', maxWidth: '460px' }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{
                        width: '60px', height: '60px', borderRadius: '16px',
                        background: 'linear-gradient(135deg, #059669, #10b981)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '28px', marginBottom: '12px', boxShadow: '0 8px 30px rgba(5, 150, 105, 0.3)'
                    }}>🏥</div>
                    <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0' }}>
                        {step === 1 ? 'Create Account' : 'Verify Email'}
                    </h1>
                </div>

                <div className="glass-card">
                    {step === 1 ? (
                        <form onSubmit={handleSignup}>
                            <div style={{ display: 'grid', gap: '14px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Full Name</label>
                                    <input name="name" className="input-field" placeholder="John Doe" value={formData.name} onChange={handleChange} required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Email</label>
                                    <input name="email" type="email" className="input-field" placeholder="you@example.com" value={formData.email} onChange={handleChange} required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Phone</label>
                                    <input name="phone" className="input-field" placeholder="+91-9876543210" value={formData.phone} onChange={handleChange} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Role</label>
                                    <select name="role" className="select-field" value={formData.role} onChange={handleChange}>
                                        <option value="PUBLIC">Public</option>
                                        <option value="HOSPITAL">Hospital Staff</option>
                                        <option value="CONTROL_ROOM">Control Room</option>
                                        <option value="AMBULANCE">Ambulance Driver</option>
                                        <option value="TRAFFIC">Traffic Department</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Password</label>
                                    <input name="password" type="password" className="input-field" placeholder="••••••••" value={formData.password} onChange={handleChange} required minLength={6} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Confirm Password</label>
                                    <input name="confirmPassword" type="password" className="input-field" placeholder="••••••••" value={formData.confirmPassword} onChange={handleChange} required />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '20px' }} disabled={loading}>
                                {loading ? 'Creating...' : 'Create Account →'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerify}>
                            <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '20px' }}>
                                Enter the 6-digit OTP sent to <strong style={{ color: '#10b981' }}>{formData.email}</strong>
                            </p>
                            <input
                                className="input-field"
                                placeholder="Enter OTP"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                                maxLength={6}
                                style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px' }}
                            />
                            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '20px' }} disabled={loading}>
                                {loading ? 'Verifying...' : 'Verify Email →'}
                            </button>
                        </form>
                    )}

                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <Link to="/login" style={{ color: '#059669', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}>
                            ← Back to Login
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
