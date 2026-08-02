import { Link } from 'react-router-dom';

const adminCards = [
  { to: '/admin/users', title: 'Usuarios', desc: 'Gestionar usuarios del sistema' },
  { to: '/admin/modules', title: 'Módulos y Tipos', desc: 'Configurar módulos y tipos de solicitud' },
  { to: '/admin/metrics', title: 'Métricas', desc: 'Dashboard de métricas de gestión' },
];

export default function AdminPanel() {
  return (
    <div>
      <div className="page-header">
        <h1>Panel de Administración</h1>
      </div>
      <div className="admin-cards">
        {adminCards.map((card) => (
          <Link key={card.to} to={card.to} className="admin-card">
            <h3>{card.title}</h3>
            <p>{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
