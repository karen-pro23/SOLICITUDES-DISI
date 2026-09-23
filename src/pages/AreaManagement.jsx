import { useState, useEffect, useMemo } from 'react';
import { getAreasByDepartment, createArea, updateArea, deleteArea, getDepartments } from '../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import './AdminPage.css';

const DeptIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export default function AreaManagement() {
  const [departments, setDepartments] = useState([]);
  const [allAreas, setAllAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', departmentId: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');

  useEffect(() => {
    loadAllAreas();
  }, []);

  async function loadAllAreas() {
    setLoading(true);
    try {
      const depts = await getDepartments();
      setDepartments(depts);
      const allAreasList = [];
      for (const dept of depts) {
        try {
          const areas = await getAreasByDepartment(dept.department_id);
          areas.forEach(a => { a.department_name = dept.name; a.department_id = dept.department_id; });
          allAreasList.push(...areas);
        } catch (_) {}
      }
      setAllAreas(allAreasList);
    } catch () {
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  const stats = useMemo(() => ({
    total: allAreas.length,
    active: allAreas.filter(a => a.is_active).length,
    withLeader: allAreas.filter(a => a.leader_name).length,
    withMembers: allAreas.filter(a => a.member_count > 0).length,
  }), [allAreas]);

  const filteredAreas = useMemo(() => {
    let result = allAreas;
    if (filterDept) result = result.filter(a => a.department_id === parseInt(filterDept));
    if (search.trim()) {
      const term = search.toUpperCase();
      result = result.filter(a =>
        a.name.toUpperCase().includes(term) ||
        (a.department_name || '').toUpperCase().includes(term) ||
        (a.description || '').toUpperCase().includes(term) ||
        (a.leader_name || '').toUpperCase().includes(term)
      );
    }
    return result;
  }, [allAreas, search, filterDept]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.departmentId) return;
    setSubmitting(true);
    const action = editingArea
      ? updateArea(editingArea.area_id, formData.name, formData.description)
      : createArea(formData.departmentId, formData.name, formData.description);
    action
      .then(() => { toast.success(editingArea ? 'Área actualizada' : 'Área creada'); handleCloseForm(); return loadAllAreas(); })
      .catch(err => toast.error(err.response?.data?.error || 'Error al guardar'))
      .finally(() => setSubmitting(false));
  }

  function handleEdit(area) {
    setEditingArea(area);
    setFormData({ name: area.name, description: area.description || '', departmentId: area.department_id || '' });
    setShowForm(true);
  }

  function confirmDeleteAction() {
    setSubmitting(true);
    deleteArea(confirmDelete.area_id)
      .then(() => { toast.success('Área eliminada'); setConfirmDelete(null); return loadAllAreas(); })
      .catch(err => toast.error(err.response?.data?.error || 'Error al eliminar'))
      .finally(() => setSubmitting(false));
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingArea(null);
    setFormData({ name: '', description: '', departmentId: '' });
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Gestión de Áreas</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Administra las áreas técnicas de cada departamento</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nueva Área
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Áreas', value: stats.total, color: '#6366f1', bg: '#eef2ff' },
          { label: 'Activas', value: stats.active, color: '#10b981', bg: '#ecfdf5' },
          { label: 'Con Jefe', value: stats.withLeader, color: '#f59e0b', bg: '#fffbeb' },
          { label: 'Con Miembros', value: stats.withMembers, color: '#8b5cf6', bg: '#f5f3ff' },
        ].map(s => (
          <div key={s.label} style={{ background: 'white', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>{s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar: Search + Filter */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="mgmt-search" style={{ flex: 1, minWidth: '200px' }}>
          <SearchIcon />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar área, departamento, jefe..."
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          style={{
            padding: '0.5rem 2rem 0.5rem 0.75rem',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            fontSize: '0.8125rem',
            fontFamily: 'inherit',
            background: 'white',
            color: '#334155',
            cursor: 'pointer',
            minWidth: '180px',
          }}
        >
          <option value="">Todos los departamentos</option>
          {departments.map(d => (
            <option key={d.department_id} value={d.department_id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="mgmt-skeleton">
            {[1,2,3].map(i => <div key={i} className="mgmt-skeleton-card" />)}
          </div>
        ) : filteredAreas.length === 0 ? (
          <div className="mgmt-empty">
            <DeptIcon />
            <p>{search || filterDept ? 'No se encontraron áreas con esos filtros' : 'No hay áreas registradas. Creá la primera.'}</p>
            {!search && !filterDept && (
              <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Crear Área</button>
            )}
          </div>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Área</th>
                  <th style={{ width: '20%' }}>Departamento</th>
                  <th style={{ width: '20%' }}>Jefe de Área</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Miembros</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Estado</th>
                  <th style={{ width: '15%', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAreas.map(area => (
                  <tr key={area.area_id} style={{ transition: 'background 0.15s' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: area.is_active ? '#eef2ff' : '#f1f5f9', color: area.is_active ? '#6366f1' : '#94a3b8', flexShrink: 0
                        }}>
                          <DeptIcon />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#0f172a' }}>{area.name}</div>
                          {area.description && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.125rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{area.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="mgmt-badge mgmt-badge--blue">{area.department_name}</span></td>
                    <td>
                      {area.leader_name ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', fontWeight: 700, color: '#4f46e5' }}>
                            {area.leader_name.split(' ').map(w => w[0]).join('').substring(0, 2)}
                          </div>
                          <span style={{ fontSize: '0.8125rem', color: '#334155' }}>{area.leader_name}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: '#cbd5e1', fontStyle: 'italic' }}>Sin asignar</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: '24px', height: '24px', borderRadius: '6px',
                        background: area.member_count > 0 ? '#dcfce7' : '#f1f5f9',
                        color: area.member_count > 0 ? '#166534' : '#94a3b8',
                        fontSize: '0.75rem', fontWeight: 700
                      }}>
                        {area.member_count || 0}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`mgmt-badge ${area.is_active ? 'mgmt-badge--green' : 'mgmt-badge--red'}`}>
                        {area.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                        <button className="mgmt-icon-btn" title="Editar" onClick={() => handleEdit(area)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="mgmt-icon-btn mgmt-icon-btn--danger" title="Eliminar" onClick={() => setConfirmDelete(area)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de formulario */}
      {showForm && (
        <div className="modal-overlay" onClick={handleCloseForm}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <DeptIcon /> {editingArea ? 'Editar Área' : 'Nueva Área'}
              </h3>
              <button className="modal-close-btn" onClick={handleCloseForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#334155', marginBottom: '0.375rem', display: 'block' }}>Departamento *</label>
                  <select
                    value={formData.departmentId}
                    onChange={e => setFormData({ ...formData, departmentId: e.target.value })}
                    required
                    disabled={!!editingArea}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', fontFamily: 'inherit', background: editingArea ? '#f8fafc' : 'white', cursor: editingArea ? 'not-allowed' : 'pointer' }}
                  >
                    <option value="">Seleccionar departamento...</option>
                    {departments.map(d => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#334155', marginBottom: '0.375rem', display: 'block' }}>Nombre del Área *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value.toLocaleUpperCase() })}
                    placeholder="Ej: DESARROLLO, SOPORTE, REDES..."
                    required
                    autoFocus
                    style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', fontFamily: 'inherit', letterSpacing: '0.02em' }}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#334155', marginBottom: '0.375rem', display: 'block' }}>Descripción <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span></label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Qué hace esta área..."
                    rows={3}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={handleCloseForm} disabled={submitting}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !formData.name.trim() || !formData.departmentId}>
                  {submitting ? 'Guardando...' : editingArea ? 'Actualizar' : 'Crear Área'}
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
        title="Eliminar área"
        description={`¿Eliminar "${confirmDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        confirmClassName="btn-danger"
        submitting={submitting}
        submittingLabel="Eliminando..."
      />
    </div>
  );
}
