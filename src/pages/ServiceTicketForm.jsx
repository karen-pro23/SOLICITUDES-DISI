import { useState, useEffect, useRef } from 'react';
import {
  getPersona,
  getPublicDepartments,
  getServiceTypes,
  createServiceTicket,
} from '../services/api';
import PublicHeader from '../components/PublicHeader';
import ImagePreviewModal from '../components/ImagePreviewModal';
import PdfPreviewModal from '../components/PdfPreviewModal';
import LetterSendingAnimation from '../components/LetterSendingAnimation';
import './RequestForm.css';

// ── Upload Limits & Allowed Types ──────────────────────────────
const MAX_SCREENSHOTS = 5;
const MAX_DOCUMENTS = 5;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_EXTENSIONS = ['.pdf', '.csv', '.xlsx', '.xls'];
const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const ASSIGNED_AREAS = ['SOPORTE', 'REDES', 'TELEFONÍA', 'HARDWARE', 'SOFTWARE'];

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '0 KB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / 1024).toFixed(1) + ' KB';
}

export default function ServiceTicketForm() {
  const [form, setForm] = useState({
    cedula: '',
    nombre: '',
    apellido: '',
    email: '',
    departmentId: '',
    departmentName: '',
    extension: '',
    assignedArea: '',
    serviceType: '',
    description: '',
    observations: '',
  });

  const [departments, setDepartments] = useState([]);
  const [serviceTypeOptions, setServiceTypeOptions] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [sendingAnimation, setSendingAnimation] = useState(false);
  const [error, setError] = useState('');
  const [submittedTicket, setSubmittedTicket] = useState(null);

  // Stepper
  const [currentStep, setCurrentStep] = useState(1);
  const [copiedTicket, setCopiedTicket] = useState(false);

  // Validation
  const [touched, setTouched] = useState({});
  const [attemptedNext, setAttemptedNext] = useState({});

  // Persona lookup
  const [personaFound, setPersonaFound] = useState(false);
  const [personaLoading, setPersonaLoading] = useState(false);

  // Uploads
  const [screenshots, setScreenshots] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [convertingCount, setConvertingCount] = useState(0);
  const liveUrlsRef = useRef(new Set());
  const [uploadNotice, setUploadNotice] = useState(null);
  const [isDragOverScreenshot, setIsDragOverScreenshot] = useState(false);
  const [isDragOverDocument, setIsDragOverDocument] = useState(false);

  // Modals
  const [pdfPreviewModal, setPdfPreviewModal] = useState(null);
  const [imagePreviewModal, setImagePreviewModal] = useState(null);

  // ── Load data on mount ──────────────────────────────
  useEffect(() => {
    getPublicDepartments().then(setDepartments).catch(() => {});
    getServiceTypes().then(setServiceTypeOptions).catch(() => {});
    return () => {
      liveUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      liveUrlsRef.current.clear();
    };
  }, []);

  // ── Paste handler for screenshots ───────────────────
  useEffect(() => {
    if (currentStep !== 3) return;

    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const pastedImages = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            const ext = blob.type.split('/')[1] || 'png';
            const file = new File([blob], `captura_pegada_${Date.now()}.${ext}`, { type: blob.type });
            pastedImages.push(file);
          }
        }
      }
      if (pastedImages.length > 0) {
        e.preventDefault();
        addScreenshotFiles(pastedImages);
        showUploadNotice(`¡${pastedImages.length} captura(s) pegada(s) desde el portapapeles!`, 'success');
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentStep]);

  // ── Upload helpers ──────────────────────────────────
  const showUploadNotice = (message, type = 'error') => {
    setUploadNotice({ message, type });
    setTimeout(() => {
      setUploadNotice((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const addScreenshotFiles = (filesList) => {
    const rawFiles = Array.from(filesList);
    if (!rawFiles.length) return;

    let rejectedType = 0;
    let oversized = 0;
    const validFiles = rawFiles.filter((f) => {
      const isImg = f.type.startsWith('image/') || ALLOWED_IMAGE_TYPES.includes(f.type);
      if (!isImg) { rejectedType++; return false; }
      if (f.size > MAX_FILE_SIZE_BYTES) { oversized++; return false; }
      return true;
    });

    if (oversized > 0) showUploadNotice(`Se ignoraron ${oversized} imagen(es) por superar el tamaño máximo de 50 MB.`, 'error');
    if (rejectedType > 0 && oversized === 0) showUploadNotice(`Se ignoraron ${rejectedType} archivo(s) que no son imágenes válidas (JPG, PNG, WebP, GIF).`, 'warning');
    if (!validFiles.length) return;

    setScreenshots((prev) => {
      const availableSpace = MAX_SCREENSHOTS - prev.length;
      if (availableSpace <= 0) { showUploadNotice('Alcanzaste el límite máximo de 5 capturas de pantalla.', 'warning'); return prev; }
      const filesToAdd = validFiles.slice(0, availableSpace);
      if (validFiles.length > availableSpace) showUploadNotice(`Se agregaron solo ${availableSpace} captura(s) para no superar el límite de 5.`, 'warning');

      const newItems = filesToAdd.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        liveUrlsRef.current.add(previewUrl);
        return { file, previewUrl, name: file.name, size: formatBytes(file.size), type: file.type, isConverting: false };
      });
      return [...prev, ...newItems];
    });
  };

  const handleScreenshotChange = (e) => { if (e.target.files?.length) { addScreenshotFiles(e.target.files); e.target.value = ''; } };
  const handleScreenshotDrop = (e) => {
    e.preventDefault(); setIsDragOverScreenshot(false);
    if (!e.dataTransfer.files?.length) return;
    const dropped = Array.from(e.dataTransfer.files);
    const images = dropped.filter((f) => f.type.startsWith('image/'));
    const docs = dropped.filter((f) => !f.type.startsWith('image/'));
    if (images.length) addScreenshotFiles(images);
    if (docs.length) { addDocumentFiles(docs); showUploadNotice('Se clasificaron automáticamente los documentos en Documentos de Soporte.', 'info'); }
  };
  const removeScreenshot = (index) => {
    setScreenshots((prev) => {
      const { previewUrl } = prev[index];
      liveUrlsRef.current.delete(previewUrl);
      URL.revokeObjectURL(previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const addDocumentFiles = (filesList) => {
    const rawFiles = Array.from(filesList);
    if (!rawFiles.length) return;

    let rejectedType = 0;
    let oversized = 0;
    const validFiles = rawFiles.filter((f) => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      const isValidDoc = ALLOWED_DOC_MIMES.includes(f.type) || ALLOWED_DOC_EXTENSIONS.includes(ext);
      if (!isValidDoc) { rejectedType++; return false; }
      if (f.size > MAX_FILE_SIZE_BYTES) { oversized++; return false; }
      return true;
    });

    if (oversized > 0) showUploadNotice(`Se ignoraron ${oversized} documento(s) por superar el tamaño máximo de 50 MB.`, 'error');
    if (rejectedType > 0 && oversized === 0) showUploadNotice(`Se ignoraron ${rejectedType} archivo(s) no permitidos. Solo se admiten PDF, Excel (.xlsx, .xls) y CSV.`, 'warning');
    if (!validFiles.length) return;

    setDocuments((prev) => {
      const availableSpace = MAX_DOCUMENTS - prev.length;
      if (availableSpace <= 0) { showUploadNotice('Alcanzaste el límite máximo de 5 documentos de soporte.', 'warning'); return prev; }
      const filesToAdd = validFiles.slice(0, availableSpace);
      if (validFiles.length > availableSpace) showUploadNotice(`Se agregaron solo ${availableSpace} documento(s) para no superar el límite de 5.`, 'warning');

      const newItems = filesToAdd.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        liveUrlsRef.current.add(previewUrl);
        return { file, name: file.name, size: formatBytes(file.size), type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'text/csv'), previewUrl };
      });
      return [...prev, ...newItems];
    });
  };

  const handleDocumentChange = (e) => { if (e.target.files?.length) { addDocumentFiles(e.target.files); e.target.value = ''; } };
  const handleDocumentDrop = (e) => {
    e.preventDefault(); setIsDragOverDocument(false);
    if (!e.dataTransfer.files?.length) return;
    const dropped = Array.from(e.dataTransfer.files);
    const images = dropped.filter((f) => f.type.startsWith('image/'));
    const docs = dropped.filter((f) => !f.type.startsWith('image/'));
    if (docs.length) addDocumentFiles(docs);
    if (images.length) { addScreenshotFiles(images); showUploadNotice('Las imágenes arrastradas se agregaron automáticamente en Capturas de Pantalla.', 'info'); }
  };
  const removeDocument = (index) => {
    setDocuments((prev) => {
      const { previewUrl } = prev[index];
      liveUrlsRef.current.delete(previewUrl);
      URL.revokeObjectURL(previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ── Validation ──────────────────────────────────────
  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const getStep1ErrorsMap = () => {
    const errs = {};
    if (!form.cedula.trim()) errs.cedula = 'Por favor ingresá tu Cédula de Identidad.';
    if (!form.nombre.trim()) errs.nombre = 'Por favor indicá tu Nombre.';
    if (!form.apellido.trim()) errs.apellido = 'Por favor indicá tu Apellido.';
    if (!form.email.trim()) {
      errs.email = 'Por favor ingresá tu Correo Electrónico de contacto.';
    } else if (!validateEmail(form.email)) {
      errs.email = 'El correo no tiene un formato válido (ejemplo: tu.nombre@gobernacion.gob.ve).';
    }
    if (!form.departmentId) errs.departmentId = 'Por favor seleccioná tu Departamento o Dirección de origen.';
    return errs;
  };

  const getStep2ErrorsMap = () => {
    const errs = {};
    if (!form.assignedArea) errs.assignedArea = 'Seleccioná el Área Asignada para el soporte.';
    if (!form.serviceType) errs.serviceType = 'Seleccioná el Tipo de Servicio requerido.';
    return errs;
  };

  const getStep3ErrorsMap = () => {
    const errs = {};
    const dLen = form.description.trim().length;
    if (dLen < 10) errs.description = `Describí el problema o requerimiento técnico (te faltan ${10 - dLen} caracteres para llegar al mínimo de 10).`;
    return errs;
  };

  const step1Errors = getStep1ErrorsMap();
  const step2Errors = getStep2ErrorsMap();
  const step3Errors = getStep3ErrorsMap();
  const isStep1Valid = Object.keys(step1Errors).length === 0;
  const isStep2Valid = Object.keys(step2Errors).length === 0;
  const isStep3Valid = Object.keys(step3Errors).length === 0;
  const isValid = isStep1Valid && isStep2Valid && isStep3Valid;

  // ── Handlers ────────────────────────────────────────
  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value.toLocaleUpperCase() }));
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
          email: persona.email || prev.email,
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

  function handleDepartmentChange(e) {
    const deptId = e.target.value;
    const dept = departments.find((d) => String(d.department_id) === String(deptId));
    setForm((prev) => ({
      ...prev,
      departmentId: deptId,
      departmentName: dept ? dept.name : '',
    }));
  }

  const handleBlur = (e) => {
    const { name } = e.target;
    if (name) setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleStepTabClick = (targetStep) => {
    if (targetStep === 1) { setCurrentStep(1); return; }
    if (targetStep === 2) {
      if (!isStep1Valid) {
        setAttemptedNext((prev) => ({ ...prev, 1: true }));
        setTouched((prev) => ({ ...prev, cedula: true, nombre: true, apellido: true, email: true, departmentId: true }));
        return;
      }
      setCurrentStep(2);
    }
    if (targetStep === 3) {
      if (!isStep1Valid) {
        setCurrentStep(1);
        setAttemptedNext((prev) => ({ ...prev, 1: true }));
        setTouched((prev) => ({ ...prev, cedula: true, nombre: true, apellido: true, email: true, departmentId: true }));
        return;
      }
      if (!isStep2Valid) {
        setCurrentStep(2);
        setAttemptedNext((prev) => ({ ...prev, 2: true }));
        setTouched((prev) => ({ ...prev, assignedArea: true, serviceType: true }));
        return;
      }
      setCurrentStep(3);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!isStep1Valid) {
        setAttemptedNext((prev) => ({ ...prev, 1: true }));
        setTouched((prev) => ({ ...prev, cedula: true, nombre: true, apellido: true, email: true, departmentId: true }));
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!isStep2Valid) {
        setAttemptedNext((prev) => ({ ...prev, 2: true }));
        setTouched((prev) => ({ ...prev, assignedArea: true, serviceType: true }));
        return;
      }
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => { if (currentStep > 1) setCurrentStep((prev) => prev - 1); };

  const handleCopyTicketCode = () => {
    if (submittedTicket?.ticket_code) {
      navigator.clipboard.writeText(submittedTicket.ticket_code);
      setCopiedTicket(true);
      setTimeout(() => setCopiedTicket(false), 3000);
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();

    if (!isStep1Valid) {
      setCurrentStep(1);
      setAttemptedNext((prev) => ({ ...prev, 1: true }));
      setTouched((prev) => ({ ...prev, cedula: true, nombre: true, apellido: true, email: true, departmentId: true }));
      return;
    }
    if (!isStep2Valid) {
      setCurrentStep(2);
      setAttemptedNext((prev) => ({ ...prev, 2: true }));
      setTouched((prev) => ({ ...prev, assignedArea: true, serviceType: true }));
      return;
    }
    if (!isStep3Valid) {
      setAttemptedNext((prev) => ({ ...prev, 3: true }));
      setTouched((prev) => ({ ...prev, description: true }));
      return;
    }

    setSubmitting(true);
    setSendingAnimation(true);
    setError('');

    try {
      const payload = {
        cedula: form.cedula,
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        departmentName: form.departmentName,
        extension: form.extension,
        assignedArea: form.assignedArea,
        serviceType: form.serviceType,
        description: form.description,
        observations: form.observations,
      };

      const result = await createServiceTicket(payload);

      const minDelay = new Promise((resolve) => setTimeout(resolve, 2500));
      const apiCall = Promise.resolve(result);
      const [, finalResult] = await Promise.all([minDelay, apiCall]);

      setSendingAnimation(false);
      setSubmittedTicket(finalResult);
    } catch (err) {
      setSendingAnimation(false);
      setError(err.response?.data?.error || 'Error al enviar la solicitud. Intente nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetNew() {
    screenshots.forEach((item) => { liveUrlsRef.current.delete(item.previewUrl); URL.revokeObjectURL(item.previewUrl); });
    documents.forEach((item) => { liveUrlsRef.current.delete(item.previewUrl); URL.revokeObjectURL(item.previewUrl); });
    setSubmittedTicket(null);
    setCurrentStep(1);
    setForm({
      cedula: '', nombre: '', apellido: '', email: '', departmentId: '', departmentName: '',
      extension: '', assignedArea: '', serviceType: '', description: '', observations: '',
    });
    setPersonaFound(false);
    setScreenshots([]);
    setDocuments([]);
    setTouched({});
    setAttemptedNext({});
  }

  const canSubmit = isValid && !submitting;

  // ── RENDER ──────────────────────────────────────────
  return (
    <div className="request-form-shell">
      <PublicHeader />

      {/* Overlay de Animación de Envío */}
      {sendingAnimation && (
        <div className="sending-overlay" role="alert" aria-live="assertive">
          <div className="sending-overlay-content">
            <LetterSendingAnimation />
            <h2 className="sending-title">Enviando tu solicitud de servicio técnico...</h2>
            <p className="sending-subtitle">Por favor no cierres esta ventana</p>
            <div className="sending-dots">
              <span className="sending-dot" />
              <span className="sending-dot" />
              <span className="sending-dot" />
            </div>
          </div>
        </div>
      )}

      <div className="request-form-page">
        {submittedTicket ? (
          /* ── PANTALLA DE ÉXITO ──────────────────────── */
          <div className="request-form request-form-success" role="status" aria-live="polite">
            <LetterSendingAnimation ticketCode={submittedTicket.ticket_code} />
            <h1 className="success-title">¡Solicitud de Servicio Técnico Registrada!</h1>
            <p className="success-text">
              Tu solicitud fue recibida correctamente y será atendida por el equipo de soporte técnico de la Dirección de Sistemas e Información.
            </p>

            <div className="success-ticket-box">
              <span className="success-ticket-label">Código de Seguimiento</span>
              <div className="success-ticket-code">{submittedTicket.ticket_code}</div>
              <button
                type="button"
                className="btn-copy-ticket"
                onClick={handleCopyTicketCode}
                aria-label="Copiar código de ticket"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', justifyContent: 'center' }}
              >
                {copiedTicket ? (
                  <>✓ Copiado al portapapeles</>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    Copiar Código
                  </>
                )}
              </button>
            </div>

            <div className="success-messages">
              <div className="success-message-thanks">
                <span className="success-msg-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                </span>
                <p>Gracias por utilizar el sistema de solicitudes de la Dirección de Sistemas e Información.</p>
              </div>
              <div className="success-message-attention">
                <span className="success-msg-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </span>
                <p>Su requerimiento será atendido a la brevedad por el equipo de soporte técnico. Recibirá una notificación con el avance de su solicitud.</p>
              </div>
            </div>

            <div className="success-actions">
              <button className="btn btn-primary" onClick={handleResetNew}>
                Enviar otra solicitud
              </button>
              <button className="btn btn-outline" onClick={() => window.location.href = '/buscar'}>
                Ir a buscar mi solicitud
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── HEADER ──────────────────────────────── */}
            <header className="page-header form-page-header">
              <div>
                <h1>Solicitud de Servicio Técnico</h1>
                <p className="page-subtitle form-page-subtitle">
                  Completá los 3 pasos a continuación para registrar tu solicitud de soporte técnico.
                </p>
              </div>
            </header>

            {/* ── STEPPER ─────────────────────────────── */}
            <nav className="stepper-nav" aria-label="Pasos de la solicitud">
              <div className="stepper-progress-bar-bg">
                <div
                  className="stepper-progress-bar-fill"
                  style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
                />
              </div>

              <button
                type="button"
                className={`step-tab ${currentStep === 1 ? 'is-active' : ''} ${isStep1Valid ? 'is-completed' : ''}`}
                onClick={() => handleStepTabClick(1)}
                aria-current={currentStep === 1 ? 'step' : undefined}
              >
                <div className="step-badge">{isStep1Valid ? '✓' : '1'}</div>
                <div className="step-label">
                  <span className="step-title">1. Solicitante</span>
                  <span className="step-sub">Datos de contacto</span>
                </div>
              </button>

              <button
                type="button"
                className={`step-tab ${currentStep === 2 ? 'is-active' : ''} ${isStep2Valid ? 'is-completed' : ''}`}
                onClick={() => handleStepTabClick(2)}
                aria-current={currentStep === 2 ? 'step' : undefined}
              >
                <div className="step-badge">{isStep2Valid ? '✓' : '2'}</div>
                <div className="step-label">
                  <span className="step-title">2. Clasificación</span>
                  <span className="step-sub">Área y tipo de servicio</span>
                </div>
              </button>

              <button
                type="button"
                className={`step-tab ${currentStep === 3 ? 'is-active' : ''} ${isStep3Valid ? 'is-completed' : ''}`}
                onClick={() => handleStepTabClick(3)}
                aria-current={currentStep === 3 ? 'step' : undefined}
              >
                <div className="step-badge">{isStep3Valid ? '✓' : '3'}</div>
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
              {/* ═══ PASO 1: DATOS DEL SOLICITANTE ═══ */}
              {currentStep === 1 && (
                <section className="form-section fade-in-step" aria-labelledby="step1-heading">
                  <h2 id="step1-heading">
                    <span className="section-icon">👤</span> Datos del Solicitante
                  </h2>
                  <p className="section-desc">
                    Identificate con tu Cédula de Identidad para verificar tus datos institucionales.
                  </p>

                  {attemptedNext[1] && !isStep1Valid && (
                    <div className="validation-error-alert" role="alert">
                      <div className="validation-alert-header">
                        <span className="validation-alert-icon">⚠️</span>
                        <strong>Para avanzar al Paso 2, por favor completá los siguientes datos:</strong>
                      </div>
                      <ul className="validation-alert-list">
                        {Object.values(step1Errors).map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}

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
                          onBlur={(e) => { handleBlur(e); handleCedulaBlur(e); }}
                          placeholder="Ej: V-12345678"
                          required
                          aria-required="true"
                          aria-describedby="cedula-status"
                          className={`cedula-input ${(touched.cedula || attemptedNext[1]) && step1Errors.cedula ? 'input-error' : ''}`}
                        />
                        <div id="cedula-status" role="status" aria-live="polite">
                          {personaLoading && (
                            <span className="persona-status-loading">
                              <span className="spinner-icon">⏳</span> Buscando...
                            </span>
                          )}
                          {!personaLoading && personaFound && (
                            <span className="persona-badge persona-badge-found">✓ Verificada</span>
                          )}
                          {!personaLoading && !personaFound && form.cedula.trim() !== '' && (
                            <span className="persona-badge persona-badge-new">Nueva Persona</span>
                          )}
                        </div>
                      </div>
                      {(touched.cedula || attemptedNext[1]) && step1Errors.cedula && (
                        <span className="field-error-text">⚠️ {step1Errors.cedula}</span>
                      )}
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
                        onBlur={handleBlur}
                        placeholder="Nombre completo"
                        required
                        aria-required="true"
                        readOnly={personaFound}
                        className={`${personaFound ? 'form-input-found' : ''} ${(touched.nombre || attemptedNext[1]) && step1Errors.nombre ? 'input-error' : ''}`}
                      />
                      {(touched.nombre || attemptedNext[1]) && step1Errors.nombre && (
                        <span className="field-error-text">⚠️ {step1Errors.nombre}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label htmlFor="apellido">Apellido *</label>
                      <input
                        id="apellido"
                        type="text"
                        name="apellido"
                        value={form.apellido}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Apellido completo"
                        required
                        aria-required="true"
                        readOnly={personaFound}
                        className={`${personaFound ? 'form-input-found' : ''} ${(touched.apellido || attemptedNext[1]) && step1Errors.apellido ? 'input-error' : ''}`}
                      />
                      {(touched.apellido || attemptedNext[1]) && step1Errors.apellido && (
                        <span className="field-error-text">⚠️ {step1Errors.apellido}</span>
                      )}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="email">Correo Electrónico de Contacto *</label>
                      <input
                        id="email"
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value.toLocaleLowerCase() }))}
                        onBlur={handleBlur}
                        placeholder="ejemplo@gobernacion.gob.ve"
                        required
                        aria-required="true"
                        className={(touched.email || attemptedNext[1]) && step1Errors.email ? 'input-error' : undefined}
                      />
                      {(touched.email || attemptedNext[1]) && step1Errors.email && (
                        <span className="field-error-text">⚠️ {step1Errors.email}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label htmlFor="departmentId">Departamento / Dirección de Origen *</label>
                      <select
                        id="departmentId"
                        name="departmentId"
                        value={form.departmentId}
                        onChange={handleDepartmentChange}
                        onBlur={handleBlur}
                        required
                        aria-required="true"
                        className={(touched.departmentId || attemptedNext[1]) && step1Errors.departmentId ? 'input-error' : undefined}
                      >
                        <option value="">-- Seleccionar departamento --</option>
                        {departments.map((d) => (
                          <option key={d.department_id} value={d.department_id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                      {(touched.departmentId || attemptedNext[1]) && step1Errors.departmentId && (
                        <span className="field-error-text">⚠️ {step1Errors.departmentId}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label htmlFor="extension">Extensión Telefónica</label>
                      <input
                        type="text"
                        id="extension"
                        name="extension"
                        value={form.extension}
                        onChange={(e) => setForm((prev) => ({ ...prev, extension: e.target.value }))}
                        placeholder="Ej: 2842"
                        className="input"
                      />
                      <span className="field-help">Opcional — requerido para Servicio Técnico</span>
                    </div>
                  </div>

                  <div className="step-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-next-step"
                      onClick={handleNextStep}
                    >
                      Continuar a Clasificación →
                    </button>
                  </div>
                </section>
              )}

              {/* ═══ PASO 2: CLASIFICACIÓN DEL SERVICIO ═══ */}
              {currentStep === 2 && (
                <section className="form-section fade-in-step" aria-labelledby="step2-heading">
                  <h2 id="step2-heading">
                    <span className="section-icon">📋</span> Clasificación del Servicio
                  </h2>
                  <p className="section-desc">
                    Indicá el área responsable y el tipo de servicio técnico que necesitás.
                  </p>

                  {attemptedNext[2] && !isStep2Valid && (
                    <div className="validation-error-alert" role="alert">
                      <div className="validation-alert-header">
                        <span className="validation-alert-icon">⚠️</span>
                        <strong>Para avanzar al Paso 3, seleccioná la información requerida:</strong>
                      </div>
                      <ul className="validation-alert-list">
                        {Object.values(step2Errors).map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="assignedArea">Área Asignada *</label>
                      <select
                        id="assignedArea"
                        name="assignedArea"
                        value={form.assignedArea}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                        aria-required="true"
                        className={(touched.assignedArea || attemptedNext[2]) && step2Errors.assignedArea ? 'input-error' : undefined}
                      >
                        <option value="">-- Seleccionar área --</option>
                        {ASSIGNED_AREAS.map((a) => (
                          <option key={a} value={a}>⚙️ {a}</option>
                        ))}
                      </select>
                      {(touched.assignedArea || attemptedNext[2]) && step2Errors.assignedArea && (
                        <span className="field-error-text">⚠️ {step2Errors.assignedArea}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="serviceType">Tipo de Servicio *</label>
                      <select
                        id="serviceType"
                        name="serviceType"
                        value={form.serviceType}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                        aria-required="true"
                        className={(touched.serviceType || attemptedNext[2]) && step2Errors.serviceType ? 'input-error' : undefined}
                      >
                        <option value="">-- Seleccionar tipo de servicio --</option>
                        {serviceTypeOptions.map((st) => (
                          <option key={st} value={st}>🔧 {st}</option>
                        ))}
                      </select>
                      {(touched.serviceType || attemptedNext[2]) && step2Errors.serviceType && (
                        <span className="field-error-text">⚠️ {step2Errors.serviceType}</span>
                      )}
                    </div>
                  </div>

                  <div className="step-actions">
                    <button type="button" className="btn btn-outline" onClick={handlePrevStep}>
                      ← Volver
                    </button>
                    <button type="button" className="btn btn-primary btn-next-step" onClick={handleNextStep}>
                      Continuar a Detalle y Evidencias →
                    </button>
                  </div>
                </section>
              )}

              {/* ═══ PASO 3: DETALLE DEL PROBLEMA Y EVIDENCIAS ═══ */}
              {currentStep === 3 && (
                <section className="form-section fade-in-step" aria-labelledby="step3-heading">
                  <h2 id="step3-heading">
                    <span className="section-icon">📝</span> Detalle del Problema y Evidencias
                  </h2>
                  <p className="section-desc">
                    Describí el problema o requerimiento técnico para que nuestro equipo pueda asistirte rápidamente.
                  </p>

                  {attemptedNext[3] && !isStep3Valid && (
                    <div className="validation-error-alert" role="alert">
                      <div className="validation-alert-header">
                        <span className="validation-alert-icon">⚠️</span>
                        <strong>Para finalizar la solicitud, completá los detalles obligatorios:</strong>
                      </div>
                      <ul className="validation-alert-list">
                        {Object.values(step3Errors).map((msg, idx) => (
                          <li key={idx}>{msg}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="description">Descripción del Problema *</label>
                    <textarea
                      id="description"
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      rows={4}
                      placeholder='Ej: "La impresora del tercer piso no imprime, muestra un mensaje de error de papel atascado"...'
                      required
                      aria-required="true"
                      aria-describedby="desc-count"
                      className={(touched.description || attemptedNext[3]) && step3Errors.description ? 'input-error' : undefined}
                    />
                    <div className="textarea-footer">
                      <span id="desc-count" className={`char-count ${form.description.length >= 10 ? 'is-valid-count' : ''}`}>
                        {form.description.length} / 10 caracteres mín.
                      </span>
                    </div>
                    {(touched.description || attemptedNext[3]) && step3Errors.description && (
                      <span className="field-error-text">⚠️ {step3Errors.description}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="observations">Observaciones Adicionales</label>
                    <textarea
                      id="observations"
                      name="observations"
                      value={form.observations}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      rows={3}
                      placeholder="Información adicional, horarios de disponibilidad, referencias, etc."
                    />
                  </div>

                  {/* ── Zona de Evidencias (Adjuntos) ────── */}
                  <div className="evidencias-container">
                    <div className="evidencias-header">
                      <h3>Adjuntar Evidencias (Opcional pero recomendado)</h3>
                      <span className="evidencias-subtitle">Máximo 5 capturas y 5 documentos de soporte (hasta 50 MB por archivo)</span>
                    </div>

                    <div className="upload-paste-tip">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                      <span><strong>Tip rápido:</strong> Podés pegar capturas directamente con <kbd>Ctrl</kbd> + <kbd>V</kbd> (o <kbd>⌘</kbd> + <kbd>V</kbd>) en esta pantalla.</span>
                    </div>

                    {uploadNotice && (
                      <div className={`upload-notice upload-notice-${uploadNotice.type}`} role="alert">
                        <span className="upload-notice-icon">
                          {uploadNotice.type === 'success' ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                          ) : uploadNotice.type === 'warning' ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          ) : uploadNotice.type === 'info' ? (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                          ) : (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                          )}
                        </span>
                        <span className="upload-notice-text">{uploadNotice.message}</span>
                        <button type="button" className="upload-notice-close" onClick={() => setUploadNotice(null)} aria-label="Cerrar notificación">✕</button>
                      </div>
                    )}

                    <div className="form-row">
                      {/* Dropzone Imágenes */}
                      <div className="form-group">
                        <div className="label-with-badge">
                          <label id="screenshot-label">Capturas de Pantalla (JPG, PNG, WebP)</label>
                          <span className={`upload-count-badge ${screenshots.length >= MAX_SCREENSHOTS ? 'is-max' : ''}`}>
                            {screenshots.length} / {MAX_SCREENSHOTS}
                          </span>
                        </div>
                        <div
                          className={`dropzone ${isDragOverScreenshot ? 'is-dragover' : ''} ${screenshots.length >= MAX_SCREENSHOTS ? 'is-disabled' : ''}`}
                          onDragOver={(e) => { e.preventDefault(); setIsDragOverScreenshot(true); }}
                          onDragLeave={() => setIsDragOverScreenshot(false)}
                          onDrop={handleScreenshotDrop}
                        >
                          <span className="dropzone-icon">🖼️</span>
                          <p className="dropzone-text">
                            Arrastrá imágenes aquí o{' '}
                            <label htmlFor="screenshot-input" className="dropzone-browse">explorá tus archivos</label>
                          </p>
                          <input
                            id="screenshot-input"
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            multiple
                            disabled={screenshots.length >= MAX_SCREENSHOTS}
                            onChange={handleScreenshotChange}
                            className="sr-only-input"
                          />
                        </div>

                        {convertingCount > 0 && (
                          <span className="file-hint converting-hint">⚡ Optimizando imágenes a WebP...</span>
                        )}

                        {screenshots.length > 0 && (
                          <div className="screenshot-grid">
                            {screenshots.map((item, idx) => (
                              <div key={idx} className="screenshot-tile" onClick={() => setImagePreviewModal(item)}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removeScreenshot(idx); }}
                                  className="screenshot-remove-btn"
                                  aria-label={`Eliminar imagen ${item.name}`}
                                >✕</button>
                                <img src={item.previewUrl} alt={item.name} className="screenshot-thumb" />
                                <div className="screenshot-meta">
                                  <div className="screenshot-name">{item.name}</div>
                                  <div className="screenshot-size">{item.size}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Dropzone Documentos */}
                      <div className="form-group">
                        <div className="label-with-badge">
                          <label id="document-label">Documentos de Soporte (PDF, Excel, CSV)</label>
                          <span className={`upload-count-badge ${documents.length >= MAX_DOCUMENTS ? 'is-max' : ''}`}>
                            {documents.length} / {MAX_DOCUMENTS}
                          </span>
                        </div>
                        <div
                          className={`dropzone ${isDragOverDocument ? 'is-dragover' : ''} ${documents.length >= MAX_DOCUMENTS ? 'is-disabled' : ''}`}
                          onDragOver={(e) => { e.preventDefault(); setIsDragOverDocument(true); }}
                          onDragLeave={() => setIsDragOverDocument(false)}
                          onDrop={handleDocumentDrop}
                        >
                          <span className="dropzone-icon">📄</span>
                          <p className="dropzone-text">
                            Arrastrá documentos PDF o planillas o{' '}
                            <label htmlFor="document-input" className="dropzone-browse">seleccioná un archivo</label>
                          </p>
                          <input
                            id="document-input"
                            type="file"
                            accept=".pdf,.csv,.xlsx,.xls,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                            multiple
                            disabled={documents.length >= MAX_DOCUMENTS}
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
                                    {item.type === 'application/pdf' || item.name.endsWith('.pdf') ? '📄' : '📊'}
                                  </span>
                                  <div className="document-text">
                                    <div className="document-name">{item.name}</div>
                                    <div className="document-size">{item.size}</div>
                                  </div>
                                </div>
                                <div className="document-actions">
                                  {(item.type === 'application/pdf' || item.name.endsWith('.pdf')) && (
                                    <button type="button" className="pdf-view-btn" onClick={() => setPdfPreviewModal(item)}>
                                      Ver PDF
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="document-remove-btn"
                                    onClick={() => removeDocument(idx)}
                                    aria-label={`Eliminar documento ${item.name}`}
                                  >✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Acciones Finales ───────────────── */}
                  <div className="form-actions-step">
                    <button type="button" className="btn btn-outline" onClick={handlePrevStep}>
                      ← Volver a Clasificación
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-submit-lg"
                      disabled={submitting}
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
