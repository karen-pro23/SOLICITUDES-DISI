import { useAuth } from '../context/AuthContext';

export default function Header({ user }) {
  const { logout } = useAuth();

  const initials = user.fullName
    ? user.fullName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <header className="header">
      <div className="header-info">
        <div className="header-avatar" title={user.fullName}>
          {initials}
        </div>
        <div>
          <span className="header-user">{user.fullName}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.125rem' }}>
            <span className="header-role">
              {user.role === 'admin' ? 'Administrador'
                : user.role === 'developer' ? 'Desarrollador' : 'Solicitante'}
            </span>
            <span className="header-dept">{user.departmentName}</span>
          </div>
        </div>
      </div>
      <button className="btn btn-outline btn-sm" onClick={logout}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
        Cerrar Sesión
      </button>
    </header>
  );
}
