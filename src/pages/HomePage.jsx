import { Link } from 'react-router-dom';
import PublicHeader from '../components/PublicHeader';
import './HomePage.css';

export default function HomePage() {
  return (
    <div className="home-page">
      <PublicHeader />

      <main className="home-main">
        <div className="home-logo">
          S
        </div>

        <h1 className="home-title">
          Portal de Atención de Sistemas DISI
        </h1>
        <p className="home-subtitle">
          Plataforma oficial para la atención de requerimientos, soporte técnico y reportes de desarrollo de la Gobernación.
        </p>

        <div className="home-cards">
          <Link to="/solicitud" className="home-card home-card-blue">
            <div className="home-card-icon home-card-icon-blue">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div className="home-card-title">Nueva Solicitud</div>
            <div className="home-card-desc">
              Enviá un requerimiento de desarrollo o reportá un error de sistema en 3 simples pasos.
            </div>
            <div className="home-card-link" style={{ color: '#2563eb' }}>
              Iniciar Solicitud →
            </div>
          </Link>

          <Link to="/buscar" className="home-card home-card-green">
            <div className="home-card-icon home-card-icon-green">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="home-card-title">Consultar Solicitudes</div>
            <div className="home-card-desc">
              Ingresá tu Cédula o número de ticket para verificar el estado de avance en tiempo real.
            </div>
            <div className="home-card-link" style={{ color: '#10b981' }}>
              Buscar Estado →
            </div>
          </Link>

          <Link to="/servicio-tecnico/nuevo" className="home-card home-card-orange">
            <div className="home-card-icon home-card-icon-orange">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
            </div>
            <div className="home-card-title">Servicio Técnico</div>
            <div className="home-card-desc">
              Solicitá soporte técnico para impresoras, redes, hardware y más.
            </div>
            <div className="home-card-link" style={{ color: '#ea580c' }}>
              Solicitar Servicio →
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
