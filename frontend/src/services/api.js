import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000
});

// Request interceptor - attach token
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error));

// Response interceptor - handle 401
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    signup: (data) => api.post('/auth/signup', data),
    login: (data) => api.post('/auth/login', data),
    verifyOTP: (data) => api.post('/auth/verify-otp', data),
    forgotPassword: (data) => api.post('/auth/forgot-password', data),
    resendOTP: (data) => api.post('/auth/resend-otp', data),
    getMe: () => api.get('/auth/me')
};

// Hospital API
export const hospitalAPI = {
    getAll: () => api.get('/hospitals'),
    getById: (id) => api.get(`/hospitals/${id}`),
    getAmbulances: () => api.get('/hospitals/ambulances')
};

// Corridor API
export const corridorAPI = {
    create: (data) => api.post('/corridors', data),
    getAll: (params) => api.get('/corridors', { params }),
    getById: (id) => api.get(`/corridors/${id}`)
};

// Control Room API
export const controlRoomAPI = {
    getPendingRequests: () => api.get('/controlroom/requests'),
    approve: (id, data) => api.patch(`/controlroom/requests/${id}/approve`, data),
    reject: (id, data) => api.patch(`/controlroom/requests/${id}/reject`, data),
    getActiveCorridors: () => api.get('/controlroom/corridors/active'),
    getAuditLogs: (params) => api.get('/controlroom/audit-logs', { params })
};

// Ambulance API
export const ambulanceAPI = {
    sendGPS: (data) => api.post('/ambulance/gps', data),
    getCorridor: (id) => api.get(`/ambulance/corridor/${id}`),
    startCorridor: (id) => api.post(`/ambulance/start/${id}`),
    completeCorridor: (id) => api.post(`/ambulance/complete/${id}`)
};

// Traffic API
export const trafficAPI = {
    getActiveCorridors: () => api.get('/traffic/corridors/active'),
    getSignals: () => api.get('/traffic/signals'),
    overrideSignal: (id, data) => api.patch(`/traffic/signals/${id}`, data),
    restoreSignal: (id) => api.patch(`/traffic/signals/${id}/restore`)
};

// Public API
export const publicAPI = {
    getActiveCorridors: () => api.get('/public/corridors/active'),
    getAlerts: () => api.get('/public/alerts')
};

// Route API
export const routeAPI = {
    calculate: (data) => api.post('/routes/calculate', data),
    getSignalsOnRoute: (waypoints) => api.get('/signals/on-route', { params: { waypoints: JSON.stringify(waypoints) } }),
    getRoutes: (corridorId) => api.get(`/routes/${corridorId}`)
};

export default api;
