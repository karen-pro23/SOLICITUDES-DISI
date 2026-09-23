import { useState, useEffect, useCallback, useRef } from 'react';
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
import ConfirmModal from '../components/ConfirmModal';
import AssignModal from '../components/AssignModal';
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
  const [sortConfig, setSortConfig] = useState({ key: null, dir: null });
  const seqRef = useRef(0);
  const [metrics, setMetrics] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // list | kanban

  // Modal State
  const [activeStatusReq, setActiveStatusReq] = useState(null); // solicitud cuyo estado se edita
  const [activePriorityReq, setActivePriorityReq] = useState(null); // solicitud cuya prioridad se edita
  const [activeAssignReq, setActiveAssignReq] = useState(null); // solicitud a asignar
  const [pendingStatus, setPendingStatus] = useState(null); // estado elegido pendiente de confirmar (nota)
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Delete confirmation modal
  const [confirmDeleteReq, setConfirmDeleteReq] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Al abrir el modal de estado, reiniciar la selección pendiente
  useEffect(() => {
    if (activeStatusReq) setPendingStatus(null);
  }, [activeStatusReq]);

  const fetchRequests = useCallback(async () => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const params = { page, limit };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.priority) params.priority = filters.priority;
      if (sortConfig.key) {
        params.sort = sortConfig.key;
        params.order = sortConfig.dir;
      }

      const [data, metricsData] = await Promise.all([
        getRequests(params),
        getMetrics().catch(() => null),
      ]);

      if (seq !== seqRef.current) return;
      setRequests(data.requests || []);
      setPagination(data.pagination);
      if (metricsData) setMetrics(metricsData);
    } catch (err) {
      console.error('Error al obtener solicitudes:', err);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [filters, page, limit, sortConfig]);

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

  function cycleSort(key) {
    if (sortConfig.key === key) {
      if (sortConfig.dir === 'asc') {
        setSortConfig({ key, dir: 'desc' });
      } else {
        setSortConfig({ key: null, dir: null });
      }
    } else {
      setSortConfig({ key, dir: 'asc' });
    }
    setPage(1);
  }

  const renderSortableHeader = (label, sortKey) => {
    const isActive = sortConfig.key === sortKey;
    const ariaSort = isActive ? (sortConfig.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return (
      <th scope="col" aria-sort={ariaSort} className="th-sort">
        <button type="button" onClick={() => cycleSort(sortKey)}>
          <span>{label}</span>
          <span className="sort-chevron" aria-hidden="true">
            {isActive ? (
              sortConfig.dir === 'asc' ? '▲' : '▼'
            ) : (
              '⇅'
            )}
          </span>
        </button>
      </th>
    );
  };

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

  function handleDeleteRequest(req) {
    setConfirmDeleteReq(req);
  }

  async function confirmDelete(req) {
    setDeleting(true);
    try {
      await deleteRequest(req.request_id);
      toast.success(`Solicitud ${req.ticket_code} eliminada con éxito`);
      setConfirmDeleteReq(null);
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar la solicitud');
    } finally {
      setDeleting(false);
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '0.375rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: viewMode === 'list' ? 'white' : 'transparent',
                boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontWeight: 600, fontSize: '0.75rem', color: viewMode === 'list' ? '#0f172a' : '#64748b',
              }}
            >📋 Lista</button>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '0.375rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: viewMode === 'kanban' ? 'white' : 'transparent',
                boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                fontWeight: 600, fontSize: '0.75rem', color: viewMode === 'kanban' ? '#0f172a' : '#64748b',
              }}
            >📊 Kanban</button>
          </div>
          <Link to="/requests/new" className="btn btn-primary btn-sm">
            + Nueva
          </Link>
        </div>
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
            className={`tab-btn ${filters.status === 'ASIGNADA' ? 'active' : ''}`}
            onClick={() => handleStatusTab('ASIGNADA')}
          >
            Asignadas
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

      {/* Vista de Solicitudes */}
      {loading && requests.length === 0 ? (
        <p className="text-muted" style={{ textAlign: 'center', padding: '3rem 0' }}>
          Cargando bandeja de solicitudes...
        </p>
      ) : requests.length === 0 ? (
        <div className="empty-state">
          <p>No se encontraron solicitudes en esta categoría.</p>
        </div>
      ) : viewMode === 'list' ? (
        /* ═══ VISTA LISTA ═══ */
        <>
          <div className="table-responsive">
            <table className="table request-table">
              <thead>
                <tr>
                  {renderSortableHeader("Código / Ticket", "ticket_code")}
                  {renderSortableHeader("Solicitante", "created_by_name")}
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Asignado</th>
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
                          <span className="ticket-code-text">{req.ticket_code}</span>
                        </Link>
                      </td>
                      <td className="col-user">
                        <div className="user-info-cell">
                          <div className="user-avatar">{initial}</div>
                          <div>
                            <div className="user-name">{req.created_by_name || 'Usuario'}</div>
                            <div className="user-dept">{req.department_name || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td className="col-status">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="col-priority">
                        <span className={`priority-pill priority-${req.priority}`}>
                          {req.priority}
                        </span>
                      </td>
                      <td className="col-assigned">
                        <span style={{ fontSize: '0.8125rem' }}>
                          {req.assigned_to_name || <span className="text-muted">—</span>}
                        </span>
                      </td>
                      <td className="col-actions" style={{ textAlign: 'right' }}>
                        <div className="row-actions-group">
                          <button type="button" className="btn-action-pill btn-action-status"
                            onClick={() => setActiveStatusReq(req)} title="Estado">⚙️</button>
                          <button type="button" className="btn-action-pill btn-action-priority"
                            onClick={() => setActivePriorityReq(req)} title="Prioridad">🔥</button>
                          <Link to={`/requests/${req.request_id}`} className="btn-action-pill btn-action-detail">👁️</Link>
                          {user && (user.role !== 'requester' || user.es_jefe) && (
                            <button type="button" className="btn-action-pill"
                              style={{ background: '#eef2ff', color: '#6366f1' }}
                              onClick={() => setActiveAssignReq(req)} title="Asignar">👤</button>
                          )}
                          {user && user.role !== 'requester' && (
                            <button type="button" className="btn-action-pill btn-action-delete"
                              onClick={() => handleDeleteRequest(req)} title="Eliminar">🗑️</button>
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
            onLimitChange={(newLimit) => { setLimit(newLimit); setPage(1); }}
          />
        </>
      ) : (
        /* ═══ VISTA KANBAN ═══ */
        <div className="kanban-board">
          {['PENDIENTE', 'ASIGNADA', 'EN_PROCESO', 'EN_PRUEBAS', 'COMPLETADA'].map(status => {
            const statusRequests = requests.filter(r => r.status === status);
            const statusColors = {
              PENDIENTE: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
              ASIGNADA: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
              EN_PROCESO: { bg: '#e0e7ff', border: '#6366f1', text: '#4338ca' },
              EN_PRUEBAS: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
              COMPLETADA: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
            };
            const sc = statusColors[status] || statusColors.PENDIENTE;
            return (
              <div key={status} className="kanban-column">
                <div className="kanban-column-header" style={{ borderTopColor: sc.border }}>
                  <span className="kanban-column-title">{status.replace('_', ' ')}</span>
                  <span className="kanban-column-count" style={{ background: sc.bg, color: sc.text }}>
                    {statusRequests.length}
                  </span>
                </div>
                <div className="kanban-column-body">
                  {statusRequests.length === 0 ? (
                    <div className="kanban-empty">Sin solicitudes</div>
                  ) : (
                    statusRequests.map(req => (
                      <Link to={`/requests/${req.request_id}`} key={req.request_id} className="kanban-card">
                        <div className="kanban-card-header">
                          <span className="kanban-card-code">{req.ticket_code}</span>
                          <span className={`priority-pill priority-${req.priority}`} style={{ fontSize: '0.625rem', padding: '0.1rem 0.375rem' }}>
                            {req.priority}
                          </span>
                        </div>
                        <div className="kanban-card-title">{req.process_description?.substring(0, 60)}...</div>
                        <div className="kanban-card-footer">
                          <span className="kanban-card-user">👤 {req.created_by_name || '—'}</span>
                          {req.assigned_to_name && (
                            <span className="kanban-card-assigned">→ {req.assigned_to_name}</span>
                          )}
                        </div>
                        <div className="kanban-card-actions">
                          <button type="button" className="kanban-action-btn" onClick={(e) => { e.preventDefault(); setActiveStatusReq(req); }}>⚙️</button>
                          {user && (user.role !== 'requester' || user.es_jefe) && (
                            <button type="button" className="kanban-action-btn" onClick={(e) => { e.preventDefault(); setActiveAssignReq(req); }}>👤</button>
                          )}
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
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

      {/* Modal de Confirmación — Eliminar solicitud */}
      <ConfirmModal
        isOpen={Boolean(confirmDeleteReq)}
        onClose={() => setConfirmDeleteReq(null)}
        onConfirm={() => confirmDelete(confirmDeleteReq)}
        title="Eliminar solicitud"
        description={confirmDeleteReq ? `¿Estás seguro de que deseas eliminar permanentemente la solicitud ${confirmDeleteReq.ticket_code}?` : undefined}
        confirmLabel="Eliminar"
        confirmClassName="btn-danger"
        submitting={deleting}
        submittingLabel="Eliminando..."
      />

      {/* Modal de Asignación */}
      <AssignModal 
        isOpen={Boolean(activeAssignReq)} 
        onClose={() => setActiveAssignReq(null)} 
        request={activeAssignReq} 
        onAssignComplete={fetchRequests} 
      />
    </div>
  );
}
