import { useState, useEffect, useMemo } from 'react';
import { getUsers, createUser, updateUser, deleteUser, getDepartments, getAreasByDepartment } from '../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import './AdminPage.css';

const ROLES = [
  { value: 'super_admin', label: 'Super Administrador', color: '#dc2626', bg: '#fef2f2' },
  { value: 'director', label: 'Director', color: '#7c3aed', bg: '#f5f3ff' },
  { value: 'sub_director', label: 'Sub Director', color: '#6366f1', bg: '#eef2ff' },
  { value: 'recepcion', label: 'Recepción', color: '#0891b2', bg: '#ecfeff' },
  { value: 'jefe_area', label: 'Jefe de Área', color: '#d97706', bg: '#fffbeb' },
  { value: 'developer', label: 'Desarrollador', color: '#059669', bg: '#ecfdf5' },
  { value: 'tecnico', label: 'Técnico', color: '#0284c7', bg: '#f0f9ff' },
];

const ROLE_MAP = Object.fromEntries(ROLES.map(r => [r.value, r]));

const ROLE_LABELS = {
  super_admin: 'Super Admin', director: 'Director', sub_director: 'Sub Director',
  recepcion: 'Recepción', jefe_area: 'Jefe de Área', developer: 'Desarrollador',
  tecnico: 'Técnico', admin: 'Admin', requester: 'Solicitante',
};

