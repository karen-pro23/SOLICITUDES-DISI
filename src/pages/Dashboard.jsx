import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getRequests,
  getModules,
  updateRequestStatus,
  addComment,
  getMetrics,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import ActionModal from '../components/ActionModal';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', search: '' });
  const [metrics, setMetrics] = useState(null);

  // Modal State
  const [activeModal, setActiveModal] = useState(null); // { type: 'resolve'|'reject', request: req }
  const [modalSubmitting, setModalSubmitting] = useState(false);

  const fetchRequests = useCallback(async (cursor) => {
    setLoading(true);
    try {
      const params = { limit: 25 };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
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
  async function handleAccept(req) {
    try {
      await updateRequestStatus(req.request_id, 'EN_PROCESO');
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al aceptar la solicitud');
    }
  }

  function openActionModal(type, req) {
    setActiveModal({ type, request: req });
  }

  async function handleModalSubmit(text) {
    if (!activeModal) return;
    const { type, request } = activeModal;
    setModalSubmitting(true);

    try {
      if (type === 'reject') {
        await updateRequestStatus(request.request_id, 'RECHAZADA', text);
      } else if (type === 'resolve') {
        await updateRequestStatus(request.request_id, 'RESUELTA');
        if (text.trim()) {
          await addComment(request.request_id, text, false);
        }
      }
      setActiveModal(null);
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al actualizar la solicitud');
    } finally {
      setModalSubmitting(false);
    }
  }

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
              {metrics.byStatus.find((s) => s.status === 'RESUELTA')?.count || 0}
            </div>
            <div className="dev-metric-lbl">Atendidas / Resueltas</div>
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
            className={`tab-btn ${filters.status === 'RESUELTA' ? 'active' : ''}`}
            onClick={() => handleStatusTab('RESUELTA')}
          >
            Resueltas
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
            onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          />
          <button type="submit" className="btn btn-outline">Buscar</button>
        </form>
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
                          fontWeight: 600,
                          padding: '0.125rem 0.5rem',
                          borderRadius: '99px',
                          textTransform: 'capitalize',
                          background:
                            req.priority === 'alta'
                              ? '#fee2e2'
                              : req.priority === 'media'
                              ? '#fef3c7'
                              : '#f1f5f9',
                          color:
                            req.priority === 'alta'
                              ? '#991b1b'
                              : req.priority === 'media'
                              ? '#92400e'
                              : '#475569',
                        }}
                      >
                        {req.priority}
                      </span>
                    </td>
                    <td>{new Date(req.created_at).toLocaleDateString()}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                        {/* Botón Aceptar si está PENDIENTE */}
                        {req.status === 'PENDIENTE' && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleAccept(req)}
                            title="Aceptar solicitud y comenzar atención"
                          >
                            ✓ Aceptar
                          </button>
                        )}

                        {/* Botón Resolver si está EN_PROCESO o EN_PRUEBAS */}
                        {(req.status === 'EN_PROCESO' || req.status === 'EN_PRUEBAS') && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => openActionModal('resolve', req)}
                            title="Responder y marcar como resuelta"
                          >
                            ✓ Resolver
                          </button>
                        )}

                        {/* Botón Rechazar si está PENDIENTE o EN_PROCESO */}
                        {(req.status === 'PENDIENTE' || req.status === 'EN_PROCESO') && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => openActionModal('reject', req)}
                            title="Rechazar solicitud indicando motivo"
                          >
                            ✕ Rechazar
                          </button>
                        )}

                        <Link to={`/requests/${req.request_id}`} className="btn btn-sm btn-outline">
                          Ver Detalle
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

      {/* Modal de Acción (Resolver / Rechazar) */}
      <ActionModal
        isOpen={Boolean(activeModal)}
        onClose={() => setActiveModal(null)}
        onSubmit={handleModalSubmit}
        submitting={modalSubmitting}
        ticketCode={activeModal?.request?.ticket_code}
        actionType={activeModal?.type}
        title={
          activeModal?.type === 'reject'
            ? 'Rechazar Solicitud'
            : 'Resolver y Responder Solicitud'
        }
        description={
          activeModal?.type === 'reject'
            ? 'Ingresá la explicación del motivo de rechazo. Esta justificación será visible para el departamento solicitante.'
            : 'Podés ingresar notas de respuesta o la solución aplicada para dejar registro en el ticket.'
        }
      />
    </div>
  );
}
