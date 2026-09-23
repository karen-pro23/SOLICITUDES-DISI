import { useState, useEffect, useMemo } from 'react';
import { getAreasByDepartment, createArea, updateArea, deleteArea, getDepartments } from '../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import './AdminPage.css';

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

  // Cargar todas las áreas de todos los departamentos
  useEffect(() => {
    setLoading(true);
    getDepartments()
      .then(async (depts) => {
        setDepartments(depts);
        const allAreasList = [];
        for (const dept of depts) {
          try {
            const areas = await getAreasByDepartment(dept.department_id);
            areas.forEach(a => {
              a.department_name = dept.name;
              a.department_id = dept.department_id;
            });
            allAreasList.push(...areas);
          } catch (_) {}
        }
        setAllAreas(allAreasList);
      })
      .catch(() => toast.error('Error al cargar datos'))
      .finally(() => setLoading(false));
  }, []);

  const filteredAreas = useMemo(() => {
    if (!search.trim()) return allAreas;
    const term = search.toUpperCase();
    return allAreas.filter(a =>
      a.name.toUpperCase().includes(term) ||
      (a.department_name || '').toUpperCase().includes(term) ||
      (a.description || '').toUpperCase().includes(term) ||
      (a.leader_name || '').toUpperCase().includes(term)
    );
  }, [allAreas, search]);

  const deptName = (id) => departments.find(d => d.department_id === id)?.name || '-';

  function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.departmentId) return;

    setSubmitting(true);
    const action = editingArea
      ? updateArea(editingArea.area_id, formData.name, formData.description)
      : createArea(formData.departmentId, formData.name, formData.description);

    action
      .then(() => {
        toast.success(editingArea ? 'Área actualizada' : 'Área creada');
        setShowForm(false);
        setEditingArea(null);
        setFormData({ name: '', description: '', departmentId: '' });
        // Recargar todo
        return loadAllAreas();
      })
      .catch(err => toast.error(err.response?.data?.error || 'Error al guardar'))
      .finally(() => setSubmitting(false));
  }

  async function loadAllAreas() {
    const allAreasList = [];
    for (const dept of departments) {
      try {
        const areas = await getAreasByDepartment(dept.department_id);
        areas.forEach(a => {
          a.department_name = dept.name;
          a.department_id = dept.department_id;
        });
        allAreasList.push(...areas);
      } catch (_) {}
    }
    setAllAreas(allAreasList);
  }

  function handleEdit(area) {
    setEditingArea(area);
    setFormData({ name: area.name, description: area.description || '', departmentId: area.department_id || '' });
    setShowForm(true);
  }

  function handleDelete(area) {
    setConfirmDelete(area);
  }

  function confirmDeleteAction() {
    setSubmitting(true);
    deleteArea(confirmDelete.area_id)
      .then(() => {
        toast.success('Área eliminada');
        setConfirmDelete(null);
        return loadAllAreas();
      })
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
      <div className="admin-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Gestión de Áreas</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Todas las áreas de todos los departamentos</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nueva Área
        </button>
      </div>

      {/* Búsqueda */}
      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar área, departamento, jefe..."
          style={{
            width: '100%',
            padding: '0.625rem 1rem',
            border: '2px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Tabla */}
      <div className="admin-card">
        {loading ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Cargando áreas...</p>
        ) : filteredAreas.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
            {search ? 'No se encontraron áreas con ese criterio' : 'No hay áreas registradas'}
          </p>
        ) : (
          <div className="admin-table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Departamento</th>
                  <th>Descripción</th>
                  <th>Jefe de Área</th>
                  <th>Miembros</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAreas.map(area => (
                  <tr key={area.area_id}>
                    <td style={{ fontWeight: 600 }}>{area.name}</td>
                    <td>{area.department_name}</td>
                    <td>{area.description || '-'}</td>
                    <td>{area.leader_name || 'Sin asignar'}</td>
                    <td>{area.member_count || 0}</td>
                    <td>
                      <span className={`status-badge ${area.is_active ? 'status-active' : 'status-inactive'}`}>
                        {area.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button className="btn btn-sm btn-outline" onClick={() => handleEdit(area)}>Editar</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(area)}>Eliminar</button>
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
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingArea ? 'Editar Área' : 'Nueva Área'}</h3>
              <button className="modal-close-btn" onClick={handleCloseForm}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Departamento *</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    required
                    disabled={!!editingArea}
                  >
                    <option value="">Seleccionar departamento...</option>
                    {departments.map(d => (
                      <option key={d.department_id} value={d.department_id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Nombre del Área *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toLocaleUpperCase() })}
                    placeholder="Ej: DESARROLLO, SOPORTE, REDES..."
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Descripción (opcional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción breve del área..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={handleCloseForm} disabled={submitting}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || !formData.name.trim() || !formData.departmentId}>
                  {submitting ? 'Guardando...' : editingArea ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación */}
      <ConfirmModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
        title="Eliminar área"
        description={`¿Estás seguro de que deseas eliminar el área "${confirmDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        confirmClassName="btn-danger"
        submitting={submitting}
        submittingLabel="Eliminando..."
      />
    </div>
  );
}
