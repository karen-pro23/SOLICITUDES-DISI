import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicHeader() {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="header" style={{ position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)', background: 'rgba(255, 255, 255, 0.92)' }}>
      <div className="header-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 800,
              fontSize: '1.1rem',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
            }}>
              S
            </div>
            <div>
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 800, margin: 0, color: 'var(--color-gray-900)', letterSpacing: '-0.01em' }}>
                Solicitudes DISI
              </h2>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                Gobernación / Desarrollo de Sistemas
              </span>
            </div>
          </Link>
        </div>
      </div>

      <nav style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} aria-label="Navegación principal">
        <Link
          to="/buscar"
          className={`btn ${isActive('/buscar') ? 'btn-primary' : 'btn-outline'} btn-sm`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Buscar Solicitud
        </Link>

        <Link
          to="/solicitud"
          className={`btn ${isActive('/solicitud') ? 'btn-primary' : 'btn-outline'} btn-sm`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Nueva Solicitud
        </Link>

        {user ? (
          <Link to="/dashboard" className="btn btn-primary btn-sm" style={{ background: '#0f172a' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Panel Interno
          </Link>
        ) : (
          <Link to="/login" className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem', opacity: 0.85 }}>
            Acceso Personal
          </Link>
        )}
      </nav>
    </header>
  );
}
