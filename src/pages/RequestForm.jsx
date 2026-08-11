import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getModules,
  getRequestTypes,
  getDepartments,
  getRequest,
  getPublicModules,
  getPublicRequestTypes,
  getPublicDepartments,
  createPublicRequest,
  getPersona,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import PublicHeader from '../components/PublicHeader';
import ImagePreviewModal from '../components/ImagePreviewModal';
import PdfPreviewModal from '../components/PdfPreviewModal';
import './RequestForm.css';

// ── Client-side WebP conversion (images only) ───────────────
// WebP encoding support is detected ONCE per module load.
let webpSupported = null;

function isWebpSupported() {
  if (webpSupported === null) {
    try {
      const canvas = document.createElement('canvas');
      webpSupported = canvas
        .toDataURL('image/webp')
        .startsWith('data:image/webp');
    } catch {
      webpSupported = false;
    }
  }
  return webpSupported;
}

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Could not load image'));
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function convertToWebP(file) {
  // Keep the file untouched when encoding is unsupported or the file is
  // not an image (e.g. Safari < 17 cannot encode WebP).
  if (
    !isWebpSupported() ||
    !file ||
    !file.type ||
    !file.type.startsWith('image/')
  ) {
    return file;
  }
  try {
    const source = await decodeImage(file);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0);
      // Race toBlob against a timeout so a canvas that never invokes its
      // callback cannot hang the conversion forever. On timeout, resolve
      // with null and fall back to the original file.
      const blob = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 10000);
        canvas.toBlob((b) => {
          clearTimeout(timer);
          resolve(b);
        }, 'image/webp', 0.82);
      });
      if (!blob || blob.type !== 'image/webp') return file;
      const baseName = file.name.replace(/\.[^.]+$/, '') || file.name;
      return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
    } finally {
      if (typeof source.close === 'function') source.close();
    }
  } catch {
    // Any conversion failure falls back to the original file so the
    // attach flow is never broken.
    return file;
  }
}

