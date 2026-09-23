import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicHeader() {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="header" style={{ position: 'sticky', top: 0, zIndex: 100, backdropFilter: 'blur(12px)', background: 'rgba(255, 255, 255, 0.92)' }}>
      <div className="header-info">
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
            background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: '1rem',
          }}>
            S
          </div>
          <div className="header-text-group">
            <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--color-gray-900)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
              Solicitudes DISI
            </h2>
            <span className="header-subtitle-text" style={{ fontSize: '0.625rem', color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              Gobernación / Sistemas
            </span>
          </div>
        </Link>
      </div>

      <nav className="header-nav" aria-label="Navegación principal">
        <a
          href="http://192.168.16.204:3001/downloads/solicitudes-disi.apk"
          download
          className="btn btn-sm header-btn-app"
        >
          📱
        </a>

        <Link to="/buscar" className={`btn btn-sm ${isActive('/buscar') ? 'btn-primary' : 'btn-outline'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <span className="btn-text-desktop">Buscar</span>
        </Link>

        <Link to="/solicitud" className={`btn btn-sm ${isActive('/solicitud') ? 'btn-primary' : 'btn-outline'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          <span className="btn-text-desktop">Nueva</span>
        </Link>

        {user ? (
          <Link to="/dashboard" className="btn btn-sm btn-primary" style={{ background: '#0f172a' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
            <span className="btn-text-desktop">Panel</span>
          </Link>
        ) : (
          <Link to="/login" className="btn btn-sm btn-outline">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
            <span className="btn-text-desktop">Acceso</span>
          </Link>
        )}
      </nav>
    </header>
  );
}
