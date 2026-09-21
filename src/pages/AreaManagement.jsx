import { useState, useEffect } from 'react';
import { getAreasByDepartment, createArea, updateArea, deleteArea, getDepartments } from '../services/api';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';
import './AdminPage.css';

export default function AreaManagement() {
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getDepartments().then(setDepartments).catch(() => toast.error('Error al cargar departamentos'));
  }, []);

  useEffect(() => {
    if (selectedDept) {
      setLoading(true);
      getAreasByDepartment(selectedDept)
        .then(setAreas)
        .catch(() => toast.error('Error al cargar áreas'))
        .finally(() => setLoading(false));
    } else {
      setAreas([]);
    }
  }, [selectedDept]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!formData.name.trim()) return;
    
    setSubmitting(true);
    const action = editingArea
      ? updateArea(editingArea.area_id, formData.name, formData.description)
      : createArea(selectedDept, formData.name, formData.description);

    action
      .then(() => {
        toast.success(editingArea ? 'Área actualizada' : 'Área creada');
        setShowForm(false);
        setEditingArea(null);
        setFormData({ name: '', description: '' });
        return getAreasByDepartment(selectedDept);
      })
      .then(setAreas)
      .catch(err => toast.error(err.response?.data?.error || 'Error al guardar'))
      .finally(() => setSubmitting(false));
  }

  function handleEdit(area) {
    setEditingArea(area);
    setFormData({ name: area.name, description: area.description || '' });
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
        return getAreasByDepartment(selectedDept);
      })
      .then(setAreas)
      .catch(err => toast.error(err.response?.data?.error || 'Error al eliminar'))
      .finally(() => setSubmitting(false));
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingArea(null);
    setFormData({ name: '', description: '' });
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Gestión de Áreas</h1>
        <p className="admin-subtitle">Administra las áreas dentro de cada departamento</p>
      </div>

      {/* Selector de departamento */}
      <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
          Seleccionar Departamento
        </label>
        <select
          value={selectedDept}
          onChange={(e) => setSelectedDept(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem',
            border: '2px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '0.9375rem',
            fontFamily: 'inherit',
            background: 'white',
          }}
        >
          <option value="">Seleccionar departamento...</option>
          {departments.map(dept => (
            <option key={dept.department_id} value={dept.department_id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      {selectedDept && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>Áreas del Departamento</h2>
            <button
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              + Nueva Área
            </button>
          </div>

          {loading ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Cargando áreas...</p>
          ) : areas.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
              No hay áreas registradas en este departamento
            </p>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Descripción</th>
                    <th>Jefe de Área</th>
                    <th>Miembros</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {areas.map(area => (
                    <tr key={area.area_id}>
                      <td style={{ fontWeight: 600 }}>{area.name}</td>
                      <td>{area.description || '-'}</td>
                      <td>{area.leader_name || 'Sin asignar'}</td>
                      <td>{area.member_count || 0}</td>
                      <td>
                        <span className={`status-badge ${area.is_active ? 'status-active' : 'status-inactive'}`}>
                          {area.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleEdit(area)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDelete(area)}
                          >
                            Eliminar
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
      )}

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
                  <label>Nombre del Área *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Desarrollo, Soporte, QA..."
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
                <button type="submit" className="btn btn-primary" disabled={submitting || !formData.name.trim()}>
                  {submitting ? 'Guardando...' : editingArea ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
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