export default function RequestForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = Boolean(id);
  const isPublic = !user;

  const [modules, setModules] = useState([]);
  const [types, setTypes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState(null);

  const [form, setForm] = useState({
    cedula: '',
    nombre: '',
    apellido: '',
    applicantEmail: '',
    departmentId: '',
    telefono: '',
    moduleId: '',
    requestTypeId: '',
    priority: 'media',
    processDescription: '',
    currentBehavior: '',
    expectedBehavior: '',
  });
  const [personaFound, setPersonaFound] = useState(false);
  const [personaLoading, setPersonaLoading] = useState(false);

  // Guardarán objetos { file, previewUrl, name, size, type }
  const [screenshots, setScreenshots] = useState([]);
  const [documents, setDocuments] = useState([]);
  // Screenshots still being converted to WebP (submit is blocked meanwhile)
  const [convertingCount, setConvertingCount] = useState(0);
  // Registry of live object URLs so all of them can be revoked on unmount
  const liveUrlsRef = useRef(new Set());

  // Estados para los visores modales de vista previa en grande
  const [pdfPreviewModal, setPdfPreviewModal] = useState(null);
  const [imagePreviewModal, setImagePreviewModal] = useState(null);

  useEffect(() => {
    if (isPublic) {
      getPublicModules().then(setModules).catch(() => {});
      getPublicRequestTypes().then(setTypes).catch(() => {});
      getPublicDepartments().then(setDepartments).catch(() => {});
    } else {
      getModules().then(setModules).catch(() => {});
      getRequestTypes().then(setTypes).catch(() => {});
      getDepartments().then(setDepartments).catch(() => {});
    }

    if (id && user) {
      getRequest(id)
        .then((data) => {
          const r = data.request;
          setForm({
            cedula: '',
            nombre: '',
            apellido: '',
            applicantEmail: '',
            departmentId: r.department_id || '',
            moduleId: r.module_id,
            requestTypeId: r.request_type_id,
            priority: r.priority,
            processDescription: r.process_description || '',
            currentBehavior: r.current_behavior || '',
            expectedBehavior: r.expected_behavior || '',
          });
        })
        .catch(() => navigate('/solicitud'));
    }
  }, [id, isPublic, user, navigate]);

  // Revoke every live preview object URL when the form unmounts, including
  // URLs created for files that are still being converted. URLs removed via
  // the per-item remove/reset paths are deleted from the registry when they
  // are revoked, so the cleanup never revokes a URL twice.
  useEffect(() => {
    return () => {
      liveUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      liveUrlsRef.current.clear();
    };
  }, []);

  const isApplicantValid =
    form.cedula.trim() !== '' &&
    form.nombre.trim() !== '' &&
    form.applicantEmail.trim() !== '' &&
    Boolean(form.departmentId);

  const isValid =
    isApplicantValid &&
    Boolean(form.moduleId) &&
    Boolean(form.requestTypeId) &&
    form.processDescription.trim().length >= 10 &&
    form.currentBehavior.trim().length >= 10 &&
    form.expectedBehavior.trim().length >= 10 &&
    !isEditing;

  function handleChange(e) {
    const val =
      e.target.type === 'email'
        ? e.target.value.toLocaleLowerCase()
        : e.target.value.toLocaleUpperCase();
    setForm((prev) => ({ ...prev, [e.target.name]: val }));
  }

  async function handleCedulaBlur(e) {
    const cedula = e.target.value.trim().toUpperCase();
    if (!cedula) return;
    setPersonaLoading(true);
    try {
      const persona = await getPersona(cedula);
      if (persona) {
        setForm((prev) => ({
          ...prev,
          cedula: persona.cedula || cedula,
          nombre: persona.nombre || '',
          apellido: persona.apellido || '',
          applicantEmail: persona.email || prev.applicantEmail,
        }));
        setPersonaFound(true);
      } else {
        setForm((prev) => ({ ...prev, cedula, nombre: '', apellido: '' }));
        setPersonaFound(false);
      }
    } catch {
      setForm((prev) => ({ ...prev, cedula, nombre: '', apellido: '' }));
      setPersonaFound(false);
    } finally {
      setPersonaLoading(false);
    }
  }

  // Manejo de adjuntos de Capturas (Imágenes)
  const handleScreenshotChange = (e) => {
    const input = e.target;
    const files = Array.from(input.files);
    try {
      // Add items to state IMMEDIATELY (synchronously) using the original
      // file, so the grid updates at once and there is never a window where
      // selected evidence is missing from state or unsendable.
      const newItems = files.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        liveUrlsRef.current.add(previewUrl);
        return {
          file,
          previewUrl,
          name: file.name,
          size: (file.size / 1024).toFixed(1) + ' KB',
          type: file.type,
        };
      });
      setScreenshots((prev) => [...prev, ...newItems]);

      // Convert each image asynchronously and swap `item.file` in place when
      // ready; previewUrl/name/size/type stay bound to the original file so
      // the preview never flickers. The swap is matched by the original File
      // reference, so a file removed while converting is not resurrected and
      // a removed item is never updated.
      files.forEach((file) => {
        setConvertingCount((count) => count + 1);
        convertToWebP(file)
          .then((converted) => {
            setScreenshots((prev) =>
              prev.some((item) => item.file === file)
                ? prev.map((item) =>
                    item.file === file ? { ...item, file: converted } : item
                  )
                : prev
            );
          })
          .catch(() => {
            // Conversion error keeps the original file in place.
          })
          .finally(() => {
            setConvertingCount((count) => Math.max(0, count - 1));
          });
      });
    } finally {
      input.value = ''; // Reset input
    }
  };

  const removeScreenshot = (index) => {
    setScreenshots((prev) => {
      const { previewUrl } = prev[index];
      liveUrlsRef.current.delete(previewUrl);
      URL.revokeObjectURL(previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Manejo de adjuntos de Documentos (PDFs, Excel, CSV, etc.)
  const handleDocumentChange = (e) => {
    const files = Array.from(e.target.files);
    const newItems = files.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      liveUrlsRef.current.add(previewUrl);
      return {
        file,
        name: file.name,
        size: (file.size / 1024).toFixed(1) + ' KB',
        type: file.type,
        previewUrl,
      };
    });
    setDocuments((prev) => [...prev, ...newItems]);
    e.target.value = ''; // Reset input
  };

  const removeDocument = (index) => {
    setDocuments((prev) => {
      const { previewUrl } = prev[index];
      liveUrlsRef.current.delete(previewUrl);
      URL.revokeObjectURL(previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    // Edit mode must never POST to the public create endpoint.
    if (isEditing) return;
    if (!isValid) return;
    if (convertingCount > 0) return; // Screenshots still converting to WebP
    setSubmitting(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('cedula', form.cedula);
      fd.append('nombre', form.nombre);
      fd.append('apellido', form.apellido);
      fd.append('applicantEmail', form.applicantEmail);
      fd.append('departmentId', form.departmentId);
      fd.append('moduleId', form.moduleId);
      fd.append('requestTypeId', form.requestTypeId);
      fd.append('priority', form.priority);
      fd.append('processDescription', form.processDescription);
      fd.append('currentBehavior', form.currentBehavior);
      fd.append('expectedBehavior', form.expectedBehavior);

      // Extraemos el file real binario del estado
      for (const item of screenshots) fd.append('screenshots', item.file);
      for (const item of documents) fd.append('documents', item.file);

      const result = await createPublicRequest(fd);
      if (isPublic) {
        setSubmittedTicket(result.request);
      } else {
        navigate(`/requests/${result.request.request_id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !isEditing && isValid && !submitting;

  const validChecks = {
    cedula: form.cedula.trim().length > 0,
    nombre: form.nombre.trim().length > 0,
    email: form.applicantEmail.trim().length > 0,
    depto: Boolean(form.departmentId),
    modulo: Boolean(form.moduleId),
    tipo: Boolean(form.requestTypeId),
    descripcion: form.processDescription.trim().length >= 10,
    actual: form.currentBehavior.trim().length >= 10,
    esperado: form.expectedBehavior.trim().length >= 10,
  };

  function handleResetNew() {
    // Liberar URLs de objetos de memoria
    screenshots.forEach((item) => {
      liveUrlsRef.current.delete(item.previewUrl);
      URL.revokeObjectURL(item.previewUrl);
    });
    documents.forEach((item) => {
      liveUrlsRef.current.delete(item.previewUrl);
      URL.revokeObjectURL(item.previewUrl);
    });

    setSubmittedTicket(null);
    setForm({
      cedula: '',
      nombre: '',
      apellido: '',
      applicantEmail: '',
      departmentId: '',
      telefono: '',
      moduleId: '',
      requestTypeId: '',
      priority: 'media',
      processDescription: '',
      currentBehavior: '',
      expectedBehavior: '',
    });
    setPersonaFound(false);
    setScreenshots([]);
    setDocuments([]);
  }

  return (
    <div className="request-form-shell">
      {isPublic && <PublicHeader />}

      <div className="request-form-page">
        {submittedTicket ? (
          <div className="request-form request-form-success">
            <div className="success-checkmark">✓</div>
            <h1 className="success-title">¡Solicitud Enviada con Éxito!</h1>
            <p className="success-text">
              Tu solicitud ha sido ingresada al sistema y fue asignada al
              equipo de Desarrollo.
            </p>

            <div className="success-ticket-box">
              <span className="success-ticket-label">Código de Ticket</span>
              <div className="success-ticket-code">
                {submittedTicket.ticket_code}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleResetNew}>
              Enviar otra solicitud
            </button>
          </div>
        ) : (
          <>
            <div className="page-header form-page-header">
              <div>
                <h1>
                  {isEditing
                    ? 'Editar Solicitud'
                    : 'Nueva Solicitud de Sistema'}
                </h1>
                <p className="page-subtitle form-page-subtitle">
                  {isPublic
                    ? 'Complete este formulario para enviar una solicitud o reporte de error al Departamento de Sistemas.'
                    : 'Ingrese el detalle técnico del ticket.'}
                </p>
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="request-form">
              <section className="form-section">
                <h2>Datos del Solicitante</h2>
                <p className="section-desc">
                  Identifíquese para poder ponernos en contacto sobre el estado
                  de su solicitud.
                </p>
                <div className="form-row">
                  <div className="form-group">
                    <label>Cédula de Identidad *</label>
                    <div className="cedula-row">
                      <input
                        type="text"
                        name="cedula"
                        value={form.cedula}
                        onChange={handleChange}
                        onBlur={handleCedulaBlur}
                        placeholder="Ej: V-12345678"
                        required
                        className="cedula-input"
                      />
                      {personaLoading && (
                        <span className="persona-status-loading">
                          Buscando...
                        </span>
                      )}
                      {!personaLoading && personaFound && (
                        <span className="persona-badge persona-badge-found">
                          ✓ Encontrada
                        </span>
                      )}
                      {!personaLoading && !personaFound && form.cedula && (
                        <span className="persona-badge persona-badge-new">
                          Nueva persona
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Nombre *</label>
                    <input
                      type="text"
                      name="nombre"
                      value={form.nombre}
                      onChange={handleChange}
                      placeholder="Nombre"
                      required
                      readOnly={personaFound}
                      className={personaFound ? 'form-input-found' : undefined}
                    />
                  </div>
                  <div className="form-group">
                    <label>Apellido *</label>
                    <input
                      type="text"
                      name="apellido"
                      value={form.apellido}
                      onChange={handleChange}
                      placeholder="Apellido"
                      required
                      readOnly={personaFound}
                      className={personaFound ? 'form-input-found' : undefined}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Correo Electrónico *</label>
                    <input
                      type="email"
                      name="applicantEmail"
                      value={form.applicantEmail}
                      onChange={handleChange}
                      placeholder="su@email.com"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Departamento / Área *</label>
                    <select
                      name="departmentId"
                      value={form.departmentId}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Seleccionar departamento...</option>
                      {departments.map((d) => (
                        <option key={d.department_id} value={d.department_id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="form-section">
                <h2>Datos de la Solicitud</h2>
                <div className="form-row">
                  <div className="form-group">
                    <label>Módulo afectado *</label>
                    <select
                      name="moduleId"
                      value={form.moduleId}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Seleccionar módulo...</option>
                      {modules.map((m) => (
                        <option key={m.module_id} value={m.module_id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tipo de solicitud *</label>
                    <select
                      name="requestTypeId"
                      value={form.requestTypeId}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Seleccionar tipo...</option>
                      {types.map((t) => (
                        <option key={t.request_type_id} value={t.request_type_id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="form-section">
                <h2>Contexto Funcional</h2>
                <p className="section-desc">
                  Explique el proceso administrativo o contable asociado. Esta
                  información es obligatoria para que el equipo de sistemas
                  entienda el contexto.
                </p>
                <div className="form-group">
                  <label>
                    ¿Qué proceso administrativo/contable se está realizando? *
                  </label>
                  <textarea
                    name="processDescription"
                    value={form.processDescription}
                    onChange={handleChange}
                    rows={3}
                    placeholder='Ej: "Cierre de ejercicio fiscal para el pago de orden N° 4500"...'
                    required
                  />
                  <span className="char-count">
                    {form.processDescription.length} caracteres (mín 10)
                  </span>
                </div>
                <div className="form-group">
                  <label>
                    Comportamiento Actual (¿Qué hace el sistema ahora?) *
                  </label>
                  <textarea
                    name="currentBehavior"
                    value={form.currentBehavior}
                    onChange={handleChange}
                    rows={3}
                    placeholder='Ej: "Al intentar aprobar la orden de pago, muestra saldo insuficiente..."'
                    required
                  />
                  <span className="char-count">
                    {form.currentBehavior.length} caracteres (mín 10)
                  </span>
                </div>
                <div className="form-group">
                  <label>
                    Comportamiento Esperado (¿Qué DEBERÍA hacer?) *
                  </label>
                  <textarea
                    name="expectedBehavior"
                    value={form.expectedBehavior}
                    onChange={handleChange}
                    rows={3}
                    placeholder='Ej: "El sistema debe permitir consolidar el saldo de la partida previa..."'
                    required
                  />
                  <span className="char-count">
                    {form.expectedBehavior.length} caracteres (mín 10)
                  </span>
                </div>
              </section>

              {!isEditing && (
                <section className="form-section">
                  <h2>Evidencias</h2>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Captura de Pantalla del Error</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        multiple
                        onChange={handleScreenshotChange}
                      />
                      <span className="file-hint">
                        {screenshots.length} archivo(s) seleccionado(s)
                      </span>
                      {convertingCount > 0 && (
                        <span className="file-hint converting-hint">
                          Convirtiendo imágenes a WebP…
                        </span>
                      )}

                      {/* Vista Previa de Imágenes */}
                      {screenshots.length > 0 && (
                        <div className="screenshot-grid">
                          {screenshots.map((item, idx) => (
                            <div
                              key={idx}
                              className="screenshot-tile"
                              onClick={() => setImagePreviewModal(item)}
                            >
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeScreenshot(idx);
                                }}
                                className="screenshot-remove-btn"
                              >
                                ✕
                              </button>
                              <img
                                src={item.previewUrl}
                                alt={item.name}
                                className="screenshot-thumb"
                              />
                              <div className="screenshot-name">
                                {item.name}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Documento de Soporte</label>
                      <input
                        type="file"
                        accept=".pdf,.csv,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        multiple
                        onChange={handleDocumentChange}
                      />
                      <span className="file-hint">
                        {documents.length} archivo(s) seleccionado(s)
                      </span>

                      {/* Vista Previa de Documentos */}
                      {documents.length > 0 && (
                        <div className="document-list">
                          {documents.map((item, idx) => (
                            <div key={idx} className="document-item">
                              <div className="document-info">
                                <span className="document-icon">
                                  {item.type === 'application/pdf'
                                    ? '📄'
                                    : '📊'}
                                </span>
                                <div className="document-text">
                                  <div className="document-name">
                                    {item.name}
                                  </div>
                                  <div className="document-size">
                                    {item.size}
                                  </div>
                                </div>
                              </div>

                              <div className="document-actions">
                                {item.type === 'application/pdf' && (
                                  <button
                                    type="button"
                                    className="pdf-view-btn"
                                    onClick={() => setPdfPreviewModal(item)}
                                  >
                                    Ver PDF
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="document-remove-btn"
                                  onClick={() => removeDocument(idx)}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* Indicadores de Validación del Formulario */}
              <div className="form-validation-hint">
                {Object.entries(validChecks).map(([key, val]) => (
                  <span
                    key={key}
                    className={`validation-check ${
                      val ? 'is-valid' : 'is-invalid'
                    }`}
                  >
                    {val ? '✓' : '✗'} {key}
                  </span>
                ))}
                <span
                  className={`validation-ready ${
                    canSubmit ? 'is-valid' : 'is-pending'
                  }`}
                >
                  {canSubmit ? '✓ LISTO' : '⏳ faltan campos'}
                </span>
              </div>

              {/* Acciones del Formulario */}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate(-1)}
                >
                  Cancelar
                </button>
                {!isEditing && (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!canSubmit || convertingCount > 0}
                  >
                    {submitting ? 'Guardando...' : 'Enviar Solicitud'}
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>

      {/* Modal para Visualización Previa de Imágenes */}
      {imagePreviewModal && (
        <ImagePreviewModal
          src={imagePreviewModal.previewUrl}
          alt={imagePreviewModal.name}
          onClose={() => setImagePreviewModal(null)}
        />
      )}

      {/* Modal para Visualización Previa de PDF */}
      {pdfPreviewModal && (
        <PdfPreviewModal
          url={pdfPreviewModal.previewUrl}
          name={pdfPreviewModal.name}
          onClose={() => setPdfPreviewModal(null)}
        />
      )}
    </div>
  );
}