import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getRequests,
  getModules,
  updateRequestStatus,
  updateRequestPriority,
  addComment,
  getMetrics,
} from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import SelectOptionModal from '../components/SelectOptionModal';
import {
  STATUS_OPTIONS,
  STATUS_TRANSITIONS,
  PRIORITY_OPTIONS,
} from '../constants/requestOptions';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', search: '', priority: '' });
  const [metrics, setMetrics] = useState(null);

  // Modal State
  const [activeStatusReq, setActiveStatusReq] = useState(null); // solicitud cuyo estado se edita
  const [activePriorityReq, setActivePriorityReq] = useState(null); // solicitud cuya prioridad se edita
  const [pendingStatus, setPendingStatus] = useState(null); // estado elegido pendiente de confirmar (nota)
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Al abrir el modal de estado, reiniciar la selección pendiente
  useEffect(() => {
    if (activeStatusReq) setPendingStatus(null);
  }, [activeStatusReq]);

  const fetchRequests = useCallback(async (cursor) => {
    setLoading(true);
    try {
      const params = { limit: 25 };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.priority) params.priority = filters.priority;
      if (cursor) params.cursor = cursor;

      const [data, metricsData] = await Promise.all([
        getRequests(params),
        getMetrics().catch(() => null),
      ]);

      if (cursor) {
        setRequests((prev) => [...prev, ...data.requests]);
      } else {
        setRequests(data.requests);
      }
      setPagination(data.pagination);
      if (metricsData) setMetrics(metricsData);
    } catch (err) {
      console.error('Error al obtener solicitudes:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  function handleStatusTab(statusKey) {
    setFilters((prev) => ({ ...prev, status: statusKey }));
  }

  function handleSearch(e) {
    e.preventDefault();
    fetchRequests();
  }

  // Acciones Rápidas
  async function submitStatus(req, value, note) {
    if (!req) return;
    setModalSubmitting(true);
    try {
      if (value === 'RECHAZADA') {
        await updateRequestStatus(req.request_id, 'RECHAZADA', note);
      } else {
        await updateRequestStatus(req.request_id, value);
        if (value === 'COMPLETADA' && note && note.trim()) {
          await addComment(req.request_id, note, false);
        }
      }
      setActiveStatusReq(null);
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar la solicitud');
    } finally {
      setModalSubmitting(false);
    }
  }

  async function submitPriority(req, value) {
    if (!req) return;
    setModalSubmitting(true);
    try {
      await updateRequestPriority(req.request_id, value);
      setActivePriorityReq(null);
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar la solicitud');
    } finally {
      setModalSubmitting(false);
    }
  }

  // Flujo "seleccionar y luego notar":
  // - Si viene una nota (flujo CONFIRMAR del modal), se envía directo.
  // - Si no viene nota y el estado no requiere nota, se envía directo.
  // - Si el estado requiere nota (RECHAZADA/COMPLETADA), solo se registra
  //   pendingStatus para que el modal muestre el área de texto.
  function handleStatusSelect(value, note) {
    const req = activeStatusReq;
    if (!req) return;
    setPendingStatus(value);
    if (note !== null && note !== undefined) {
      submitStatus(req, value, note);
      return;
    }
    if (value !== 'RECHAZADA' && value !== 'COMPLETADA') {
      submitStatus(req, value, null);
    }
  }

  // Config de nota del modal de estado según la opción elegida
  const statusNoteConfig = (() => {
    if (pendingStatus === 'RECHAZADA') {
      return {
        label: 'MOTIVO DEL RECHAZO',
        placeholder: 'Indicá el motivo (obligatorio)...',
        required: true,
      };
    }
    if (pendingStatus === 'COMPLETADA') {
      return {
        label: 'NOTA DE SOLUCIÓN (OPCIONAL)',
        placeholder: 'Solución aplicada...',
        required: false,
      };
    }
    return null;
  })();

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Panel de Sistemas — Centro de Control</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Recepción, atención y resolución de solicitudes de los departamentos.
          </p>
        </div>
        <Link to="/requests/new" className="btn btn-primary">
          + Nueva Solicitud
        </Link>
      </div>

      {/* KPI Cards de Resumen */}
      {metrics && (
        <div className="dev-metrics-bar">
          <div className="dev-metric-card metric-total">
            <div className="dev-metric-val">{metrics.total}</div>
            <div className="dev-metric-lbl">Total Solicitudes</div>
          </div>

          <div className="dev-metric-card metric-resolved">
            <div className="dev-metric-val">
              {metrics.byStatus.find((s) => s.status === 'COMPLETADA')?.count || 0}
            </div>
            <div className="dev-metric-lbl">Atendidas / Completadas</div>
          </div>

          <div className="dev-metric-card metric-in-progress">
            <div className="dev-metric-val">
              {metrics.byStatus.find((s) => s.status === 'EN_PROCESO')?.count || 0}
            </div>
            <div className="dev-metric-lbl">En Atención</div>
          </div>

          <div className="dev-metric-card metric-pending">
            <div className="dev-metric-val">
              {metrics.byStatus.find((s) => s.status === 'PENDIENTE')?.count || 0}
            </div>
            <div className="dev-metric-lbl">Pendientes de Revisar</div>
          </div>

          <div className="dev-metric-card metric-rejected">
            <div className="dev-metric-val">{metrics.rejectedThisMonth}</div>
            <div className="dev-metric-lbl">Rechazadas (Mes)</div>
          </div>
        </div>
      )}

      {/* Pestañas y Filtros */}
      <div className="dev-toolbar">
        <div className="status-tabs">
          <button
            className={`tab-btn ${filters.status === '' ? 'active' : ''}`}
            onClick={() => handleStatusTab('')}
          >
            Todas
          </button>
          <button
            className={`tab-btn ${filters.status === 'PENDIENTE' ? 'active' : ''}`}
            onClick={() => handleStatusTab('PENDIENTE')}
          >
            Pendientes
          </button>
          <button
            className={`tab-btn ${filters.status === 'EN_PROCESO' ? 'active' : ''}`}
            onClick={() => handleStatusTab('EN_PROCESO')}
          >
            En Proceso
          </button>
          <button
            className={`tab-btn ${filters.status === 'EN_PRUEBAS' ? 'active' : ''}`}
            onClick={() => handleStatusTab('EN_PRUEBAS')}
          >
            En Pruebas
          </button>
          <button
            className={`tab-btn ${filters.status === 'COMPLETADA' ? 'active' : ''}`}
            onClick={() => handleStatusTab('COMPLETADA')}
          >
            Completadas
          </button>
          <button
            className={`tab-btn ${filters.status === 'RECHAZADA' ? 'active' : ''}`}
            onClick={() => handleStatusTab('RECHAZADA')}
          >
            Rechazadas
          </button>
        </div>

        <form onSubmit={handleSearch} className="search-form" style={{ maxWidth: '320px' }}>
          <input
            type="text"
            placeholder="Buscar ticket o descripción..."
            value={filters.search}
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value.toLocaleUpperCase() }))}
          />
          <button type="submit" className="btn btn-outline">Buscar</button>
        </form>

        {/* Filtro de Prioridad */}
        <div className="priority-filter">
          <select
            value={filters.priority}
            onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))}
            className="priority-select"
          >
            <option value="">Todas las prioridades</option>
            {PRIORITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de Bandeja de Solicitudes */}
      {loading && requests.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: '3rem 0' }}>
          Cargando bandeja de solicitudes...
        </p>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <p>No se encontraron solicitudes en esta categoría.</p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Solicitante / Dpto</th>
                  <th>Módulo</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.request_id}>
                    <td>
                      <Link to={`/requests/${req.request_id}`} style={{ fontWeight: 700 }}>
                        {req.ticket_code}
                      </Link>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--color-gray-900)' }}>
                        {req.created_by_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-gray-500)' }}>
                        {req.department_name || 'Departamento'}
                      </div>
                    </td>
                    <td>{req.module_name}</td>
                    <td>
                      <StatusBadge status={req.status} />
                    </td>
                     <td>
                       <span
                         className={`priority-pill priority-${req.priority}`}
                         style={{
                           fontSize: '0.75rem',
                           fontWeight: 700,
                           padding: '0.375rem 0.75rem',
                           borderRadius: '24px',
                           textTransform: 'uppercase',
                           letterSpacing: '0.05em',
                           boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
                           transition: 'all 0.2s ease',
                           background:
                             req.priority === 'alta'
                               ? 'linear-gradient(135deg, #fef2f2, #fee2e2)'
                               : req.priority === 'media'
                               ? 'linear-gradient(135deg, #fffbeb, #fef3c7)'
                               : req.priority === 'baja'
                               ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                               : 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                            color:
                              req.priority === 'alta'
                                ? '#dc2626'
                                : req.priority === 'media'
                                ? '#d97706'
                                : req.priority === 'baja'
                                ? '#16a34a'
                                : '#64748b',
                            border: `1.5px solid ${req.priority === 'alta' ? '#fca5a5' : req.priority === 'media' ? '#fcd34d' : req.priority === 'baja' ? '#86efac' : '#cbd5e1'}`,
                            position: 'relative',
                            overflow: 'hidden',
                            backgroundImage:
                              req.priority === 'alta'
                                ? 'linear-gradient(135deg, #fef2f2, #fee2e2)'
                                : req.priority === 'media'
                                ? 'linear-gradient(135deg, #fffbeb, #fef3c7)'
                                : req.priority === 'baja'
                                ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
                                : 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
                          }}
                       >
                         {req.priority}
                       </span>
                     </td>
                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setActiveStatusReq(req)}
                          title="Cambiar estado de la solicitud"
                        >
                          ESTADO
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setActivePriorityReq(req)}
                          title="Cambiar prioridad de la solicitud"
                        >
                          PRIORIDAD
                        </button>
                        <Link to={`/requests/${req.request_id}`} className="btn btn-sm btn-outline">
                          VER DETALLE
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination?.hasMore && (
            <div className="pagination-actions">
              <button
                className="btn btn-outline"
                onClick={() => fetchRequests(pagination.nextCursor)}
                disabled={loading}
              >
                {loading ? 'Cargando...' : 'Cargar más solicitudes'}
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal de Estado */}
      <SelectOptionModal
        isOpen={Boolean(activeStatusReq)}
        onClose={() => setActiveStatusReq(null)}
        title="CAMBIAR ESTADO"
        description={activeStatusReq ? `Ticket ${activeStatusReq.ticket_code}` : undefined}
        options={STATUS_OPTIONS.map((opt) => ({
          ...opt,
          disabled: !STATUS_TRANSITIONS[activeStatusReq?.status]?.includes(opt.value),
          active: opt.value === activeStatusReq?.status,
        }))}
        noteConfig={statusNoteConfig}
        onSelect={handleStatusSelect}
        submitting={modalSubmitting}
      />

      {/* Modal de Prioridad */}
      <SelectOptionModal
        isOpen={Boolean(activePriorityReq)}
        onClose={() => setActivePriorityReq(null)}
        title="CAMBIAR PRIORIDAD"
        description={activePriorityReq ? `Ticket ${activePriorityReq.ticket_code}` : undefined}
        options={PRIORITY_OPTIONS.map((opt) => ({
          ...opt,
          active: opt.value === activePriorityReq?.priority,
        }))}
        onSelect={(value) => submitPriority(activePriorityReq, value)}
        noteConfig={null}
        submitting={modalSubmitting}
      />
    </div>
  );
}
