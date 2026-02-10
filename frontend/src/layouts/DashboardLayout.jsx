import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

const DashboardLayout = () => {
    const { user, logout, role } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getNavLinks = () => {
        switch (role) {
            case 'HOSPITAL':
                return [
                    { to: '/hospital', label: 'Dashboard', icon: '📊', end: true },
                    { to: '/hospital/create', label: 'New Request', icon: '➕' },
                    { to: '/hospital/active', label: 'Active Corridors', icon: '🚨' },
                    { to: '/hospital/history', label: 'History', icon: '📋' }
                ];
            case 'CONTROL_ROOM':
                return [
                    { to: '/controlroom', label: 'Dashboard', icon: '📊', end: true },
                    { to: '/controlroom/requests', label: 'Request Queue', icon: '📥' },
                    { to: '/controlroom/monitoring', label: 'Live Monitor', icon: '🗺️' },
                    { to: '/controlroom/audit', label: 'Audit Logs', icon: '📜' }
                ];
            case 'AMBULANCE':
                return [
                    { to: '/ambulance', label: 'Dashboard', icon: '🚑', end: true }
                ];
            case 'TRAFFIC':
                return [
                    { to: '/traffic', label: 'Dashboard', icon: '📊', end: true },
                    { to: '/traffic/signals', label: 'Signal Control', icon: '🚦' },
                    { to: '/traffic/map', label: 'Active Map', icon: '🗺️' }
                ];
            default:
                return [
                    { to: '/public', label: 'Public View', icon: '🌍', end: true },
                    { to: '/public/alerts', label: 'Alerts Map', icon: '🚨' }
                ];
        }
    };

    const getRoleLabel = () => {
        switch (role) {
            case 'HOSPITAL': return 'Hospital Staff';
            case 'CONTROL_ROOM': return 'Control Room';
            case 'AMBULANCE': return 'Ambulance Driver';
            case 'TRAFFIC': return 'Traffic Dept.';
            default: return 'Public';
        }
    };

    const links = getNavLinks();

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            {/* Mobile toggle */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="md:hidden"
                style={{
                    position: 'fixed', top: '16px', left: '16px', zIndex: 50,
                    background: 'rgba(5, 150, 105, 0.9)', border: 'none', borderRadius: '10px',
                    color: 'white', padding: '10px 14px', cursor: 'pointer', fontSize: '18px'
                }}
            >
                {sidebarOpen ? '✕' : '☰'}
            </button>

            {/* Sidebar */}
            <div className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                {/* Logo */}
                <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(71, 85, 105, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '42px', height: '42px', borderRadius: '12px',
                            background: 'linear-gradient(135deg, #059669, #10b981)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '20px'
                        }}>
                            🏥
                        </div>
                        <div>
                            <h1 style={{ fontSize: '18px', fontWeight: '700', color: '#e2e8f0', margin: 0 }}>GreenNote</h1>
                            <p style={{ fontSize: '11px', color: '#059669', margin: 0, fontWeight: '600' }}>CORRIDOR MANAGEMENT</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav style={{ padding: '16px 0', flex: 1 }}>
                    <p style={{
                        fontSize: '11px', fontWeight: '600', color: '#64748b',
                        padding: '8px 24px', textTransform: 'uppercase', letterSpacing: '1px'
                    }}>
                        Navigation
                    </p>
                    {links.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.end}
                            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                            onClick={() => setSidebarOpen(false)}
                        >
                            <span style={{ fontSize: '18px' }}>{link.icon}</span>
                            {link.label}
                        </NavLink>
                    ))}
                </nav>

                {/* User section */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid rgba(71, 85, 105, 0.3)',
                    marginTop: 'auto'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontWeight: '700', fontSize: '14px'
                        }}>
                            {user?.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                            <p style={{ fontSize: '14px', fontWeight: '600', color: '#e2e8f0', margin: 0 }}>
                                {user?.name || 'Guest'}
                            </p>
                            <p style={{ fontSize: '11px', color: '#059669', margin: 0, fontWeight: '500' }}>
                                {getRoleLabel()}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%', padding: '10px', background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px',
                            color: '#f87171', cursor: 'pointer', fontWeight: '600',
                            fontSize: '13px', transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.2)'}
                        onMouseOut={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
                    >
                        ↩ Logout
                    </button>
                </div>
            </div>

            {/* Main content */}
            <div className="main-content">
                <Outlet />
            </div>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    onClick={() => setSidebarOpen(false)}
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                        zIndex: 30, display: 'block'
                    }}
                    className="md:hidden"
                />
            )}
        </div>
    );
};

export default DashboardLayout;
