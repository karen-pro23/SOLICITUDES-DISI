import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import './Layout.css';

export default function ProtectedLayout() {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading-screen">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout">
      <Sidebar role={user.role} />
      <div className="main-area">
        <Header user={user} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
