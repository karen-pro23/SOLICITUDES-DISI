import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedLayout from './components/ProtectedLayout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import DevInbox from './pages/DevInbox';
import RequestForm from './pages/RequestForm';
import RequestDetail from './pages/RequestDetail';
import AdminPanel from './pages/AdminPanel';
import UserManagement from './pages/UserManagement';
import ModuleManagement from './pages/ModuleManagement';
import MetricsDashboard from './pages/MetricsDashboard';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Ruta pública para enviar solicitudes sin ingresar usuario/clave */}
        <Route path="/" element={<RequestForm />} />
        
        {/* Acceso para el equipo de Desarrollo / Sistemas */}
        <Route path="/login" element={<LoginPage />} />
        
        {/* Panel de administración y gestión protegido */}
        <Route element={<ProtectedLayout />}>
          <Route path="/dev/inbox" element={<DevInbox />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/requests/new" element={<RequestForm />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/modules" element={<ModuleManagement />} />
          <Route path="/admin/metrics" element={<MetricsDashboard />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
