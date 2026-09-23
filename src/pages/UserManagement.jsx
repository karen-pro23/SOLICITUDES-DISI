import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser, getDepartments, getAreasByDepartment } from '../services/api';
import toast from 'react-hot-toast';
import './AdminPage.css';

const ROLES = [
  { value: 'super_admin', label: 'Super Administrador' },
  { value: 'director', label: 'Director' },
  { value: 'sub_director', label: 'Sub Director' },
  { value: 'recepcion', label: 'Recepción' },
  { value: 'jefe_area', label: 'Jefe de Área' },
  { value: 'developer', label: 'Desarrollador' },
  { value: 'tecnico', label: 'Técnico' },
];

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  director: 'Director',
  sub_director: 'Sub Director',
  recepcion: 'Recepción',
  jefe_area: 'Jefe de Área',
  developer: 'Desarrollador',
  tecnico: 'Técnico',
  admin: 'Admin',
  requester: 'Solicitante',
};

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [areas, setAreas] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', cedula: '', role: 'developer', departmentId: '', areaId: '', es_jefe: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUsers(), getDepartments()])
      .then(([u, d]) => { setUsers(u); setDepartments(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Cargar áreas cuando cambia el departamento
  useEffect(() => {
    if (form.departmentId) {
      getAreasByDepartment(form.departmentId)
        .then(setAreas)
        .catch(() => setAreas([]));
    } else {
      setAreas([]);
    }
  }, [form.departmentId]);

  function resetForm() {
    setForm({ fullName: '', email: '', password: '', cedula: '', role: 'developer', departmentId: '', areaId: '', es_jefe: false });
    setEditing(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      if (editing) {
        const updated = await updateUser(editing, form);
        setUsers((prev) => prev.map((u) => u.user_id === editing ? updated : u));
      } else {
        const created = await createUser(form);
        setUsers((prev) => [...prev, created]);
      }
      resetForm();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al guardar usuario');
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.user_id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar');
    }
  }

  function handleEdit(user) {
    setEditing(user.user_id);
    setForm({
      fullName: user.full_name,
      email: user.email,
      password: '',
      cedula: user.cedula || '',
      role: user.role,
      departmentId: user.department_id || '',
      areaId: user.area_id || '',
      es_jefe: user.es_jefe || false,
    });
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Usuarios del Equipo</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Gestionar personal del equipo (no incluye solicitantes)</p>
      </div>

      <div className="admin-form-card">
        <h3>{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
        <form onSubmit={handleSubmit} className="admin-form">
          {/* Fila 1: Nombre + Cédula */}
          <div className="form-row">
            <div className="form-group">
              <label>Nombre completo *</label>
              <input value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value.toLocaleUpperCase()})} required />
            </div>
            <div className="form-group">
              <label>Cédula</label>
              <input value={form.cedula} onChange={(e) => setForm({...form, cedula: e.target.value})} placeholder="Ej: 12345678" />
            </div>
          </div>
          
          {/* Fila 2: Email + Contraseña */}
          <div className="form-row">
            <div className="form-group">
              <label>Email (usuario para ingresar) *</label>
              <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Contraseña {editing && '(dejar vacío para mantener)'}</label>
              <input type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})}
                required={!editing} />
            </div>
          </div>
          
          {/* Fila 3: Rol + Departamento */}
          <div className="form-row">
            <div className="form-group">
              <label>Rol *</label>
              <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Departamento</label>
              <select value={form.departmentId} onChange={(e) => setForm({...form, departmentId: e.target.value, areaId: ''})}>
                <option value="">Seleccionar...</option>
                {departments.map((d) => (
                  <option key={d.department_id} value={d.department_id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Fila 4: Área + Jefe */}
          <div className="form-row">
            <div className="form-group">
              <label>Área</label>
              <select value={form.areaId} onChange={(e) => setForm({...form, areaId: e.target.value})} disabled={!form.departmentId}>
                <option value="">Seleccionar área...</option>
                {areas.map((a) => (
                  <option key={a.area_id} value={a.area_id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input type="checkbox" id="es_jefe" checked={form.es_jefe} onChange={(e) => setForm({...form, es_jefe: e.target.checked})} style={{ width: 'auto', margin: 0 }} />
              <label htmlFor="es_jefe" style={{ margin: 0 }}>Es Jefe de Área</label>
            </div>
          </div>
          <div className="form-actions">
            {editing && <button type="button" className="btn btn-outline" onClick={resetForm}>Cancelar</button>}
            <button type="submit" className="btn btn-primary">{editing ? 'Actualizar' : 'Crear Usuario'}</button>
          </div>
        </form>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Cédula</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Departamento</th>
            <th>Área</th>
            <th>Activo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id}>
              <td>{u.full_name}</td>
              <td>{u.cedula || '-'}</td>
              <td>{u.email}</td>
              <td>{ROLE_LABELS[u.role] || u.role}</td>
              <td>{u.department_name || '-'}</td>
              <td>{u.area_name || '-'}</td>
              <td>{u.is_active ? '✓' : '✗'}</td>
              <td>
                <button className="btn btn-sm btn-outline" onClick={() => handleEdit(u)}>Editar</button>
                {' '}
                <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.user_id)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
