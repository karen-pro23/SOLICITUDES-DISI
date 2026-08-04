import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-bg)' }}>
      <PublicHeader />

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '4rem 1.5rem',
        textAlign: 'center',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '2rem',
          boxShadow: '0 8px 24px rgba(99, 102, 241, 0.3)',
        }}>
          P
        </div>

        <h1 style={{
          fontSize: '2.25rem',
          fontWeight: 800,
          color: 'var(--color-gray-900)',
          marginBottom: '0.75rem',
          lineHeight: 1.2,
        }}>
          Portal de Solicitudes
        </h1>
        <p style={{
          fontSize: '1.1rem',
          color: 'var(--color-gray-600)',
          marginBottom: '3rem',
          maxWidth: '500px',
          margin: '0 auto 3rem',
          lineHeight: 1.6,
        }}>
          Departamento de Desarrollo de Sistemas.
          Envíe su solicitud o consulte el estado de una existente.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1.5rem',
          maxWidth: '600px',
          margin: '0 auto',
        }}>
          <Link
            to="/buscar"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              padding: '2.5rem 1.5rem',
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid #e2e8f0',
              textDecoration: 'none',
              color: 'var(--color-gray-900)',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#6366f1';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: '#eff6ff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                Buscar Solicitudes
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>
                Consulte el estado con su cédula
              </div>
            </div>
          </Link>

          <Link
            to="/solicitud"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              padding: '2.5rem 1.5rem',
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid #e2e8f0',
              textDecoration: 'none',
              color: 'var(--color-gray-900)',
              transition: 'all 0.2s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: '#ecfdf5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                Nueva Solicitud
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>
                Reportá un error o pedí una mejora
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
