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

  // Dynamic Stepper State
  const [currentStep, setCurrentStep] = useState(1);
  const [copiedTicket, setCopiedTicket] = useState(false);
  const [isDragOverScreenshot, setIsDragOverScreenshot] = useState(false);
  const [isDragOverDocument, setIsDragOverDocument] = useState(false);

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

  // Adjuntos
  const [screenshots, setScreenshots] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [convertingCount, setConvertingCount] = useState(0);
  const liveUrlsRef = useRef(new Set());

  // Visores Modales
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

  const isStep1Valid = isApplicantValid;
  const isStep2Valid = Boolean(form.moduleId) && Boolean(form.requestTypeId);
  const isStep3Valid =
    form.processDescription.trim().length >= 10 &&
    form.currentBehavior.trim().length >= 10 &&
    form.expectedBehavior.trim().length >= 10;

  const isValid = isStep1Valid && isStep2Valid && isStep3Valid && !isEditing;

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

  // Manejo de Capturas
  const addScreenshotFiles = (filesList) => {
    const files = Array.from(filesList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    
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
        .catch(() => {})
        .finally(() => {
          setConvertingCount((count) => Math.max(0, count - 1));
        });
    });
  };

  const handleScreenshotChange = (e) => {
    if (e.target.files?.length) {
      addScreenshotFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleScreenshotDrop = (e) => {
    e.preventDefault();
    setIsDragOverScreenshot(false);
    if (e.dataTransfer.files?.length) {
      addScreenshotFiles(e.dataTransfer.files);
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

  // Manejo de Documentos
  const addDocumentFiles = (filesList) => {
    const files = Array.from(filesList);
    if (!files.length) return;
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
  };

  const handleDocumentChange = (e) => {
    if (e.target.files?.length) {
      addDocumentFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleDocumentDrop = (e) => {
    e.preventDefault();
    setIsDragOverDocument(false);
    if (e.dataTransfer.files?.length) {
      addDocumentFiles(e.dataTransfer.files);
    }
  };

  const removeDocument = (index) => {
    setDocuments((prev) => {
      const { previewUrl } = prev[index];
      liveUrlsRef.current.delete(previewUrl);
      URL.revokeObjectURL(previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleCopyTicketCode = () => {
    if (submittedTicket?.ticket_code) {
      navigator.clipboard.writeText(submittedTicket.ticket_code);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 2500);
    }
  };

  const handleInsertTemplate = (field, text) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field] ? `${prev[field]}\n${text}` : text,
    }));
  };

  const handleNextStep = () => {
    if (currentStep === 1 && isStep1Valid) setCurrentStep(2);
    else if (currentStep === 2 && isStep2Valid) setCurrentStep(3);
  };

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (isEditing || !isValid || convertingCount > 0) return;
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

      for (const item of screenshots) fd.append('screenshots', item.file);
      for (const item of documents) fd.append('documents', item.file);

      const result = await createPublicRequest(fd);
      if (isPublic) {
        setSubmittedTicket(result.request);
      } else {
        navigate(`/requests/${result.request.request_id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar la solicitud. Intente nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetNew() {
    screenshots.forEach((item) => {
      liveUrlsRef.current.delete(item.previewUrl);
      URL.revokeObjectURL(item.previewUrl);
    });
    documents.forEach((item) => {
      liveUrlsRef.current.delete(item.previewUrl);
      URL.revokeObjectURL(item.previewUrl);
    });

    setSubmittedTicket(null);
    setCurrentStep(1);
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

  const canSubmit = !isEditing && isValid && !submitting;

  return (
    <div className="request-form-shell">
      {isPublic && <PublicHeader />}

      <div className="request-form-page">
        {submittedTicket ? (
          <div className="request-form request-form-success" role="status" aria-live="polite">
            <div className="success-checkmark" aria-hidden="true">✓</div>
            <h1 className="success-title">¡Solicitud Enviada con Éxito!</h1>
            <p className="success-text">
              Tu solicitud ha sido ingresada correctamente al sistema y fue asignada al
              equipo de Desarrollo de Sistemas.
            </p>

            <div className="success-ticket-box">
              <span className="success-ticket-label">Código de Ticket para Seguimiento</span>
              <div className="success-ticket-code">{submittedTicket.ticket_code}</div>
              <button
                type="button"
                className="btn-copy-ticket"
                onClick={handleCopyTicketCode}
                aria-label="Copiar código de ticket"
              >
                {copiedTicket ? '✓ Copiado al portapapeles' : '📋 Copiar Código'}
              </button>
            </div>

            <div className="success-actions">
              <button className="btn btn-primary" onClick={handleResetNew}>
                Enviar otra solicitud
              </button>
              <button className="btn btn-outline" onClick={() => navigate('/buscar')}>
                Ir a buscar mi solicitud
              </button>
            </div>
          </div>
        ) : (
          <>
            <header className="page-header form-page-header">
              <div>
                <h1>
                  {isEditing ? 'Editar Solicitud' : 'Nueva Solicitud de Servicio / Reporte'}
                </h1>
                <p className="page-subtitle form-page-subtitle">
                  {isPublic
                    ? 'Completá los 3 pasos a continuación para enviar tu requerimiento al equipo de Sistemas.'
                    : 'Ingresá el detalle técnico de la solicitud interna.'}
                </p>
              </div>
            </header>

            {/* Visual Stepper / Wizard Tabs */}
            <nav className="stepper-nav" aria-label="Pasos de la solicitud">
              <div className="stepper-progress-bar-bg">
                <div
                  className="stepper-progress-bar-fill"
                  style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                />
              </div>

              <button
                type="button"
                className={`step-tab ${currentStep === 1 ? 'is-active' : ''} ${
                  isStep1Valid ? 'is-completed' : ''
                }`}
                onClick={() => setCurrentStep(1)}
                aria-current={currentStep === 1 ? 'step' : undefined}
              >
                <div className="step-badge">
                  {isStep1Valid ? '✓' : '1'}
                </div>
                <div className="step-label">
                  <span className="step-title">1. Solicitante</span>
                  <span className="step-sub">Datos de contacto</span>
                </div>
              </button>

              <button
                type="button"
                className={`step-tab ${currentStep === 2 ? 'is-active' : ''} ${
                  isStep2Valid ? 'is-completed' : ''
                }`}
                onClick={() => isStep1Valid && setCurrentStep(2)}
                disabled={!isStep1Valid}
                aria-current={currentStep === 2 ? 'step' : undefined}
              >
                <div className="step-badge">
                  {isStep2Valid ? '✓' : '2'}
                </div>
                <div className="step-label">
                  <span className="step-title">2. Clasificación</span>
                  <span className="step-sub">Módulo y tipo</span>
                </div>
              </button>

              <button
                type="button"
                className={`step-tab ${currentStep === 3 ? 'is-active' : ''} ${
                  isStep3Valid ? 'is-completed' : ''
                }`}
                onClick={() => isStep1Valid && isStep2Valid && setCurrentStep(3)}
                disabled={!isStep1Valid || !isStep2Valid}
                aria-current={currentStep === 3 ? 'step' : undefined}
              >
                <div className="step-badge">
                  {isStep3Valid ? '✓' : '3'}
                </div>
                <div className="step-label">
                  <span className="step-title">3. Detalle y Evidencias</span>
                  <span className="step-sub">Explicación y archivos</span>
                </div>
              </button>
            </nav>

            {error && (
              <div className="alert alert-error" role="alert">
                <span>⚠️ {error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="request-form" noValidate>
              {/* PASO 1: DATOS DEL SOLICITANTE */}
              {currentStep === 1 && (
                <section className="form-section fade-in-step" aria-labelledby="step1-heading">
                  <h2 id="step1-heading">
                    <span className="section-icon">👤</span> Datos del Solicitante
                  </h2>
                  <p className="section-desc">
                    Identificate con tu Cédula de Identidad para verificar tus datos institucionales.
                  </p>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="cedula">Cédula de Identidad *</label>
                      <div className="cedula-row">
                        <input
                          id="cedula"
                          type="text"
                          name="cedula"
                          value={form.cedula}
                          onChange={handleChange}
                          onBlur={handleCedulaBlur}
                          placeholder="Ej: V-12345678"
                          required
                          aria-required="true"
                          aria-describedby="cedula-status"
                          className="cedula-input"
                        />
                        <div id="cedula-status" role="status" aria-live="polite">
                          {personaLoading && (
                            <span className="persona-status-loading">
                              <span className="spinner-icon">⏳</span> Buscando...
                            </span>
                          )}
                          {!personaLoading && personaFound && (
                            <span className="persona-badge persona-badge-found">
                              ✓ Verificada
                            </span>
                          )}
                          {!personaLoading && !personaFound && form.cedula.trim() !== '' && (
                            <span className="persona-badge persona-badge-new">
                              Nueva Persona
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="nombre">Nombre *</label>
                      <input
                        id="nombre"
                        type="text"
                        name="nombre"
                        value={form.nombre}
                        onChange={handleChange}
                        placeholder="Nombre completo"
                        required
                        aria-required="true"
                        readOnly={personaFound}
                        className={personaFound ? 'form-input-found' : undefined}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="apellido">Apellido *</label>
                      <input
                        id="apellido"
                        type="text"
                        name="apellido"
                        value={form.apellido}
                        onChange={handleChange}
                        placeholder="Apellido completo"
                        required
                        aria-required="true"
                        readOnly={personaFound}
                        className={personaFound ? 'form-input-found' : undefined}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="applicantEmail">Correo Electrónico de Contacto *</label>
                      <input
                        id="applicantEmail"
                        type="email"
                        name="applicantEmail"
                        value={form.applicantEmail}
                        onChange={handleChange}
                        placeholder="ejemplo@gobernacion.gob.ve"
                        required
                        aria-required="true"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="departmentId">Departamento / Dirección de Origen *</label>
                      <select
                        id="departmentId"
                        name="departmentId"
                        value={form.departmentId}
                        onChange={handleChange}
                        required
                        aria-required="true"
                      >
                        <option value="">-- Seleccionar departamento --</option>
                        {departments.map((d) => (
                          <option key={d.department_id} value={d.department_id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="step-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-next-step"
                      onClick={handleNextStep}
                      disabled={!isStep1Valid}
                    >
                      Continuar a Clasificación →
                    </button>
                  </div>
                </section>
              )}

              {/* PASO 2: CLASIFICACIÓN DE LA SOLICITUD */}
              {currentStep === 2 && (
                <section className="form-section fade-in-step" aria-labelledby="step2-heading">
                  <h2 id="step2-heading">
                    <span className="section-icon">📋</span> Clasificación de la Solicitud
                  </h2>
                  <p className="section-desc">
                    Indicá qué sistema o módulo presenta el problema o requiere mejoras.
                  </p>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="moduleId">Módulo / Sistema Afectado *</label>
                      <select
                        id="moduleId"
                        name="moduleId"
                        value={form.moduleId}
                        onChange={handleChange}
                        required
                        aria-required="true"
                      >
                        <option value="">-- Seleccionar módulo afectado --</option>
                        {modules.map((m) => (
                          <option key={m.module_id} value={m.module_id}>
                            💻 {m.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="requestTypeId">Tipo de Requerimiento *</label>
                      <select
                        id="requestTypeId"
                        name="requestTypeId"
                        value={form.requestTypeId}
                        onChange={handleChange}
                        required
                        aria-required="true"
                      >
                        <option value="">-- Seleccionar tipo de solicitud --</option>
                        {types.map((t) => (
                          <option key={t.request_type_id} value={t.request_type_id}>
                            ⚙️ {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="priority">Nivel de Impacto / Prioridad</label>
                      <select
                        id="priority"
                        name="priority"
                        value={form.priority}
                        onChange={handleChange}
                      >
                        <option value="baja">🟢 Baja (Consulta / Cambio estético)</option>
                        <option value="media">🟡 Media (Inconveniente con alternativa)</option>
                        <option value="alta">🔴 Alta (Bloquea el trabajo diario)</option>
                      </select>
                    </div>
                  </div>

                  <div className="step-actions">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handlePrevStep}
                    >
                      ← Volver
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-next-step"
                      onClick={handleNextStep}
                      disabled={!isStep2Valid}
                    >
                      Continuar a Detalle y Evidencias →
                    </button>
                  </div>
                </section>
              )}

              {/* PASO 3: DETALLE Y EVIDENCIAS */}
              {currentStep === 3 && (
                <section className="form-section fade-in-step" aria-labelledby="step3-heading">
                  <h2 id="step3-heading">
                    <span className="section-icon">📝</span> Detalle del Caso y Evidencias
                  </h2>
                  <p className="section-desc">
                    Explicá el contexto para que nuestro equipo pueda reproducir y resolver el requerimiento rápidamente.
                  </p>

                  <div className="form-group">
                    <label htmlFor="processDescription">
                      1. ¿Qué proceso administrativo o trámite estabas realizando? *
                    </label>
                    <textarea
                      id="processDescription"
                      name="processDescription"
                      value={form.processDescription}
                      onChange={handleChange}
                      rows={3}
                      placeholder='Ej: "Registro de nómina mensual" o "Generación de reporte trimestral de caja"...'
                      required
                      aria-required="true"
                      aria-describedby="desc-count"
                    />
                    <div className="textarea-footer">
                      <span id="desc-count" className={`char-count ${form.processDescription.length >= 10 ? 'is-valid-count' : ''}`}>
                        {form.processDescription.length} / 10 caracteres mín.
                      </span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="currentBehavior">
                      2. Comportamiento Actual (¿Qué hace o muestra el sistema ahora?) *
                    </label>
                    <div className="quick-templates">
                      <span className="template-label">Sugerencias rápidas:</span>
                      <button
                        type="button"
                        className="template-chip"
                        onClick={() => handleInsertTemplate('currentBehavior', 'El sistema muestra un mensaje de error en pantalla al hacer clic en guardar.')}
                      >
                        + Mensaje de error al guardar
                      </button>
                      <button
                        type="button"
                        className="template-chip"
                        onClick={() => handleInsertTemplate('currentBehavior', 'La pantalla se queda cargando indefinidamente.')}
                      >
                        + Carga indefinida
                      </button>
                    </div>
                    <textarea
                      id="currentBehavior"
                      name="currentBehavior"
                      value={form.currentBehavior}
                      onChange={handleChange}
                      rows={3}
                      placeholder='Ej: "Al presionar el botón Procesar, aparece un mensaje rojo que dice Error 500"...'
                      required
                      aria-required="true"
                      aria-describedby="current-count"
                    />
                    <div className="textarea-footer">
                      <span id="current-count" className={`char-count ${form.currentBehavior.length >= 10 ? 'is-valid-count' : ''}`}>
                        {form.currentBehavior.length} / 10 caracteres mín.
                      </span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="expectedBehavior">
                      3. Comportamiento Esperado (¿Qué debería suceder?) *
                    </label>
                    <textarea
                      id="expectedBehavior"
                      name="expectedBehavior"
                      value={form.expectedBehavior}
                      onChange={handleChange}
                      rows={3}
                      placeholder='Ej: "Debería emitir el comprobante PDF con la firma y actualizar el saldo actual"...'
                      required
                      aria-required="true"
                      aria-describedby="expected-count"
                    />
                    <div className="textarea-footer">
                      <span id="expected-count" className={`char-count ${form.expectedBehavior.length >= 10 ? 'is-valid-count' : ''}`}>
                        {form.expectedBehavior.length} / 10 caracteres mín.
                      </span>
                    </div>
                  </div>

                  {/* Zona de Evidencias (Adjuntos) */}
                  {!isEditing && (
                    <div className="evidencias-container">
                      <h3>Adjuntar Evidencias (Opcional pero recomendado)</h3>

                      <div className="form-row">
                        {/* Dropzone Imagenes */}
                        <div className="form-group">
                          <label id="screenshot-label">Capturas de Pantalla (JPG, PNG, WebP)</label>
                          <div
                            className={`dropzone ${isDragOverScreenshot ? 'is-dragover' : ''}`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragOverScreenshot(true);
                            }}
                            onDragLeave={() => setIsDragOverScreenshot(false)}
                            onDrop={handleScreenshotDrop}
                          >
                            <span className="dropzone-icon">🖼️</span>
                            <p className="dropzone-text">
                              Arrastrá tus imágenes aquí o{' '}
                              <label htmlFor="screenshot-input" className="dropzone-browse">
                                explorá tus archivos
                              </label>
                            </p>
                            <input
                              id="screenshot-input"
                              type="file"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              multiple
                              onChange={handleScreenshotChange}
                              className="sr-only-input"
                            />
                          </div>

                          {convertingCount > 0 && (
                            <span className="file-hint converting-hint">
                              ⚡ Optimizando imágenes a WebP...
                            </span>
                          )}

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
                                    aria-label={`Eliminar imagen ${item.name}`}
                                  >
                                    ✕
                                  </button>
                                  <img
                                    src={item.previewUrl}
                                    alt={item.name}
                                    className="screenshot-thumb"
                                  />
                                  <div className="screenshot-name">{item.name}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Dropzone Documentos */}
                        <div className="form-group">
                          <label id="document-label">Documentos de Soporte (PDF, Excel, CSV)</label>
                          <div
                            className={`dropzone ${isDragOverDocument ? 'is-dragover' : ''}`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragOverDocument(true);
                            }}
                            onDragLeave={() => setIsDragOverDocument(false)}
                            onDrop={handleDocumentDrop}
                          >
                            <span className="dropzone-icon">📄</span>
                            <p className="dropzone-text">
                              Arrastrá tus documentos PDF o planillas o{' '}
                              <label htmlFor="document-input" className="dropzone-browse">
                                seleccioná un archivo
                              </label>
                            </p>
                            <input
                              id="document-input"
                              type="file"
                              accept=".pdf,.csv,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                              multiple
                              onChange={handleDocumentChange}
                              className="sr-only-input"
                            />
                          </div>

                          {documents.length > 0 && (
                            <div className="document-list">
                              {documents.map((item, idx) => (
                                <div key={idx} className="document-item">
                                  <div className="document-info">
                                    <span className="document-icon">
                                      {item.type === 'application/pdf' ? '📄' : '📊'}
                                    </span>
                                    <div className="document-text">
                                      <div className="document-name">{item.name}</div>
                                      <div className="document-size">{item.size}</div>
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
                                      aria-label={`Eliminar documento ${item.name}`}
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
                    </div>
                  )}

                  {/* Acciones Finales del Formulario */}
                  <div className="form-actions-step">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={handlePrevStep}
                    >
                      ← Volver a Clasificación
                    </button>

                    <button
                      type="submit"
                      className="btn btn-primary btn-submit-lg"
                      disabled={!canSubmit || convertingCount > 0}
                    >
                      {submitting ? '⏳ Guardando Solicitud...' : '🚀 Enviar Solicitud Ahora'}
                    </button>
                  </div>
                </section>
              )}
            </form>
          </>
        )}
      </div>

      {/* Modales de Vista Previa */}
      {imagePreviewModal && (
        <ImagePreviewModal
          src={imagePreviewModal.previewUrl}
          alt={imagePreviewModal.name}
          onClose={() => setImagePreviewModal(null)}
        />
      )}

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