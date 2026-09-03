import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getRequests,
  getModules,
  updateRequestStatus,
  updateRequestPriority,
  deleteRequest,
  addComment,
  getMetrics,
} from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import SelectOptionModal from '../components/SelectOptionModal';
import PaginationControl from '../components/PaginationControl';
import {
  STATUS_OPTIONS,
  STATUS_TRANSITIONS,
  PRIORITY_OPTIONS,
} from '../constants/requestOptions';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
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

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.priority) params.priority = filters.priority;

      const [data, metricsData] = await Promise.all([
        getRequests(params),
        getMetrics().catch(() => null),
      ]);

      setRequests(data.requests || []);
      setPagination(data.pagination);
      if (metricsData) setMetrics(metricsData);
    } catch (err) {
      console.error('Error al obtener solicitudes:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  function handleStatusTab(statusKey) {
    setPage(1);
    setFilters((prev) => ({ ...prev, status: statusKey }));
  }

  function handleSearch(e) {
    e.preventDefault();
    setPage(1);
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

  async function handleDeleteRequest(req) {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente la solicitud ${req.ticket_code}?`)) {
      return;
    }
    try {
      await deleteRequest(req.request_id);
      toast.success(`Solicitud ${req.ticket_code} eliminada con éxito`);
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar la solicitud');
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
            <table className="table request-table">
              <thead>
                <tr>
                  <th>Código / Ticket</th>
                  <th>Solicitante y Origen</th>
                  <th>Módulo Afectado</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const initial = (req.created_by_name || 'U').charAt(0).toUpperCase();
                  return (
                    <tr key={req.request_id} className="request-table-row">
                      <td className="col-ticket">
                        <Link to={`/requests/${req.request_id}`} className="ticket-badge-link">
                          <svg className="ticket-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z"/><path d="M13 5v2"/><path d="M13 11v2"/><path d="M13 17v2"/></svg>
                          <span className="ticket-code-text">{req.ticket_code}</span>
                        </Link>
                      </td>
                      <td className="col-user">
                        <div className="user-info-cell">
                          <div className="user-avatar">{initial}</div>
                          <div>
                            <div className="user-name">{req.created_by_name || 'Usuario'}</div>
                            <div className="user-dept">{req.department_name || 'Sin departamento'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="col-module">
                        <span className="module-tag">{req.module_name}</span>
                      </td>
                      <td className="col-status">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="col-priority">
                        <span className={`priority-pill priority-${req.priority}`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="col-date">
                        <span className="date-text">{new Date(req.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="col-actions" style={{ textAlign: 'right' }}>
                        <div className="row-actions-group">
                          <button
                            type="button"
                            className="btn-action-pill btn-action-status"
                            onClick={() => setActiveStatusReq(req)}
                            title="Cambiar estado de la solicitud"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg> Estado
                          </button>
                          <button
                            type="button"
                            className="btn-action-pill btn-action-priority"
                            onClick={() => setActivePriorityReq(req)}
                            title="Cambiar prioridad de la solicitud"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> Prioridad
                          </button>
                          <Link to={`/requests/${req.request_id}`} className="btn-action-pill btn-action-detail">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Detalle
                          </Link>
                          {user && user.role !== 'requester' && (
                            <button
                              type="button"
                              className="btn-action-pill btn-action-delete"
                              onClick={() => handleDeleteRequest(req)}
                              title="Eliminar solicitud"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationControl
            currentPage={pagination?.page || page}
            totalPages={pagination?.totalPages || 1}
            totalItems={pagination?.totalItems || requests.length}
            limit={limit}
            onPageChange={(newPage) => setPage(newPage)}
            onLimitChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
          />
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
