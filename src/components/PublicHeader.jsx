import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicHeader() {
  const { user } = useAuth();

  return (
    <header className="header" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="header-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1rem',
              boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
            }}>
              P
            </div>
            <div>
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, margin: 0, color: 'var(--color-gray-900)' }}>
                Portal de Solicitudes
              </h2>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-gray-500)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Atención y Desarrollo de Sistemas
              </span>
            </div>
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <Link to="/buscar" className="btn btn-outline btn-sm">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Buscar
        </Link>

        {user ? (
          <Link to="/dashboard" className="btn btn-primary btn-sm">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Panel Sistemas
          </Link>
        ) : (
          <Link to="/login" className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}>
            Acceso Sistemas
          </Link>
        )}
      </div>
    </header>
  );
}
