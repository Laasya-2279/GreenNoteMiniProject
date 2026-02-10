import { useState } from 'react';

const RouteApproval = () => {
    return (
        <div className="animate-fadeIn">
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0', marginBottom: '24px' }}>🛤️ Route Approval</h1>
            <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
                <p style={{ fontSize: '40px', marginBottom: '12px' }}>🗺️</p>
                <p style={{ color: '#94a3b8' }}>Route approval is integrated into the Request Queue. Approve requests to auto-calculate optimal routes.</p>
            </div>
        </div>
    );
};

export default RouteApproval;
