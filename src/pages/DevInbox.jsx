import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getRequests, updateRequestStatus, addComment } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import ActionModal from '../components/ActionModal';
import './DevInbox.css';

const TABS = [
  { key: 'pending', label: 'Pendientes', status: 'PENDIENTE' },
  { key: 'active', label: 'En Atención', status: 'EN_PROCESO,EN_PRUEBAS' },
  { key: 'done', label: 'Resueltas / Rechazadas', status: 'RESUELTA,RECHAZADA' },
];

export default function DevInbox() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [requestsByTab, setRequestsByTab] = useState({});
  const [loadingByTab, setLoadingByTab] = useState({});
  const [errorByTab, setErrorByTab] = useState({});

  // Modal state
  const [activeModal, setActiveModal] = useState(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  // Confirmación para módulo no-sistemas
  const [nonSystemsConfirm, setNonSystemsConfirm] = useState(null);

  const fetchTab = useCallback(async (tabKey) => {
    const tab = TABS.find(t => t.key === tabKey);
    if (!tab) return;

    setLoadingByTab(prev => ({ ...prev, [tabKey]: true }));
    setErrorByTab(prev => ({ ...prev, [tabKey]: null }));

    try {
      const data = await getRequests({ status: tab.status, limit: 50 });
      setRequestsByTab(prev => ({ ...prev, [tabKey]: data.requests }));
    } catch (err) {
      setErrorByTab(prev => ({ ...prev, [tabKey]: 'Error al cargar solicitudes' }));
    } finally {
      setLoadingByTab(prev => ({ ...prev, [tabKey]: false }));
    }
  }, []);

  useEffect(() => {
    fetchTab(activeTab);
  }, [activeTab, fetchTab]);

  // Acciones
  async function handleAccept(req) {
    // Verificar si el módulo es de Sistemas
    if (!req.is_systems) {
      setNonSystemsConfirm(req);
      return;
    }
    await doAccept(req);
  }

  async function doAccept(req) {
    try {
      await updateRequestStatus(req.request_id, 'EN_PROCESO');
      setNonSystemsConfirm(null);
      fetchTab(activeTab);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al aceptar la solicitud');
    }
  }

  async function handleReject(req) {
    setActiveModal({ type: 'reject', request: req });
  }

  async function handleResolve(req) {
    setActiveModal({ type: 'resolve', request: req });
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
      fetchTab(activeTab);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al actualizar la solicitud');
    } finally {
      setModalSubmitting(false);
    }
  }

  const requests = requestsByTab[activeTab] || [];
  const loading = loadingByTab[activeTab];
  const error = errorByTab[activeTab];

  function renderCard(req) {
    const isPending = req.status === 'PENDIENTE';
    const isActive = req.status === 'EN_PROCESO' || req.status === 'EN_PRUEBAS';

    return (
      <div key={req.request_id} className="inbox-card">
        <div className="inbox-card-header">
          <Link to={`/requests/${req.request_id}`} className="inbox-card-ticket">
            {req.ticket_code}
          </Link>
          <StatusBadge status={req.status} />
        </div>

        <div className="inbox-card-body">
          <div className="inbox-card-row">
            <span className="inbox-card-label">Solicitante</span>
            <span className="inbox-card-value">{req.created_by_name}</span>
          </div>
          <div className="inbox-card-row">
            <span className="inbox-card-label">Departamento</span>
            <span className="inbox-card-value">{req.department_name || '—'}</span>
          </div>
          <div className="inbox-card-row">
            <span className="inbox-card-label">Módulo</span>
            <span className="inbox-card-value">
              {req.module_name}
              {req.is_systems ? (
                <span className="module-badge module-badge-systems">Sistemas</span>
              ) : (
                <span className="module-badge module-badge-other">Otro</span>
              )}
            </span>
          </div>

          <div className="inbox-card-desc">
            {req.process_description?.length > 150
              ? req.process_description.slice(0, 150) + '...'
              : req.process_description}
          </div>

          <div className="inbox-card-meta">
            <span className={`priority-pill priority-${req.priority}`}>
              {req.priority}
            </span>
            <span className="inbox-card-date">
              {new Date(req.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="inbox-card-actions">
          {isPending && (
            <>
              <button className="btn btn-sm btn-success" onClick={() => handleAccept(req)}>
                ✓ Aceptar
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => handleReject(req)}>
                ✕ Rechazar
              </button>
            </>
          )}
          {isActive && (
            <>
              <button className="btn btn-sm btn-success" onClick={() => handleResolve(req)}>
                ✓ Resolver
              </button>
            </>
          )}
          <Link to={`/requests/${req.request_id}`} className="btn btn-sm btn-outline">
            Ver Detalle →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="inbox-page">
      <div className="page-header">
        <div>
          <h1>Bandeja de Entrada</h1>
          <p className="page-subtitle">
            Recepción y triaje de solicitudes de todos los departamentos
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="inbox-tabs">
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`inbox-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            {requestsByTab[tab.key]?.length > 0 && (
              <span className="inbox-tab-count">{requestsByTab[tab.key].length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="inbox-loading">
          <div className="inbox-spinner" />
          <p>Cargando solicitudes...</p>
        </div>
      ) : error ? (
        <div className="inbox-error">
          <p>{error}</p>
          <button className="btn btn-outline" onClick={() => fetchTab(activeTab)}>
            Reintentar
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div className="inbox-empty">
          <div className="inbox-empty-icon">📋</div>
          <p className="inbox-empty-title">No hay solicitudes {TABS.find(t => t.key === activeTab)?.label.toLowerCase()}</p>
          <p className="inbox-empty-desc">
            {activeTab === 'pending'
              ? 'Cuando alguien envíe una solicitud desde el formulario público, aparecerá acá.'
              : 'Las solicitudes se moverán a esta sección cuando cambien de estado.'}
          </p>
        </div>
      ) : (
        <div className="inbox-grid">
          {requests.map(renderCard)}
        </div>
      )}

      {/* Modal de rechazo/resolución */}
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
            : 'Resolver Solicitud'
        }
        description={
          activeModal?.type === 'reject'
            ? 'Ingresá el motivo del rechazo. Esta justificación será visible para el solicitante.'
            : 'Podés agregar una nota sobre la solución aplicada.'
        }
      />

      {/* Confirmación para módulo no-sistemas */}
      {nonSystemsConfirm && (
        <div className="modal-overlay" onClick={() => setNonSystemsConfirm(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3>Módulo no asignado a Sistemas</h3>
            <p>
              La solicitud <strong>{nonSystemsConfirm.ticket_code}</strong> corresponde al módulo{' '}
              <strong>{nonSystemsConfirm.module_name}</strong>, que no está marcado como de Sistemas.
            </p>
            <p>¿Qué querés hacer?</p>
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button className="btn btn-danger" onClick={() => {
                setNonSystemsConfirm(null);
                handleReject(nonSystemsConfirm);
              }}>
                Rechazar con motivo
              </button>
              <button className="btn btn-success" onClick={() => doAccept(nonSystemsConfirm)}>
                Aceptar de todas formas
              </button>
              <button className="btn btn-outline" onClick={() => setNonSystemsConfirm(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
