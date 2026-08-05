import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getRequests, updateRequestStatus, addComment } from '../services/api';
import toast from 'react-hot-toast';
import StatusBadge from '../components/StatusBadge';
import ActionModal from '../components/ActionModal';
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  DragOverlay,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './DevInbox.css';

const STATUS_OPTIONS = [
  { value: 'PENDIENTE', label: 'Pendiente', icon: '⏳' },
  { value: 'EN_PROCESO', label: 'En Proceso', icon: '⚙️' },
  { value: 'EN_PRUEBAS', label: 'En Pruebas', icon: '🧪' },
  { value: 'COMPLETADA', label: 'Completada', icon: '✅' },
  { value: 'RECHAZADA', label: 'Rechazada', icon: '❌' },
];

const STATUS_ORDER = ['PENDIENTE', 'EN_PROCESO', 'EN_PRUEBAS', 'COMPLETADA', 'RECHAZADA'];

const STATUS_TRANSITIONS = {
  PENDIENTE: ['EN_PROCESO', 'RECHAZADA'],
  EN_PROCESO: ['EN_PRUEBAS', 'PENDIENTE', 'RECHAZADA'],
  EN_PRUEBAS: ['COMPLETADA', 'EN_PROCESO', 'RECHAZADA'],
  COMPLETADA: ['EN_PRUEBAS'],
  RECHAZADA: ['PENDIENTE'],
};

