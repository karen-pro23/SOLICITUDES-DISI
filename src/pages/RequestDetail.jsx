import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequest, updateRequestStatus, deleteRequest, addComment, classifyRequest, generateResponse, getAttachmentDownloadUrl, getAttachmentPreviewUrl } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import ImagePreviewModal from '../components/ImagePreviewModal';
import PdfPreviewModal from '../components/PdfPreviewModal';
import ConfirmModal from '../components/ConfirmModal';
import AssignModal from '../components/AssignModal';
import { STATUS_TRANSITIONS } from '../constants/requestOptions';
import './RequestDetail.css';

// Parsea **bold** y *italic* básico a JSX
function parseMarkdown(text) {
  if (!text) return null;
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(match[4]);
    }
  }
  return parts;
}

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentFiles, setCommentFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);

  // Modales de vista previa
  const [imagePreviewModal, setImagePreviewModal] = useState(null);
  const [pdfPreviewModal, setPdfPreviewModal] = useState(null);

  // AI state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiClassification, setAiClassification] = useState(null);
  const [responseType, setResponseType] = useState('');
  const [responseObservations, setResponseObservations] = useState('');
  const [generatedResponse, setGeneratedResponse] = useState('');
  const [responseLoading, setResponseLoading] = useState(false);

  // Delete confirmation modal
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Assignment modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);

  useEffect(() => {
    getRequest(id).then(setData).catch(() => navigate('/buscar')).finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) return <p>Cargando...</p>;
  if (!data) return null;

  const { request, attachments, history, comments } = data;
  const canChangeStatus = user.role !== 'requester' || user.es_jefe;

  // Etiquetas y estilos locales para las transiciones permitidas
  const STATUS_ACTION_STYLES = {
    PENDIENTE: {
      EN_PROCESO: { label: 'Aceptar', className: 'btn-success' },
      RECHAZADA: { label: 'Rechazar', className: 'btn-danger' },
      ASIGNADA: { label: 'Asignar', className: 'btn-primary' },
    },
    ASIGNADA: {
      EN_PROCESO: { label: 'Iniciar Proceso', className: 'btn-success' },
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
      const updated = await getRequest(id);
      setData(updated);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cambiar estado');
    } finally {
      setSubmitting(false);
    }
  }

  function handleDeleteRequest() {
    setConfirmDelete(true);
  }

  async function confirmDeleteAction() {
    setSubmitting(true);
    try {
      await deleteRequest(request.request_id);
      toast.success(`Solicitud ${request.ticket_code} eliminada con éxito`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al eliminar la solicitud');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!comment.trim() && commentFiles.length === 0) return;
    setSubmitting(true);
    try {
      const result = await addComment(request.request_id, comment, isInternal, commentFiles);
      setData((prev) => ({
        ...prev,
        comments: [...prev.comments, result.comment],
      }));
      setComment('');
      setIsInternal(false);
      setCommentFiles([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar comentario');
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (commentFiles.length + files.length > 3) {
      toast.error('Máximo 3 archivos por comentario');
      return;
    }
    setCommentFiles(prev => [...prev, ...files]);
  }

  function removeCommentFile(index) {
    setCommentFiles(prev => prev.filter((_, i) => i !== index));
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (commentFiles.length + files.length > 3) {
      toast.error('Máximo 3 archivos por comentario');
      return;
    }
    setCommentFiles(prev => [...prev, ...files]);
  }

  function getFileIcon(mimeType) {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    if (mimeType === 'text/csv') return '📊';
    return '📎';
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function handleClassify() {
    setAiLoading(true);
    setAiError('');
    setAiClassification(null);
    try {
      const cls = await classifyRequest(request.request_id);
      setAiClassification(cls);
      const updated = await getRequest(id);
      setData(updated);
    } catch (err) {
      setAiError(err.response?.data?.error || err.message || 'Error al clasificar con IA');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleGenerateResponse(e) {
    e.preventDefault();
    if (!responseType) return;
    setResponseLoading(true);
    setAiError('');
    try {
      const resp = await generateResponse(request.request_id, responseType, responseObservations);
      setGeneratedResponse(resp);
    } catch (err) {
      setAiError(err.response?.data?.error || err.message || 'Error al generar respuesta');
    } finally {
      setResponseLoading(false);
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Respuesta copiada al portapapeles');
    }).catch(() => {
      toast.error('No se pudo copiar');
    });
  }

  async function handleSendAIAsComment() {
    if (!generatedResponse.trim()) return;
    setSubmitting(true);
    try {
      const result = await addComment(request.request_id, generatedResponse, false);
      setData((prev) => ({
        ...prev,
        comments: [...prev.comments, result.comment],
      }));
      setGeneratedResponse('');
      toast.success('Respuesta enviada como comentario');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al enviar comentario');
    } finally {
      setSubmitting(false);
    }
  }

  // Función robusta para construir la URL del recurso estático (Opción B)
  function getAttachmentUrl(att) {
    if (att.file_url) return att.file_url;
    if (att.url) return att.url;

    if (att.file_path) {
      const normalizedPath = att.file_path.replace(/\\/g, '/');
      if (normalizedPath.includes('/uploads/')) {
        const relativePath = normalizedPath.split('/uploads/')[1];
        // Si usas Vite proxy o apuntas directo al backend, anteponemos /uploads/ codificado
        return encodeURI(`/uploads/${relativePath}`);
      }
    }

    return `/api/attachments/${att.attachment_id}`;
  }

  const PRIORITY_COLORS = {
    alta: { bg: '#fee2e2', color: '#dc2626', label: 'Alta' },
    media: { bg: '#fef3c7', color: '#d97706', label: 'Media' },
    baja: { bg: '#d1fae5', color: '#059669', label: 'Baja' },
  };

  const CATEGORY_LABELS = {
    error_bloqueante: 'Error Bloqueante',
    mejora: 'Mejora',
    consulta: 'Consulta',
    incidente: 'Incidente',
    configuracion: 'Configuración',
    otro: 'Otro',
  };

  const RESPONSE_TYPES = [
    { value: 'acuse', label: 'Acuse de recibo' },
    { value: 'avance', label: 'Informar avance' },
    { value: 'info_adicional', label: 'Solicitar info adicional' },
    { value: 'resuelta', label: 'Notificar resolución' },
    { value: 'rechazada', label: 'Notificar rechazo' },
    { value: 'observaciones', label: 'Observaciones' },
  ];

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
              <div className="meta-item">
                <span className="meta-label">Módulo</span>
                <span className="meta-value">{request.module_name}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Tipo</span>
                <span className="meta-value">{request.request_type_name}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Prioridad</span>
                <span className="meta-value">{request.priority?.charAt(0).toUpperCase() + request.priority?.slice(1)}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Creado por</span>
                <span className="meta-value">{request.created_by_name}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Departamento</span>
                <span className="meta-value">{request.department_name}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Asignado a</span>
                <span className="meta-value">
                  {request.assigned_to_name ? (
                    <span>👤 {request.assigned_to_name}</span>
                  ) : null}
                  {request.assigned_to_name && request.assigned_department_name ? <br /> : null}
                  {request.assigned_department_name ? (
                    <span style={{ color: 'var(--color-primary)' }}>🏢 {request.assigned_department_name}</span>
                  ) : (
                    !request.assigned_to_name && 'Sin asignar'
                  )}
                </span>
              </div>
              <div className="meta-item" style={{ gridColumn: '1 / -1' }}>
                <span className="meta-label">Fecha de creación</span>
                <span className="meta-value">{new Date(request.created_at).toLocaleString()}</span>
              </div>
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
                <p>{parseMarkdown(request.rejection_reason)}</p>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="detail-section">
                <h3>Archivos Adjuntos ({attachments.length})</h3>
                <div className="attachments-list">
                  {attachments.map((att) => {
                    const previewUrl = getAttachmentPreviewUrl(request.request_id, att.attachment_id);
                    const downloadUrl = getAttachmentDownloadUrl(request.request_id, att.attachment_id);
                    const isImage = att.file_type === 'screenshot' || att.mime_type?.startsWith('image/');
                    const isPdf = att.file_type === 'document' || att.mime_type === 'application/pdf';

                    return (
                      <div key={att.attachment_id} className="attachment-item">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="attachment-icon">
                            {isImage ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                            ) : isPdf ? (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
                            )}
                          </span>
                          <span className="attachment-name">{att.file_name}</span>
                          <span className="attachment-size">
                            {(att.file_size / 1024).toFixed(1)} KB
                          </span>
                        </div>

                        <div className="attachment-actions" style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                          {isImage && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setImagePreviewModal({ src: previewUrl, alt: att.file_name })}
                            >
                              Ver Imagen
                            </button>
                          )}

                          {isPdf && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => setPdfPreviewModal({ url: previewUrl, name: att.file_name })}
                            >
                              Ver PDF
                            </button>
                          )}

                          <a
                            href={downloadUrl}
                            download={att.file_name}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary btn-sm"
                          >
                            Descargar
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {canChangeStatus && (
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
                  <button
                    className="btn btn-outline"
                    onClick={() => setAssignModalOpen(true)}
                    disabled={submitting}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.375rem' }}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                    Asignar
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={handleDeleteRequest}
                    disabled={submitting}
                    style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Eliminar Solicitud
                  </button>
                </div>
              </div>
            )}

            {/* AI Panel */}
            <div className="detail-card ai-panel">
              <div className="ai-panel-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3730a3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4v1a2 2 0 0 1 2 2h1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1a4 4 0 0 1-8 0H5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h1a2 2 0 0 1 2-2V6a4 4 0 0 1 4-4z" />
                  <circle cx="9" cy="10" r="1" fill="#3730a3" />
                  <circle cx="15" cy="10" r="1" fill="#3730a3" />
                </svg>
                <h3>Asistente IA</h3>
              </div>

              {aiError && (
                <div style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '0.75rem', padding: '0.625rem 0.75rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                  {aiError}
                </div>
              )}

              {/* Clasificación IA */}
              <div style={{ marginBottom: '1rem' }}>
                <div className="ai-section-title">Clasificación Automática</div>
                {aiClassification ? (
                  <div className="ai-classification-grid">
                    <div className="ai-classification-item">
                      <div className="ai-classification-label">Prioridad</div>
                      <div className="ai-classification-value" style={{ color: PRIORITY_COLORS[aiClassification.prioridad]?.color }}>
                        {PRIORITY_COLORS[aiClassification.prioridad]?.label}
                      </div>
                    </div>
                    <div className="ai-classification-item">
                      <div className="ai-classification-label">Categoría</div>
                      <div className="ai-classification-value">
                        {CATEGORY_LABELS[aiClassification.categoria] || aiClassification.categoria}
                      </div>
                    </div>
                    <div className="ai-classification-item">
                      <div className="ai-classification-label">Módulo</div>
                      <div className="ai-classification-value">
                        {aiClassification.modulo_sugerido}
                      </div>
                    </div>
                    <div className="ai-classification-item">
                      <div className="ai-classification-label">Resumen</div>
                      <div className="ai-classification-value" style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                        {aiClassification.resumen}
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={handleClassify}
                    disabled={aiLoading}
                    style={{ fontSize: '0.875rem', width: '100%' }}
                  >
                    {aiLoading ? 'Analizando...' : 'Clasificar Solicitud'}
                  </button>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e0e7ff', margin: '1rem 0' }} />

              {/* Generación de Respuesta */}
              <div>
                <div className="ai-section-title">Generar Respuesta Formal</div>
                <form onSubmit={handleGenerateResponse}>
                  <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                    <select
                      value={responseType}
                      onChange={(e) => setResponseType(e.target.value)}
                      required
                      className="response-type-select"
                    >
                      <option value="">Seleccionar tipo de respuesta...</option>
                      {RESPONSE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {responseType === 'observaciones' && (
                    <div className="form-group" style={{ marginBottom: '0.5rem' }}>
                      <textarea
                        value={responseObservations}
                        onChange={(e) => setResponseObservations(e.target.value.toLocaleUpperCase())}
                        placeholder="Ingrese las observaciones técnicas o puntos a señalar..."
                        rows={3}
                        style={{ fontSize: '0.875rem', width: '100%', padding: '0.625rem 0.75rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!responseType || responseLoading}
                    style={{ fontSize: '0.875rem', width: '100%' }}
                  >
                    {responseLoading ? 'Generando...' : 'Generar Respuesta'}
                  </button>
                </form>

                {generatedResponse && (
                  <div className="ai-response-box" style={{ marginTop: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div className="ai-section-title" style={{ margin: 0 }}>Respuesta Generada</div>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button
                          type="button"
                          className="ai-copy-btn"
                          onClick={() => copyToClipboard(generatedResponse)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                          Copiar
                        </button>
                        <button
                          type="button"
                          className="ai-copy-btn"
                          style={{ background: '#dcfce7', color: '#166534' }}
                          onClick={handleSendAIAsComment}
                          disabled={submitting}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                          {submitting ? 'Enviando...' : 'Enviar'}
                        </button>
                      </div>
                    </div>
                    <div style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '0.875rem',
                      fontSize: '0.875rem',
                      lineHeight: 1.7,
                      color: '#334155',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '300px',
                      overflowY: 'auto',
                    }}>
                      {parseMarkdown(generatedResponse)}
                    </div>
                    <textarea
                      value={generatedResponse}
                      onChange={(e) => setGeneratedResponse(e.target.value)}
                      rows={6}
                      style={{ display: 'none' }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="detail-card">
            <h3>Comentarios</h3>
            <form onSubmit={handleComment} className="comment-form">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.toLocaleUpperCase())}
                placeholder="Escriba un comentario..."
                rows={3}
              />
              
              {/* Adjuntos del comentario */}
              {(user.role === 'admin' || user.role === 'developer') && (
                <div 
                  className={`comment-attach-zone ${isDragOver ? 'drag-over' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="comment-attach-header">
                    <label className="comment-attach-btn">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                      Adjuntar archivos
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.xlsx,.xls,.csv"
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <span className="comment-attach-limit">{commentFiles.length}/3 archivos</span>
                  </div>
                  
                  {commentFiles.length > 0 && (
                    <div className="comment-attach-list">
                      {commentFiles.map((file, index) => (
                        <div key={index} className="comment-attach-item">
                          <span className="comment-attach-icon">{getFileIcon(file.type)}</span>
                          <span className="comment-attach-name">{file.name}</span>
                          <span className="comment-attach-size">{formatFileSize(file.size)}</span>
                          <button
                            type="button"
                            className="comment-attach-remove"
                            onClick={() => removeCommentFile(index)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {commentFiles.length === 0 && (
                    <p className="comment-attach-hint">
                      Arrastra archivos aquí o haz clic en "Adjuntar archivos"
                    </p>
                  )}
                </div>
              )}
              
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
                <button type="submit" className="btn btn-primary btn-sm" disabled={(!comment.trim() && commentFiles.length === 0) || submitting}>
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
                  <p>{parseMarkdown(c.content)}</p>
                  
                  {/* Adjuntos del comentario */}
                  {c.attachments && c.attachments.length > 0 && (
                    <div className="comment-attachments">
                      {c.attachments.map((att) => (
                        <div key={att.attachment_id} className="comment-attachment-item">
                          <span className="comment-attachment-icon">{getFileIcon(att.mime_type)}</span>
                          <span className="comment-attachment-name">{att.file_name}</span>
                          <span className="comment-attachment-size">{formatFileSize(att.file_size)}</span>
                          <div className="comment-attachment-actions">
                            {att.mime_type.startsWith('image/') && (
                              <button
                                type="button"
                                className="attachment-btn attachment-btn-preview"
                                onClick={() => setImagePreviewModal({ src: getAttachmentPreviewUrl(request.request_id, att.attachment_id), alt: att.file_name })}
                              >
                                Ver
                              </button>
                            )}
                            {att.mime_type === 'application/pdf' && (
                              <button
                                type="button"
                                className="attachment-btn attachment-btn-preview"
                                onClick={() => setPdfPreviewModal({ url: getAttachmentPreviewUrl(request.request_id, att.attachment_id), name: att.file_name })}
                              >
                                Ver
                              </button>
                            )}
                            <a
                              href={getAttachmentDownloadUrl(request.request_id, att.attachment_id)}
                              className="attachment-btn attachment-btn-download"
                              download
                            >
                              ⬇️
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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

      {/* Modal para Visualización Previa de Imágenes */}
      {imagePreviewModal && (
        <ImagePreviewModal
          src={imagePreviewModal.src}
          alt={imagePreviewModal.alt}
          onClose={() => setImagePreviewModal(null)}
        />
      )}

      {/* Modal para Visualización Previa de PDFs */}
      {pdfPreviewModal && (
        <PdfPreviewModal
          url={pdfPreviewModal.url}
          name={pdfPreviewModal.name}
          onClose={() => setPdfPreviewModal(null)}
        />
      )}

      {/* Modal de Confirmación — Eliminar solicitud */}
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={confirmDeleteAction}
        title="Eliminar solicitud"
        description={`¿Estás seguro de que deseas eliminar permanentemente la solicitud ${request.ticket_code}? Esta acción eliminará también sus adjuntos e historial.`}
        confirmLabel="Eliminar"
        confirmClassName="btn-danger"
        submitting={submitting}
        submittingLabel="Eliminando..."
      />

      <AssignModal 
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        request={request}
        onAssignComplete={() => {
          getRequest(id).then(setData);
        }}
      />
    </div>
  );
}