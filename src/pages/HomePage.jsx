import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-bg, #f8fafc)' }}>
      <PublicHeader />

      <main style={{
        maxWidth: '860px',
        margin: '0 auto',
        padding: '4rem 1.5rem',
        textAlign: 'center',
      }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
          color: 'white',
          fontWeight: 900,
          fontSize: '2rem',
          boxShadow: '0 12px 28px rgba(37, 99, 235, 0.25)',
        }}>
          S
        </div>

        <h1 style={{
          fontSize: '2.25rem',
          fontWeight: 900,
          color: '#0f172a',
          marginBottom: '0.75rem',
          lineHeight: 1.2,
          letterSpacing: '-0.02em',
        }}>
          Portal de Atención de Sistemas DISI
        </h1>
        <p style={{
          fontSize: '1.0625rem',
          color: '#475569',
          marginBottom: '3rem',
          maxWidth: '540px',
          margin: '0 auto 3rem',
          lineHeight: 1.6,
        }}>
          Plataforma oficial para la atención de requerimientos, soporte técnico y reportes de desarrollo de la Gobernación.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.5rem',
          maxWidth: '680px',
          margin: '0 auto',
        }}>
          <Link
            to="/solicitud"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '2rem 1.75rem',
              background: 'white',
              borderRadius: '1rem',
              border: '2px solid #e2e8f0',
              textDecoration: 'none',
              color: '#0f172a',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              textAlign: 'left',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#2563eb';
              e.currentTarget.style.boxShadow = '0 12px 24px -4px rgba(37, 99, 235, 0.15)';
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.375rem', color: '#0f172a' }}>
              Nueva Solicitud
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>
              Enviá un requerimiento de desarrollo o reportá un error de sistema en 3 simples pasos.
            </div>
            <div style={{ marginTop: '1.25rem', fontSize: '0.8125rem', fontWeight: 700, color: '#2563eb' }}>
              Iniciar Solicitud →
            </div>
          </Link>

          <Link
            to="/buscar"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '2rem 1.75rem',
              background: 'white',
              borderRadius: '1rem',
              border: '2px solid #e2e8f0',
              textDecoration: 'none',
              color: '#0f172a',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#10b981';
              e.currentTarget.style.boxShadow = '0 12px 24px -4px rgba(16, 185, 129, 0.15)';
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#e2e8f0';
              e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: '#ecfdf5',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '0.375rem', color: '#0f172a' }}>
              Consultar Solicitudes
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.5 }}>
              Ingresá tu Cédula o número de ticket para verificar el estado de avance en tiempo real.
            </div>
            <div style={{ marginTop: '1.25rem', fontSize: '0.8125rem', fontWeight: 700, color: '#10b981' }}>
              Buscar Estado →
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