const COLUMN_CONFIG = [
  { key: 'PENDIENTE', label: 'Pendientes', icon: '', color: 'var(--color-info)', bg: 'var(--color-info-bg)' },
  { key: 'EN_PROCESO', label: 'En Proceso', icon: '', color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
  { key: 'EN_PRUEBAS', label: 'En Pruebas', icon: '', color: 'var(--color-accent)', bg: 'var(--color-accent-bg)' },
  { key: 'COMPLETADA', label: 'Completadas', icon: '', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  { key: 'RECHAZADA', label: 'Rechazadas', icon: '', color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' },
];

const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.map(o => [o.value, o.label]));

/* ── Vista presentacional de la tarjeta ────── */
function KanbanCardView({
  req,
  overlay = false,
  allowedTransitions,
  openStatusDropdown,
  setOpenStatusDropdown,
  handleStatusOptionClick,
}) {
  return (
    <div
      className={`kanban-card ${overlay ? 'kanban-card-overlay' : ''}`}
      aria-label={`Solicitud ${req.ticket_code}, estado ${req.status}. Arrastrá para cambiar de estado.`}
    >
      <div className="kanban-card-header">
        <Link
          to={`/requests/${req.request_id}`}
          className="kanban-card-ticket"
          onClick={(e) => e.stopPropagation()}
        >
          {req.ticket_code}
        </Link>
        <StatusBadge status={req.status} />
      </div>

      <div className="kanban-card-body">
        <div className="kanban-card-row">
          <span className="kanban-card-label">Solicitante</span>
          <span className="kanban-card-value">{req.created_by_name}</span>
        </div>
        <div className="kanban-card-row">
          <span className="kanban-card-label">Departamento</span>
          <span className="kanban-card-value">{req.department_name || '—'}</span>
        </div>
        <div className="kanban-card-row">
          <span className="kanban-card-label">Módulo</span>
          <span className="kanban-card-value">
            {req.module_name}
            {req.is_systems ? (
              <span className="module-badge module-badge-systems">Sistemas</span>
            ) : (
              <span className="module-badge module-badge-other">Otro</span>
            )}
          </span>
        </div>

        <div className="kanban-card-desc">
          {req.process_description?.length > 120
            ? req.process_description.slice(0, 120) + '...'
            : req.process_description}
        </div>

        <div className="kanban-card-meta">
          <span className={`priority-pill priority-${req.priority}`}>{req.priority}</span>
          <span className="kanban-card-date">{new Date(req.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="kanban-card-actions">
        {!overlay && allowedTransitions.length > 0 && (
          <div className="status-dropdown">
            <button
              type="button"
              className="btn btn-sm btn-outline status-dropdown-trigger"
              onClick={(e) => {
                e.stopPropagation();
                setOpenStatusDropdown(openStatusDropdown === req.request_id ? null : req.request_id);
              }}
              aria-expanded={openStatusDropdown === req.request_id}
              aria-haspopup="listbox"
              aria-label="Cambiar estado"
            >
              Estado
            </button>
            {openStatusDropdown === req.request_id && (
              <div className="status-dropdown-menu" role="listbox">
                {allowedTransitions.map(statusValue => {
                  const opt = STATUS_OPTIONS.find(o => o.value === statusValue);
                  return (
                    <button
                      key={statusValue}
                      type="button"
                      role="option"
                      className="status-dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStatusOptionClick(statusValue, req);
                      }}
                    >
                      <span className="status-dropdown-dot" data-status={statusValue} />
                      {opt?.icon} {opt?.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {!overlay && <span className="kanban-card-drag-hint">⠿ Arrastrá</span>}
        <Link to={`/requests/${req.request_id}`} className="btn btn-sm btn-primary" onClick={(e) => e.stopPropagation()}>
          Ver detalle
        </Link>
      </div>
    </div>
  );
}

/* ── Card con drag & drop ──────────────────── */
function DraggableKanbanCard(props) {
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = useDraggable({
    id: props.req.request_id,
  });

  const style = transform
    ? { transform: CSS.Transform.toString(transform), transition }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="listitem"
      className={`kanban-card-draggable ${isDragging ? 'is-dragging' : ''}`}
    >
      <KanbanCardView {...props} />
    </div>
  );
}

/* ── Contenido de la columna (drop target) ─── */
function KanbanColumnContent({ column, requests, renderCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column-content ${isOver ? 'kanban-column-content-over' : ''}`}
    >
      {requests.length === 0 ? (
        <div className="kanban-empty">
          <span className="kanban-empty-icon">{column.icon}</span>
          <p>Sin solicitudes</p>
          <p className="drop-hint">Arrastrá una solicitud acá</p>
        </div>
      ) : (
        requests.map(renderCard)
      )}
    </div>
  );
}

export default function DevInbox() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeId, setActiveId] = useState(null);

  // Modal state
  const [activeModal, setActiveModal] = useState(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  // Confirmación para módulo no-sistemas
  const [nonSystemsConfirm, setNonSystemsConfirm] = useState(null);
  // Dropdown de estado abierto
  const [openStatusDropdown, setOpenStatusDropdown] = useState(null);

  const fetchAllRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRequests({ limit: 200 });
      setRequests(data.requests || []);
    } catch (err) {
      setError('Error al cargar solicitudes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllRequests();
  }, [fetchAllRequests]);

  // Agrupar solicitudes por estado
  const requestsByStatus = useMemo(() => {
    const grouped = {};
    STATUS_ORDER.forEach(status => {
      grouped[status] = requests.filter(r => r.status === status);
    });
    return grouped;
  }, [requests]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeRequest = activeId ? requests.find(r => r.request_id === activeId) : null;

  async function doStatusChange(requestId, newStatus, rejectionReason) {
    try {
      await updateRequestStatus(requestId, newStatus, rejectionReason);
      setNonSystemsConfirm(null);
      fetchAllRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cambiar el estado');
      fetchAllRequests();
    }
  }

  // Determinar columna destino y mover la solicitud
  function handleDragEnd(event) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const request = requests.find(r => r.request_id === active.id);
    if (!request) return;

    // El destino puede ser una columna (status) o una tarjeta
    let targetStatus;
    if (STATUS_ORDER.includes(over.id)) {
      targetStatus = over.id;
    } else {
      const overRequest = requests.find(r => r.request_id === over.id);
      targetStatus = overRequest ? overRequest.status : null;
    }

    if (!targetStatus || targetStatus === request.status) return;

    // Validar transición permitida
    const allowed = STATUS_TRANSITIONS[request.status] || [];
    if (!allowed.includes(targetStatus)) {
      toast(`No se puede mover de "${STATUS_LABELS[request.status]}" a "${STATUS_LABELS[targetStatus]}" directamente.`);
      return;
    }

    // Confirmar para módulos no-Sistemas al pasar a EN_PROCESO
    if (targetStatus === 'EN_PROCESO' && !request.is_systems) {
      setNonSystemsConfirm({ ...request, targetStatus });
      return;
    }

    // Rechazo exige motivo
    if (targetStatus === 'RECHAZADA') {
      setActiveModal({ type: 'reject', request, targetStatus });
      return;
    }

    // Completada admite nota opcional
    if (targetStatus === 'COMPLETADA') {
      setActiveModal({ type: 'resolve', request, targetStatus });
      return;
    }

    doStatusChange(request.request_id, targetStatus);
  }

  async function handleModalSubmit(text) {
    if (!activeModal) return;
    const { request, targetStatus } = activeModal;
    setModalSubmitting(true);

    try {
      if (targetStatus === 'RECHAZADA') {
        await updateRequestStatus(request.request_id, 'RECHAZADA', text);
      } else if (targetStatus === 'COMPLETADA') {
        await updateRequestStatus(request.request_id, 'COMPLETADA');
        if (text.trim()) {
          await addComment(request.request_id, text, false);
        }
      }
      setActiveModal(null);
      fetchAllRequests();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al actualizar la solicitud');
      fetchAllRequests();
    } finally {
      setModalSubmitting(false);
    }
  }

  // Transiciones posibles según el estado actual
  function getAllowedTransitions(currentStatus) {
    return STATUS_TRANSITIONS[currentStatus] || [];
  }

  function handleStatusOptionClick(statusValue, req) {
    setOpenStatusDropdown(null);
    if (statusValue === 'RECHAZADA') {
      setActiveModal({ type: 'reject', request: req, targetStatus: statusValue });
    } else if (statusValue === 'COMPLETADA') {
      setActiveModal({ type: 'resolve', request: req, targetStatus: statusValue });
    } else if (statusValue === 'EN_PROCESO' && !req.is_systems) {
      setNonSystemsConfirm({ ...req, targetStatus: statusValue });
    } else {
      doStatusChange(req.request_id, statusValue);
    }
  }

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (openStatusDropdown && !e.target.closest('.status-dropdown')) {
        setOpenStatusDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openStatusDropdown]);

  function renderCard(req) {
    return (
      <DraggableKanbanCard
        key={req.request_id}
        req={req}
        allowedTransitions={getAllowedTransitions(req.status)}
        openStatusDropdown={openStatusDropdown}
        setOpenStatusDropdown={setOpenStatusDropdown}
        handleStatusOptionClick={handleStatusOptionClick}
      />
    );
  }

  function renderColumn(column) {
    const columnRequests = requestsByStatus[column.key] || [];

    return (
      <div key={column.key} className="kanban-column" role="list" aria-label={column.label}>
        <div className="kanban-column-header" style={{ '--column-color': column.color, '--column-bg': column.bg }}>
          <div className="kanban-column-title">
            <span className="kanban-column-icon">{column.icon}</span>
            <span>{column.label}</span>
          </div>
          <span className="kanban-column-count">{columnRequests.length}</span>
        </div>
        <KanbanColumnContent column={column} requests={columnRequests} renderCard={renderCard} />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="inbox-page kanban-page">
        <div className="page-header">
          <div>
            <h1>Bandeja de Entrada</h1>
            <p className="page-subtitle">
              Recepción y triaje de solicitudes de todos los departamentos
            </p>
          </div>
          <button className="btn btn-primary" onClick={fetchAllRequests} disabled={loading}>
            {loading ? 'Actualizando...' : '🔄 Actualizar'}
          </button>
        </div>

        {error ? (
          <div className="inbox-error">
            <p>{error}</p>
            <button className="btn btn-outline" onClick={fetchAllRequests}>Reintentar</button>
          </div>
        ) : loading && requests.length === 0 ? (
          <div className="inbox-loading">
            <div className="inbox-spinner" />
            <p>Cargando solicitudes...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className="inbox-empty">
            <div className="inbox-empty-icon">📋</div>
            <p className="inbox-empty-title">No hay solicitudes</p>
            <p className="inbox-empty-desc">
              Cuando alguien envíe una solicitud desde el formulario público, aparecerá acá.
            </p>
          </div>
        ) : (
          <div className="kanban-board" role="main" aria-label="Tablero Kanban de solicitudes">
            {COLUMN_CONFIG.map(renderColumn)}
          </div>
        )}

        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeRequest ? <KanbanCardView req={activeRequest} overlay /> : null}
        </DragOverlay>

        {/* Modal de rechazo/resolución */}
        <ActionModal
          isOpen={Boolean(activeModal)}
          onClose={() => setActiveModal(null)}
          onSubmit={handleModalSubmit}
          submitting={modalSubmitting}
          ticketCode={activeModal?.request?.ticket_code}
          actionType={activeModal?.type}
          title={activeModal?.type === 'reject' ? 'Rechazar Solicitud' : 'Resolver Solicitud'}
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
                  setActiveModal({ type: 'reject', request: nonSystemsConfirm, targetStatus: nonSystemsConfirm.targetStatus });
                }}>
                  Rechazar con motivo
                </button>
                <button className="btn btn-success" onClick={() => {
                  doStatusChange(nonSystemsConfirm.request_id, nonSystemsConfirm.targetStatus);
                }}>
                  Cambiar a {STATUS_LABELS[nonSystemsConfirm.targetStatus]} de todas formas
                </button>
                <button className="btn btn-outline" onClick={() => setNonSystemsConfirm(null)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}