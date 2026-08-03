import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequest, updateRequestStatus, addComment } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { STATUS_TRANSITIONS } from '../constants/requestOptions';
import './RequestDetail.css';

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getRequest(id).then(setData).catch(() => navigate('/')).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <p>Cargando...</p>;
  if (!data) return null;

  const { request, attachments, history, comments } = data;
  const canChangeStatus = user.role !== 'requester';

  // Etiquetas y estilos locales para las transiciones permitidas
  // (las transiciones válidas salen de STATUS_TRANSITIONS, fuente única).
  const STATUS_ACTION_STYLES = {
    PENDIENTE: {
      EN_PROCESO: { label: 'Aceptar', className: 'btn-success' },
      RECHAZADA: { label: 'Rechazar', className: 'btn-danger' },
    },
    RECHAZADA: {
      PENDIENTE: { label: 'Reabrir', className: 'btn-primary' },
    },
    EN_PROCESO: {
      EN_PRUEBAS: { label: 'Pasar a Pruebas', className: 'btn-primary' },
    },
    EN_PRUEBAS: {
      COMPLETADA: { label: 'Resolver', className: 'btn-success' },
      EN_PROCESO: { label: 'Devolver a Proceso', className: 'btn-outline' },
    },
    COMPLETADA: {},
  };

  const actions = (STATUS_TRANSITIONS[request.status] || []).map((status) => ({
    status,
    ...(STATUS_ACTION_STYLES[request.status]?.[status] || { label: status, className: 'btn-primary' }),
  }));

  async function handleStatusChange(newStatus) {
    let rejectionReason = null;
    if (newStatus === 'RECHAZADA') {
      rejectionReason = prompt('Motivo del rechazo:');
      if (!rejectionReason || rejectionReason.trim() === '') return;
    }
    setSubmitting(true);
    try {
      const result = await updateRequestStatus(request.request_id, newStatus, rejectionReason);
      setData((prev) => ({ ...prev, request: result.request }));
      // Recargar historial
      const updated = await getRequest(id);
      setData(updated);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al cambiar estado');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const result = await addComment(request.request_id, comment, isInternal);
      setData((prev) => ({
        ...prev,
        comments: [...prev.comments, result.comment],
      }));
      setComment('');
      setIsInternal(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Error al enviar comentario');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="request-detail">
      <div className="page-header">
        <button className="btn btn-outline" onClick={() => navigate(-1)}>← Volver</button>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-card">
            <div className="detail-head">
              <h1>{request.ticket_code}</h1>
              <StatusBadge status={request.status} />
            </div>

            <div className="detail-meta">
              <div><strong>Módulo:</strong> {request.module_name}</div>
              <div><strong>Tipo:</strong> {request.request_type_name}</div>
              <div><strong>Prioridad:</strong> {request.priority}</div>
              <div><strong>Creado por:</strong> {request.created_by_name}</div>
              <div><strong>Departamento:</strong> {request.department_name}</div>
              <div><strong>Asignado a:</strong> {request.assigned_to_name || 'Sin asignar'}</div>
              <div><strong>Fecha:</strong> {new Date(request.created_at).toLocaleString()}</div>
            </div>

            <div className="detail-section">
              <h3>Proceso Administrativo</h3>
              <p>{request.process_description}</p>
            </div>

            <div className="detail-section">
              <h3>Comportamiento Actual</h3>
              <p>{request.current_behavior}</p>
            </div>

            <div className="detail-section">
              <h3>Comportamiento Esperado</h3>
              <p>{request.expected_behavior}</p>
            </div>

            {request.rejection_reason && (
              <div className="detail-section detail-rejection">
                <h3>Motivo de Rechazo</h3>
                <p>{request.rejection_reason}</p>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="detail-section">
                <h3>Archivos Adjuntos ({attachments.length})</h3>
                <div className="attachments-list">
                  {attachments.map((att) => (
                    <div key={att.attachment_id} className="attachment-item">
                      <span className="attachment-icon">
                        {att.file_type === 'screenshot' ? '🖼️' : '📄'}
                      </span>
                      <span className="attachment-name">{att.file_name}</span>
                      <span className="attachment-size">
                        {(att.file_size / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canChangeStatus && actions.length > 0 && (
              <div className="detail-section">
                <h3>Acciones</h3>
                <div className="status-actions">
                  {actions.map((action) => (
                    <button
                      key={action.status}
                      className={`btn ${action.className}`}
                      onClick={() => handleStatusChange(action.status)}
                      disabled={submitting}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="detail-card">
            <h3>Comentarios</h3>
            <form onSubmit={handleComment} className="comment-form">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Escribí un comentario..."
                rows={3}
              />
              <div className="comment-actions">
                {(user.role === 'admin' || user.role === 'developer') && (
                  <label className="internal-check">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                    />
                    Comentario interno (solo visible para sistemas)
                  </label>
                )}
                <button type="submit" className="btn btn-primary btn-sm" disabled={!comment.trim() || submitting}>
                  Enviar
                </button>
              </div>
            </form>

            <div className="comments-list">
              {comments.map((c) => (
                <div key={c.comment_id} className={`comment ${c.is_internal ? 'comment-internal' : ''}`}>
                  <div className="comment-head">
                    <strong>{c.author_name}</strong>
                    <span className="comment-role">{c.author_role}</span>
                    {c.is_internal && <span className="comment-badge">Interno</span>}
                    <span className="comment-date">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p>{c.content}</p>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-muted">Sin comentarios aún.</p>
              )}
            </div>
          </div>
        </div>

        <div className="detail-sidebar">
          <div className="detail-card">
            <h3>Historial de Cambios</h3>
            <div className="timeline">
              {history.map((h) => (
                <div key={h.history_id} className="timeline-item">
                  <div className="timeline-dot" />
                  <div className="timeline-content">
                    <div className="timeline-status">
                      {h.from_status ? (
                        <><StatusBadge status={h.from_status} /> → <StatusBadge status={h.to_status} /></>
                      ) : (
                        <StatusBadge status={h.to_status} />
                      )}
                    </div>
                    <div className="timeline-meta">
                      por {h.changed_by_name} · {new Date(h.created_at).toLocaleString()}
                    </div>
                    {h.comment && <p className="timeline-comment">{h.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
