import { useState, useEffect } from 'react';
import { getDepartments, getUsersByDepartment, assignRequest, getAreasByDepartment } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function AssignModal({ isOpen, onClose, request, onAssignComplete }) {
  const { user } = useAuth();
  const [departments, setDepartments] = useState([]);
  const [areas, setAreas] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoadingDepts(true);
      getDepartments()
        .then((allDepts) => {
          // Filtramos primero todos los que son internos (is_it)
          let validDepts = allDepts.filter(d => d.is_it);
          if (user.role === 'requester' && user.es_jefe) {
            // Un jefe solo puede ver su propio departamento
            validDepts = validDepts.filter(d => d.department_id === user.departmentId);
            setSelectedDept(user.departmentId);
          } else {
            setSelectedDept(request?.assigned_department_id || '');
          }
          setDepartments(validDepts);
        })
        .catch(() => toast.error('Error al cargar departamentos'))
        .finally(() => setLoadingDepts(false));
      
      // Reset state
      setSelectedArea(request?.area_id || '');
      setSelectedEmp(request?.empleado_asignado_id || '');
      setAreas([]);
      setEmployees([]);
    }
  }, [isOpen, request]);

  useEffect(() => {
    if (selectedDept) {
      setLoadingAreas(true);
      getAreasByDepartment(selectedDept)
        .then(setAreas)
        .catch(() => toast.error('Error al cargar áreas'))
        .finally(() => setLoadingAreas(false));
      
      setLoadingEmps(true);
      getUsersByDepartment(selectedDept)
        .then(setEmployees)
        .catch(() => toast.error('Error al cargar empleados'))
        .finally(() => setLoadingEmps(false));
    } else {
      setAreas([]);
      setEmployees([]);
      setSelectedArea('');
      setSelectedEmp('');
    }
  }, [selectedDept]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!selectedDept && !selectedEmp) {
        toast.error('Selecciona un departamento o un empleado');
        return;
      }
      
      await assignRequest(request.request_id, {
        assignedDepartmentId: selectedDept || null,
        assigneeId: selectedEmp || null,
        areaId: selectedArea || null
      });
      toast.success('Solicitud asignada con éxito');
      onAssignComplete();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al asignar la solicitud');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="assign-modal-title">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <h3 id="assign-modal-title">Asignar Solicitud</h3>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar modal">✕</button>
          </div>
          
          <div className="modal-body">
            <p style={{ marginBottom: '1rem', color: 'var(--color-text-light)' }}>
              Ticket: <strong>{request?.ticket_code}</strong>
            </p>
            
            <div className="form-group">
              <label htmlFor="dept-select">1. Asignar a Departamento</label>
              <select 
                id="dept-select"
                value={selectedDept} 
                onChange={(e) => {
                  setSelectedDept(e.target.value);
                  setSelectedArea('');
                  setSelectedEmp('');
                }}
                disabled={loadingDepts || submitting || (user.role === 'requester' && user.es_jefe)}
              >
                <option value="">-- Sin asignar a departamento --</option>
                {departments.map(d => (
                  <option key={d.department_id} value={d.department_id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="area-select">2. Asignar a Área (Opcional)</label>
              <select 
                id="area-select"
                value={selectedArea} 
                onChange={(e) => setSelectedArea(e.target.value)}
                disabled={!selectedDept || loadingAreas || submitting}
              >
                <option value="">-- Sin asignar a área específica --</option>
                {areas.map(a => (
                  <option key={a.area_id} value={a.area_id}>{a.name}</option>
                ))}
              </select>
              {loadingAreas && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Cargando áreas...</span>}
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="emp-select">3. Asignar a Empleado (Opcional)</label>
              <select 
                id="emp-select"
                value={selectedEmp} 
                onChange={(e) => setSelectedEmp(e.target.value)}
                disabled={!selectedDept || loadingEmps || submitting}
              >
                <option value="">-- Sin asignar a empleado específico --</option>
                {employees.map(e => (
                  <option key={e.user_id} value={e.user_id}>{e.full_name}</option>
                ))}
              </select>
              {loadingEmps && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Cargando empleados...</span>}
            </div>
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting || (!selectedDept && !selectedEmp)}>
              {submitting ? 'Asignando...' : 'Asignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
