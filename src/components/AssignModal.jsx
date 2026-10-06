import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getDepartments, getUsersByDepartment, getUsersByArea, assignRequest, getAreasByDepartment, getPublicDepartments } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { isSupportRequest } from '../constants/requestOptions';

export default function AssignModal({ isOpen, onClose, request, onAssignComplete }) {
  const { user } = useAuth();
  const role = user?.role;
  const isRecepcion = role === 'recepcion';
  const isJefeArea = role === 'jefe_area';
  const isSupport = isSupportRequest(request);
  // El contexto expone el usuario tal cual lo devuelven los endpoints de auth:
  // tras login viene camelCase (areaId) y tras recargar la página (/auth/me)
  // viene snake_case (area_id). Normalizamos ambos casos sin fetch extra.
  const myAreaId = user?.areaId ?? user?.area_id ?? null;
  const [departments, setDepartments] = useState([]);
  const [areas, setAreas] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedEmp, setSelectedEmp] = useState('');
  const [assetConsecutive, setAssetConsecutive] = useState('');
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [loadingAreas, setLoadingAreas] = useState(false);
  const [loadingEmps, setLoadingEmps] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedArea(request?.area_id || '');
    setSelectedEmp(request?.empleado_asignado_id || '');
    setAssetConsecutive(request?.asset_consecutive || '');
    setAreas([]);
    setEmployees([]);

    // Jefe de área: sin pasos 1 ni 2; carga directa de los empleados de SU área
    if (isJefeArea) {
      setLoadingDepts(false);
      setDepartments([]);
      setSelectedDept('');
      if (myAreaId) {
        setLoadingEmps(true);
        getUsersByArea(myAreaId)
          .then(setEmployees)
          .catch(() => toast.error('Error al cargar los empleados de tu área'))
          .finally(() => setLoadingEmps(false));
      }
      return;
    }

    setLoadingDepts(true);
    getDepartments()
      // /admin/departments es solo admin/super_admin; el resto de roles de equipo
      // cae al catálogo público (mismo shape) para poder llegar al selector de áreas.
      .catch(() => getPublicDepartments())
      .then((allDepts) => {
        let validDepts = allDepts.filter(d => d.is_it);
        if (user.role === 'requester' && user.es_jefe) {
          validDepts = validDepts.filter(d => d.department_id === user.departmentId);
          setSelectedDept(user.departmentId);
        } else if (isRecepcion) {
          // Todas las solicitudes van a Sistemas: preseleccionamos su
          // departamento (el único con is_it) y el paso 1 queda oculto.
          setSelectedDept(validDepts[0]?.department_id ?? '');
        } else {
          setSelectedDept(request?.assigned_department_id || '');
        }
        setDepartments(validDepts);
      })
      .catch(() => toast.error('Error al cargar departamentos'))
      .finally(() => setLoadingDepts(false));
  }, [isOpen, request, isJefeArea, isRecepcion, myAreaId]);

  // Paso 1: Se selecciona depto → carga áreas
  useEffect(() => {
    if (isJefeArea) return; // el jefe no tiene selector de área
    if (selectedDept) {
      setLoadingAreas(true);
      getAreasByDepartment(selectedDept)
        .then(setAreas)
        .catch(() => toast.error('Error al cargar áreas'))
        .finally(() => setLoadingAreas(false));
    } else {
      setAreas([]);
    }
    // Al cambiar depto, limpiar área y empleados
    setSelectedArea('');
    setSelectedEmp('');
    setEmployees([]);
  }, [selectedDept, isJefeArea]);

  // Paso 2: Se selecciona área → carga empleados de esa área
  useEffect(() => {
    if (isJefeArea) return; // los empleados del jefe ya vienen de getUsersByArea(myAreaId)
    if (isRecepcion) return; // recepción no muestra el paso de empleado (y no lo envía)
    if (selectedArea) {
      setLoadingEmps(true);
      getUsersByArea(selectedArea)
        .then(setEmployees)
        .catch(() => toast.error('Error al cargar empleados del área'))
        .finally(() => setLoadingEmps(false));
    } else if (selectedDept) {
      // Sin área seleccionada → mostrar todos los empleados del depto
      setLoadingEmps(true);
      getUsersByDepartment(selectedDept)
        .then(setEmployees)
        .catch(() => toast.error('Error al cargar empleados'))
        .finally(() => setLoadingEmps(false));
    } else {
      setEmployees([]);
    }
    setSelectedEmp('');
  }, [selectedArea, selectedDept, isJefeArea, isRecepcion]);

  if (!isOpen) return null;

  const selectedAreaName = areas.find((a) => String(a.area_id) === String(selectedArea))?.name;
  const selectedEmpName = employees.find((e) => String(e.user_id) === String(selectedEmp))?.full_name;

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSupport && request?.status === 'PENDIENTE' && !assetConsecutive.trim()) {
      toast.error('El número de bien es obligatorio para solicitudes de servicio técnico');
      return;
    }

    setSubmitting(true);
    try {
      let successMessage = 'Solicitud asignada con éxito';

      if (isRecepcion) {
        // Recepción solo deriva: areaId obligatorio y NUNCA se envía assigneeId
        if (!selectedArea) {
          toast.error('Selecciona el área al que derivas la solicitud');
          setSubmitting(false);
          return;
        }
        await assignRequest(request.request_id, {
          assignedDepartmentId: selectedDept || null,
          areaId: selectedArea,
          assetConsecutive: assetConsecutive.trim() || undefined,
        });
        successMessage = 'Solicitud derivada con éxito';
      } else if (isJefeArea) {
        // El jefe solo asigna empleados de su área (la pertenencia la valida el backend)
        if (!selectedEmp) {
          toast.error('Selecciona el empleado que tomará la solicitud');
          setSubmitting(false);
          return;
        }
        await assignRequest(request.request_id, {
          assigneeId: selectedEmp,
          assetConsecutive: assetConsecutive.trim() || undefined,
        });
      } else {
        if (!selectedDept && !selectedEmp) {
          toast.error('Selecciona un departamento o un empleado');
          setSubmitting(false);
          return;
        }
        await assignRequest(request.request_id, {
          assignedDepartmentId: selectedDept || null,
          assigneeId: selectedEmp || null,
          areaId: selectedArea || null,
          assetConsecutive: assetConsecutive.trim() || undefined,
        });
      }

      toast.success(successMessage);
      onAssignComplete();
      onClose();
    } catch (err) {
      // 400/403 del backend: muestra el mensaje del servidor en el toast
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
            <button type="button" className="btn-close" onClick={onClose} aria-label="Cerrar modal"><X size={18} /></button>
          </div>
          
          <div className="modal-body">
            <p style={{ marginBottom: '1rem', color: 'var(--color-text-light)' }}>
              Ticket: <strong>{request?.ticket_code}</strong>
            </p>

            {isSupport && (
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="assign-asset-consecutive" style={{ fontWeight: 600 }}>
                  Número / Código del Bien {request?.status === 'PENDIENTE' && <span style={{ color: '#ef4444' }}>*</span>}
                </label>
                <input
                  id="assign-asset-consecutive"
                  type="text"
                  className="form-control"
                  placeholder="Ej: BN-004521"
                  value={assetConsecutive}
                  onChange={(e) => setAssetConsecutive(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem',
                    border: '1px solid var(--color-border)',
                    borderRadius: '6px',
                    marginTop: '0.25rem',
                  }}
                  required={request?.status === 'PENDIENTE'}
                />
                <small style={{ fontSize: '0.78rem', color: 'var(--color-text-light)', display: 'block', marginTop: '0.25rem' }}>
                  {request?.status === 'PENDIENTE'
                    ? 'Obligatorio para pasar el ticket de servicio técnico a asignado.'
                    : 'Código patrimonial del equipo a intervenir.'}
                </small>
              </div>
            )}
            
            {/* Recepción no elige departamento: toda solicitud va a Sistemas,
                así que su departamento se preselecciona y solo queda el área */}
            {!isJefeArea && !isRecepcion && (
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
            )}

            {!isJefeArea && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="area-select">{isRecepcion ? 'Derivar a Área' : '2. Asignar a Área (Opcional)'}</label>
              <select 
                id="area-select"
                value={selectedArea} 
                onChange={(e) => setSelectedArea(e.target.value)}
                disabled={!selectedDept || loadingAreas || submitting}
              >
                <option value="">{isRecepcion ? '-- Selecciona el área de destino --' : '-- Sin asignar a área específica --'}</option>
                {areas.map(a => (
                  <option key={a.area_id} value={a.area_id}>{a.name}</option>
                ))}
              </select>
              {loadingAreas && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Cargando áreas...</span>}
            </div>
            )}

            {!isRecepcion && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="emp-select">{isJefeArea ? 'Asignar a Empleado' : '3. Asignar a Empleado (Opcional)'}</label>
              <select 
                id="emp-select"
                value={selectedEmp} 
                onChange={(e) => setSelectedEmp(e.target.value)}
                disabled={(!isJefeArea && !selectedDept) || loadingEmps || submitting}
              >
                <option value="">{isJefeArea ? '-- Selecciona un empleado --' : '-- Sin asignar a empleado específico --'}</option>
                {employees.map(e => (
                  <option key={e.user_id} value={e.user_id}>{e.full_name}</option>
                ))}
              </select>
              {loadingEmps && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>Cargando empleados...</span>}
              {isJefeArea && !myAreaId && (
                <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>No tienes un área asignada. Contacta al administrador.</span>
              )}
            </div>
            )}
          </div>
          
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={submitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting
                || (isSupport && request?.status === 'PENDIENTE' && !assetConsecutive.trim())
                || (isRecepcion && !selectedArea)
                || (isJefeArea && !selectedEmp)
                || (!isRecepcion && !isJefeArea && !selectedDept && !selectedEmp)}
            >
              {submitting
                ? (isRecepcion ? 'Derivando...' : 'Asignando...')
                : isRecepcion
                  ? (selectedArea ? `Derivar a ${selectedAreaName}` : 'Derivar a área')
                  : isJefeArea
                    ? (selectedEmp ? `Asignar a ${selectedEmpName}` : 'Asignar a empleado')
                    : 'Asignar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
