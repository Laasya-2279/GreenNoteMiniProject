import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WebSocketProvider } from './context/WebSocketContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import DashboardLayout from './layouts/DashboardLayout';

import HospitalDashboard from './pages/hospital/HospitalDashboard';
import CreateRequest from './pages/hospital/CreateRequest';
import ActiveCorridors from './pages/hospital/ActiveCorridors';
import CorridorHistory from './pages/hospital/CorridorHistory';

import ControlRoomDashboard from './pages/controlroom/ControlRoomDashboard';
import RequestQueue from './pages/controlroom/RequestQueue';
import LiveMonitoring from './pages/controlroom/LiveMonitoring';
import AuditLogs from './pages/controlroom/AuditLogs';

import AmbulanceDashboard from './pages/ambulance/AmbulanceDashboard';
import NavigationView from './pages/ambulance/NavigationView';

import TrafficDashboard from './pages/traffic/TrafficDashboard';
import SignalControl from './pages/traffic/SignalControl';
import ActiveCorridorsMap from './pages/traffic/ActiveCorridorsMap';

import PublicView from './pages/public/PublicView';
import ActiveAlertsMap from './pages/public/ActiveAlertsMap';

// Protected route wrapper
const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, loading, role } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" />;
  if (roles && !roles.includes(role)) return <Navigate to="/login" />;
  return children;
};

const AppRoutes = () => {
  const { isAuthenticated, role } = useAuth();

  const getDashboardRedirect = () => {
    switch (role) {
      case 'HOSPITAL': return '/hospital';
      case 'CONTROL_ROOM': return '/controlroom';
      case 'AMBULANCE': return '/ambulance';
      case 'TRAFFIC': return '/traffic';
      case 'PUBLIC': return '/public';
      default: return '/login';
    }
  };

  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={isAuthenticated ? <Navigate to={getDashboardRedirect()} /> : <Login />} />
      <Route path="/signup" element={isAuthenticated ? <Navigate to={getDashboardRedirect()} /> : <Signup />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Hospital routes */}
      <Route path="/hospital" element={<ProtectedRoute roles={['HOSPITAL']}><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<HospitalDashboard />} />
        <Route path="create" element={<CreateRequest />} />
        <Route path="active" element={<ActiveCorridors />} />
        <Route path="history" element={<CorridorHistory />} />
      </Route>

      {/* Control Room routes */}
      <Route path="/controlroom" element={<ProtectedRoute roles={['CONTROL_ROOM']}><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<ControlRoomDashboard />} />
        <Route path="requests" element={<RequestQueue />} />
        <Route path="monitoring" element={<LiveMonitoring />} />
        <Route path="audit" element={<AuditLogs />} />
      </Route>

      {/* Ambulance routes */}
      <Route path="/ambulance" element={<ProtectedRoute roles={['AMBULANCE']}><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<AmbulanceDashboard />} />
        <Route path="navigate/:corridorId" element={<NavigationView />} />
      </Route>

      {/* Traffic routes */}
      <Route path="/traffic" element={<ProtectedRoute roles={['TRAFFIC']}><DashboardLayout /></ProtectedRoute>}>
        <Route index element={<TrafficDashboard />} />
        <Route path="signals" element={<SignalControl />} />
        <Route path="map" element={<ActiveCorridorsMap />} />
      </Route>

      {/* Public routes */}
      <Route path="/public" element={<DashboardLayout />}>
        <Route index element={<PublicView />} />
        <Route path="alerts" element={<ActiveAlertsMap />} />
      </Route>

      {/* Default */}
      <Route path="/" element={<Navigate to={isAuthenticated ? getDashboardRedirect() : '/login'} />} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <AppRoutes />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="dark"
        />
      </WebSocketProvider>
    </AuthProvider>
  );
}

export default App;
