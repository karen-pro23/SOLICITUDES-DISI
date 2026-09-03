import { useAuth } from '../context/AuthContext';

export default function Header({ user, toggleMobileMenu }) {
  const { logout } = useAuth();

  const initials = user.fullName
    ? user.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <header className="header">
      <div className="header-left">
        <button
          type="button"
          className="header-mobile-toggle"
          onClick={toggleMobileMenu}
          aria-label="Abrir menú de navegación"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <div className="header-info">
          <div className="header-avatar" title={user.fullName}>
            {initials}
          </div>
          <div>
            <span className="header-user">{user.fullName}</span>
            <div className="header-user-meta">
              <span className="header-role">
                {user.role === 'admin' ? 'Administrador'
                  : user.role === 'developer' ? 'Desarrollador' : 'Solicitante'}
              </span>
              <span className="header-dept">{user.departmentName}</span>
            </div>
          </div>
        </div>
      </div>
      <button className="btn btn-outline btn-sm btn-logout" onClick={logout}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        <span className="logout-text">Cerrar Sesión</span>
      </button>
    </header>
  );
}
