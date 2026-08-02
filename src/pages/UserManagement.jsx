import { useState, useEffect } from 'react';
import { getUsers, createUser, updateUser, deleteUser, getDepartments } from '../services/api';
import './AdminPage.css';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'requester', departmentId: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getUsers(), getDepartments()])
      .then(([u, d]) => { setUsers(u); setDepartments(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setForm({ fullName: '', email: '', password: '', role: 'requester', departmentId: '' });
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
      alert(err.response?.data?.error || 'Error al guardar usuario');
    }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.user_id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar');
    }
  }

  function handleEdit(user) {
    setEditing(user.user_id);
    setForm({
      fullName: user.full_name,
      email: user.email,
      password: '',
      role: user.role,
      departmentId: user.department_id,
    });
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Usuarios</h1>
      </div>

      <div className="admin-form-card">
        <h3>{editing ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
        <form onSubmit={handleSubmit} className="admin-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nombre</label>
              <input value={form.fullName} onChange={(e) => setForm({...form, fullName: e.target.value})} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} required />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Contraseña {editing && '(dejar vacío para mantener)'}</label>
              <input type="password" value={form.password} onChange={(e) => setForm({...form, password: e.target.value})}
                required={!editing} />
            </div>
            <div className="form-group">
              <label>Rol</label>
              <select value={form.role} onChange={(e) => setForm({...form, role: e.target.value})}>
                <option value="requester">Solicitante</option>
                <option value="developer">Desarrollador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Departamento</label>
            <select value={form.departmentId} onChange={(e) => setForm({...form, departmentId: e.target.value})} required>
              <option value="">Seleccionar...</option>
              {departments.map((d) => (
                <option key={d.department_id} value={d.department_id}>{d.name}</option>
              ))}
            </select>
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
            <th>Email</th>
            <th>Rol</th>
            <th>Departamento</th>
            <th>Activo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id}>
              <td>{u.full_name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.department_name}</td>
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