const thStyle = { padding: '0.875rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '2px solid #e2e8f0', background: '#f8fafc', whiteSpace: 'nowrap' };
const tdStyle = { padding: '0.875rem 1rem', fontSize: '0.8125rem', verticalAlign: 'middle' };

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', username: '', password: '', cedula: '', role: 'developer', departmentId: '', areaId: '', es_jefe: false });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');

  useEffect(() => {
    Promise.all([getUsers(), getDepartments()])
      .then(([u, d]) => { setUsers(u); setDepartments(d); })
      .catch(() => toast.error('Error al cargar datos'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (form.departmentId) {
      getAreasByDepartment(form.departmentId).then(setAreas).catch(() => setAreas([]));
    } else {
      setAreas([]);
    }
  }, [form.departmentId]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.is_active).length,
    jefes: users.filter(u => u.es_jefe).length,
    devs: users.filter(u => u.role === 'developer' || u.role === 'tecnico').length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    let result = users;
    if (filterRole) result = result.filter(u => u.role === filterRole);
    if (search.trim()) {
      const term = search.toUpperCase();
      result = result.filter(u =>
        u.full_name.toUpperCase().includes(term) ||
        u.email.toUpperCase().includes(term) ||
        (u.username || '').toUpperCase().includes(term) ||
        (u.cedula || '').includes(term) ||
        (u.department_name || '').toUpperCase().includes(term) ||
        (u.area_name || '').toUpperCase().includes(term)
      );
    }
    return result;
  }, [users, search, filterRole]);

  function resetForm() {
    setForm({ fullName: '', email: '', username: '', password: '', cedula: '', role: 'developer', departmentId: '', areaId: '', es_jefe: false });
    setEditing(null);
    setShowForm(false);
  }

  function handleEdit(user) {
    setEditing(user.user_id);
    setForm({
      fullName: user.full_name, email: user.email, username: user.username || '', password: '', cedula: user.cedula || '',
      role: user.role, departmentId: user.department_id || '', areaId: user.area_id || '', es_jefe: user.es_jefe || false,
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        const updated = await updateUser(editing, form);
        setUsers(prev => prev.map(u => u.user_id === editing ? updated : u));
        toast.success('Usuario actualizado');
      } else {
        const created = await createUser(form);
        setUsers(prev => [...prev, created]);
        toast.success('Usuario creado');
      }
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  }

  function confirmDeleteAction() {
    setSubmitting(true);
    deleteUser(confirmDelete.user_id)
      .then(() => { toast.success('Usuario eliminado'); setConfirmDelete(null); setUsers(prev => prev.filter(u => u.user_id !== confirmDelete.user_id)); })
      .catch(err => toast.error(err.response?.data?.error || 'Error al eliminar'))
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Usuarios del Equipo</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Personal del sistema (no incluye solicitantes)</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total', value: stats.total, color: '#6366f1', bg: '#eef2ff' },
          { label: 'Activos', value: stats.active, color: '#10b981', bg: '#ecfdf5' },
          { label: 'Jefes', value: stats.jefes, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Devs/Técnicos', value: stats.devs, color: '#8b5cf6', bg: '#f5f3ff' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="mgmt-search" style={{ flex: 1, minWidth: '200px' }}>
          <SearchIcon />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nombre, email, cédula..." />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '0.5rem 2rem 0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.8125rem', fontFamily: 'inherit', background: 'white', color: '#334155', cursor: 'pointer', minWidth: '160px' }}>
          <option value="">Todos los roles</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="mgmt-skeleton">{[1,2,3].map(i => <div key={i} className="mgmt-skeleton-card" />)}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="mgmt-empty">
            <UserIcon />
            <p>{search || filterRole ? 'No se encontraron usuarios' : 'No hay usuarios registrados'}</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Usuario</th>
                  <th style={thStyle}>Username</th>
                  <th style={thStyle}>Cédula</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Rol</th>
                  <th style={thStyle}>Departamento</th>
                  <th style={thStyle}>Área</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Estado</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  const roleInfo = ROLE_MAP[u.role] || { color: '#64748b', bg: '#f1f5f9' };
                  return (
                    <tr key={u.user_id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: `linear-gradient(135deg, ${roleInfo.bg}, ${roleInfo.color}22)`,
                            border: `2px solid ${roleInfo.color}33`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.6875rem', fontWeight: 700, color: roleInfo.color, flexShrink: 0
                          }}>
                            {u.full_name.split(' ').map(w => w[0]).join('').substring(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{u.full_name}</div>
                            {u.es_jefe && <span style={{ fontSize: '0.625rem', fontWeight: 700, color: '#d97706', background: '#fef3c7', padding: '0.1rem 0.375rem', borderRadius: '4px', marginTop: '0.125rem', display: 'inline-block' }}>JEFE</span>}
                          </div>
                        </div>
                      </td>
                      <td style={tdStyle}><code style={{ fontSize: '0.8125rem', color: '#6366f1', background: '#eef2ff', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>{u.username || '-'}</code></td>
                      <td style={tdStyle}><span style={{ fontSize: '0.8125rem', color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{u.cedula || '-'}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: '0.8125rem', color: '#334155' }}>{u.email}</span></td>
                      <td style={tdStyle}>
                        <span className="mgmt-badge" style={{ background: roleInfo.bg, color: roleInfo.color }}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td style={tdStyle}><span className="mgmt-badge mgmt-badge--blue">{u.department_name || '-'}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: '0.8125rem', color: u.area_name ? '#334155' : '#cbd5e1' }}>{u.area_name || '-'}</span></td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <span className={`mgmt-badge ${u.is_active ? 'mgmt-badge--green' : 'mgmt-badge--red'}`}>
                          {u.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'flex-end' }}>
                          <button className="mgmt-icon-btn" title="Editar" onClick={() => handleEdit(u)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="mgmt-icon-btn mgmt-icon-btn--danger" title="Eliminar" onClick={() => setConfirmDelete(u)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal formulario */}
      {showForm && (
        <div className="modal-overlay" onClick={resetForm}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <UserIcon /> {editing ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button className="modal-close-btn" onClick={resetForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Nombre completo *</label>
                    <input value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value.toLocaleUpperCase()})} required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Usuario (login) *</label>
                    <input value={form.username} onChange={e => setForm({...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '')})} placeholder="ej: carlos.lopez" required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Cédula</label>
                    <input value={form.cedula} onChange={e => setForm({...form, cedula: e.target.value})} placeholder="Ej: 12345678" style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Email (para ingresar) *</label>
                    <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Contraseña {editing && <span style={{ color: '#94a3b8', fontWeight: 400 }}>(vacío = mantener)</span>}</label>
                    <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required={!editing} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={labelStyle}>Rol *</label>
                    <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} style={inputStyle}>
                      {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Departamento</label>
                    <select value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value, areaId: ''})} style={inputStyle}>
                      <option value="">Seleccionar...</option>
                      {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>Área</label>
                    <select value={form.areaId} onChange={e => setForm({...form, areaId: e.target.value})} disabled={!form.departmentId} style={{ ...inputStyle, opacity: form.departmentId ? 1 : 0.5 }}>
                      <option value="">Seleccionar área...</option>
                      {areas.map(a => <option key={a.area_id} value={a.area_id}>{a.name}</option>)}
                    </select>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#334155', cursor: 'pointer', padding: '0.625rem 0' }}>
                    <input type="checkbox" checked={form.es_jefe} onChange={e => setForm({...form, es_jefe: e.target.checked})} style={{ accentColor: '#6366f1', width: '16px', height: '16px' }} />
                    Es Jefe de Área
                  </label>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={resetForm} disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !form.fullName.trim() || !form.email.trim()}>
                  {submitting ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
        title="Eliminar usuario"
        description={`¿Eliminar a "${confirmDelete?.full_name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        confirmClassName="btn-danger"
        submitting={submitting}
        submittingLabel="Eliminando..."
      />
    </div>
  );
}

const labelStyle = { fontWeight: 600, fontSize: '0.75rem', color: '#475569', marginBottom: '0.375rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' };
const inputStyle = { width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box' };
