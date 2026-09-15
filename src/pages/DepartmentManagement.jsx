import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import './AdminPage.css';

function useSearch(items, key) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const term = q.toUpperCase();
    return items.filter((item) =>
      Object.values(item).some((v) => String(v).toUpperCase().includes(term))
    );
  }, [items, q]);
  return { q, setQ, filtered };
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      className={`mgmt-toggle ${checked ? 'mgmt-toggle--on' : ''} ${disabled ? 'mgmt-toggle--disabled' : ''}`}
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span className="mgmt-toggle-knob" />
    </button>
  );
}

function StatusDot({ active }) {
  return <span className={`mgmt-dot ${active ? 'mgmt-dot--green' : 'mgmt-dot--red'}`} />;
}

function Badge({ children, variant }) {
  return <span className={`mgmt-badge mgmt-badge--${variant || 'default'}`}>{children}</span>;
}

export default function DepartmentManagement() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '', is_active: true });
  const [editingDept, setEditingDept] = useState(null);

  // Collapsible section
  const [showDeptForm, setShowDeptForm] = useState(false);

  // Search
  const deptSearch = useSearch(departments, 'name');

  useEffect(() => {
    // Both admin and public can fetch? /admin/departments allows it because it's behind `requireRole('admin')` in routes. No, it isn't, admin routes do. Let's use the one in /admin routes, but we can also use public. There's a `/public/departments` which takes no role, but `/admin/departments` exists in `admin.routes.js`
    api.get('/admin/departments')
      .then((res) => setDepartments(res.data.departments))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleDeptSubmit(e) {
    e.preventDefault();
    try {
      if (editingDept) {
        const { data } = await api.put(`/admin/departments/${editingDept}`, deptForm);
        setDepartments((prev) => prev.map((d) => d.department_id === editingDept ? data.department : d));
        setEditingDept(null);
        toast.success('Departamento actualizado');
      } else {
        const { data } = await api.post('/admin/departments', deptForm);
        setDepartments((prev) => [...prev, data.department]);
        toast.success('Departamento creado');
      }
      setDeptForm({ name: '', code: '', description: '', is_active: true, is_it: false });
      setShowDeptForm(false);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  }

  async function handleDeleteDept(id, name) {
    if (!confirm(`¿Eliminar departamento "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/admin/departments/${id}`);
      setDepartments((prev) => prev.filter((d) => d.department_id !== id));
      toast.success('Departamento eliminado');
    } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar'); }
  }

  function startEditDept(d) {
    setEditingDept(d.department_id);
    setDeptForm({ name: d.name, code: d.code, description: d.description || '', is_active: d.is_active, is_it: d.is_it || false });
    setShowDeptForm(true);
  }

  function cancelEditDept() {
    setEditingDept(null);
    setDeptForm({ name: '', code: '', description: '', is_active: true, is_it: false });
    setShowDeptForm(false);
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="mgmt-skeleton">
          {[1, 2, 3].map((i) => <div key={i} className="mgmt-skeleton-card" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Gestión de Departamentos</h1>
        <p className="page-subtitle">Administrar áreas de la organización</p>
      </div>

      <section className="mgmt-section">
        <div className="mgmt-section-header">
          <div className="mgmt-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M19 21v-4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"/><path d="M9 15V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/></svg>
            <h2>Departamentos</h2>
            <Badge variant="blue">{departments.length}</Badge>
          </div>
          <div className="mgmt-section-actions">
            <div className="mgmt-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Buscar departamentos..."
                value={deptSearch.q}
                onChange={(e) => deptSearch.setQ(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { cancelEditDept(); setShowDeptForm((v) => !v); }}
            >
              {showDeptForm ? '✕ Cancelar' : '+ Nuevo'}
            </button>
          </div>
        </div>

        {showDeptForm && (
          <div className="mgmt-form-panel">
            <form onSubmit={handleDeptSubmit} className="mgmt-form">
              <div className="mgmt-form-grid">
                <div className="form-group">
                  <label>Nombre</label>
                  <input
                    value={deptForm.name}
                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value.toLocaleUpperCase() })}
                    placeholder="Ej: RECURSOS HUMANOS"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Código</label>
                  <input
                    value={deptForm.code}
                    onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toLocaleUpperCase() })}
                    placeholder="Ej: RRHH"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Descripción</label>
                  <input
                    value={deptForm.description}
                    onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value.toLocaleUpperCase() })}
                    placeholder="Opcional"
                  />
                </div>
                <div className="form-group form-group--toggle">
                  <label>Activo</label>
                  <Toggle
                    checked={deptForm.is_active}
                    onChange={() => setDeptForm({ ...deptForm, is_active: !deptForm.is_active })}
                  />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={deptForm.is_it}
                      onChange={(e) => setDeptForm({ ...deptForm, is_it: e.target.checked })}
                    />
                    Es un departamento interno de Sistemas (TI)
                  </label>
                </div>
              </div>
              <div className="mgmt-form-footer">
                {editingDept && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={cancelEditDept}>
                    Cancelar
                  </button>
                )}
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingDept ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mgmt-list">
          {deptSearch.filtered.length === 0 && (
            <div className="mgmt-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4"><path d="M3 21h18"/><path d="M19 21v-4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"/></svg>
              <p>{deptSearch.q ? 'No se encontraron departamentos' : 'No hay departamentos creados'}</p>
            </div>
          )}
          {deptSearch.filtered.map((d) => (
            <div key={d.department_id} className="mgmt-card">
              <div className="mgmt-card-body">
                <div className="mgmt-card-info">
                  <StatusDot active={d.is_active} />
                  <div>
                    <div className="mgmt-card-name">
                      {d.name} <Badge variant="gray">{d.code}</Badge>
                      {d.is_it && <Badge variant="blue">Interno TI</Badge>}
                    </div>
                    {d.description && <div className="mgmt-card-desc">{d.description}</div>}
                  </div>
                </div>
              </div>
              <div className="mgmt-card-actions">
                <button className="mgmt-icon-btn" onClick={() => startEditDept(d)} title="Editar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="mgmt-icon-btn mgmt-icon-btn--danger" onClick={() => handleDeleteDept(d.department_id, d.name)} title="Eliminar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
