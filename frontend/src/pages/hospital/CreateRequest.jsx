import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hospitalAPI, corridorAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';

const CreateRequest = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [hospitals, setHospitals] = useState([]);
    const [ambulances, setAmbulances] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        sourceHospitalId: user?.hospitalId || 'H001',
        destinationHospitalId: '',
        organType: '',
        urgencyLevel: 'CRITICAL',
        ambulanceId: '',
        doctorInCharge: { name: '', phone: '', specialization: '' },
        notes: ''
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [hospRes, ambRes] = await Promise.all([
                    hospitalAPI.getAll(),
                    hospitalAPI.getAmbulances()
                ]);
                setHospitals(hospRes.data.hospitals || []);
                setAmbulances(ambRes.data.ambulances || []);
            } catch (err) {
                toast.error('Failed to load data');
            }
        };
        fetchData();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('doctor_')) {
            const field = name.replace('doctor_', '');
            setFormData(prev => ({
                ...prev,
                doctorInCharge: { ...prev.doctorInCharge, [field]: value }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await corridorAPI.create(formData);
            toast.success(`Corridor ${res.data.corridor.corridorId} created!`);
            navigate('/hospital');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to create request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fadeIn">
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#e2e8f0', marginBottom: '24px' }}>
                🚨 Create Green Corridor Request
            </h1>

            <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
                    {/* Source & Destination */}
                    <div className="glass-card">
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginBottom: '16px' }}>📍 Route Details</h3>
                        <div style={{ display: 'grid', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Source Hospital</label>
                                <select name="sourceHospitalId" className="select-field" value={formData.sourceHospitalId} onChange={handleChange}>
                                    <option value="">Select Source Hospital</option>
                                    {hospitals.map(h => <option key={h.hospitalId} value={h.hospitalId}>{h.name} ({h.hospitalId})</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Destination Hospital *</label>
                                <select name="destinationHospitalId" className="select-field" value={formData.destinationHospitalId} onChange={handleChange} required>
                                    <option value="">Select Destination Hospital</option>
                                    {hospitals.filter(h => h.hospitalId !== formData.sourceHospitalId).map(h => (
                                        <option key={h.hospitalId} value={h.hospitalId}>{h.name} ({h.hospitalId})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Organ & Urgency */}
                    <div className="glass-card">
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginBottom: '16px' }}>🫀 Organ Details</h3>
                        <div style={{ display: 'grid', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Organ Type *</label>
                                <select name="organType" className="select-field" value={formData.organType} onChange={handleChange} required>
                                    <option value="">Select Organ Type</option>
                                    {['Heart', 'Kidney', 'Liver', 'Lungs', 'Pancreas', 'Intestine', 'Cornea', 'Tissue'].map(o => (
                                        <option key={o} value={o}>{o}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Urgency Level *</label>
                                <select name="urgencyLevel" className="select-field" value={formData.urgencyLevel} onChange={handleChange} required>
                                    <option value="STABLE">🟢 Stable</option>
                                    <option value="CRITICAL">🟡 Critical</option>
                                    <option value="VERY_CRITICAL">🔴 Very Critical</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Ambulance */}
                    <div className="glass-card">
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginBottom: '16px' }}>🚑 Ambulance</h3>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Assign Driver</label>
                            <select name="ambulanceId" className="select-field" value={formData.ambulanceId} onChange={handleChange}>
                                <option value="">Select Ambulance Driver</option>
                                {ambulances.map(a => (
                                    <option key={a.driverId} value={a.driverId}>
                                        {a.driverName} - {a.vehicleNumbers?.[0]} {a.isAvailable ? '✅' : '❌'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Doctor */}
                    <div className="glass-card">
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#10b981', marginBottom: '16px' }}>👨‍⚕️ Doctor In Charge</h3>
                        <div style={{ display: 'grid', gap: '14px' }}>
                            <input name="doctor_name" className="input-field" placeholder="Doctor Name" value={formData.doctorInCharge.name} onChange={handleChange} />
                            <input name="doctor_phone" className="input-field" placeholder="Phone" value={formData.doctorInCharge.phone} onChange={handleChange} />
                            <input name="doctor_specialization" className="input-field" placeholder="Specialization" value={formData.doctorInCharge.specialization} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                {/* Notes */}
                <div className="glass-card" style={{ marginTop: '20px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '4px' }}>Additional Notes</label>
                    <textarea
                        name="notes" className="input-field"
                        placeholder="Any special instructions..."
                        value={formData.notes} onChange={handleChange}
                        rows={3} style={{ resize: 'vertical' }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                    <button type="submit" className="btn-primary" disabled={loading} style={{ flex: 1 }}>
                        {loading ? '⏳ Creating...' : '🚀 Submit Request'}
                    </button>
                    <button type="button" className="btn-outline" onClick={() => navigate('/hospital')}>
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateRequest;
