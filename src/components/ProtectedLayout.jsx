import { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from './Sidebar';
import Header from './Header';
import './Layout.css';

export default function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const toggleMobileMenu = () => {
    setMobileOpen((prev) => !prev);
  };

  if (loading) return <div className="loading-screen">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className={`app-layout ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      {/* Mobile Drawer Overlay Backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        role={user.role}
        collapsed={collapsed}
        toggleCollapse={toggleCollapse}
        onNavClick={() => setMobileOpen(false)}
      />

      <div className="main-area">
        <Header user={user} toggleMobileMenu={toggleMobileMenu} />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
