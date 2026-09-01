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

// ── Upload Limits & Allowed Types ──────────────────────────────
const MAX_SCREENSHOTS = 5;
const MAX_DOCUMENTS = 5;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_DOC_EXTENSIONS = ['.pdf', '.csv', '.xlsx', '.xls'];
const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

function formatBytes(bytes) {
  if (!bytes || isNaN(bytes)) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
  return (bytes / 1024).toFixed(1) + ' KB';
}
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

  // Form Validation & Touched State
  const [touched, setTouched] = useState({});
  const [attemptedNext, setAttemptedNext] = useState({});

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

  // Notification state for upload feedback
  const [uploadNotice, setUploadNotice] = useState(null);

  const showUploadNotice = (message, type = 'error') => {
    setUploadNotice({ message, type });
    setTimeout(() => {
      setUploadNotice((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Adjuntos
  const [screenshots, setScreenshots] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [convertingCount, setConvertingCount] = useState(0);
  const liveUrlsRef = useRef(new Set());

  // Visores Modales
  const [pdfPreviewModal, setPdfPreviewModal] = useState(null);
  const [imagePreviewModal, setImagePreviewModal] = useState(null);

  // Escuchar evento Paste (Ctrl+V) para capturas de pantalla
  useEffect(() => {
    if (currentStep !== 3 || isEditing) return;

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
            const file = new File(
              [blob],
              `captura_pegada_${Date.now()}.${ext}`,
              { type: blob.type }
            );
            pastedImages.push(file);
          }
        }
      }

      if (pastedImages.length > 0) {
        e.preventDefault();
        addScreenshotFiles(pastedImages);
        showUploadNotice(`¡${pastedImages.length} captura(s) pegada(s) desde el portapapeles! 📋✨`, 'success');
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentStep, isEditing]);

  // Cargar Módulos, Tipos de Solicitud y Departamentos al iniciar
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

  // Limpieza de URLs creadas
  useEffect(() => {
    return () => {
      liveUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      liveUrlsRef.current.clear();
    };
  }, []);

  // Validation functions with friendly non-technical Spanish messages
  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const getStep1ErrorsMap = () => {
    const errs = {};
    if (!form.cedula.trim()) {
      errs.cedula = 'Por favor ingresá tu Cédula de Identidad.';
    }
    if (!form.nombre.trim()) {
      errs.nombre = 'Por favor indicá tu Nombre.';
    }
    if (!form.apellido.trim()) {
      errs.apellido = 'Por favor indicá tu Apellido.';
    }
    if (!form.applicantEmail.trim()) {
      errs.applicantEmail = 'Por favor ingresá tu Correo Electrónico de contacto.';
    } else if (!validateEmail(form.applicantEmail)) {
      errs.applicantEmail = 'El correo no tiene un formato válido (ejemplo: tu.nombre@gobernacion.gob.ve).';
    }
    if (!form.departmentId) {
      errs.departmentId = 'Por favor seleccioná tu Departamento o Dirección de origen.';
    }
    return errs;
  };

  const getStep2ErrorsMap = () => {
    const errs = {};
    if (!form.moduleId) {
      errs.moduleId = 'Seleccioná el Módulo o Sistema donde ocurrió la falla o necesidad.';
    }
    if (!form.requestTypeId) {
      errs.requestTypeId = 'Seleccioná el Tipo de Solicitud (ej: Falla de sistema, Solicitud de cambio).';
    }
    return errs;
  };

  const getStep3ErrorsMap = () => {
    const errs = {};
    const pLen = form.processDescription.trim().length;
    if (pLen < 10) {
      errs.processDescription = `Explicá qué trámite estabas haciendo (te faltan ${10 - pLen} caracteres para llegar al mínimo de 10).`;
    }
    const cLen = form.currentBehavior.trim().length;
    if (cLen < 10) {
      errs.currentBehavior = `Describí qué error o problema te muestra el sistema (te faltan ${10 - cLen} caracteres para llegar al mínimo de 10).`;
    }
    const eLen = form.expectedBehavior.trim().length;
    if (eLen < 10) {
      errs.expectedBehavior = `Explicá qué esperabas que hiciera el sistema (te faltan ${10 - eLen} caracteres para llegar al mínimo de 10).`;
    }
    return errs;
  };

  const step1Errors = getStep1ErrorsMap();
  const step2Errors = getStep2ErrorsMap();
  const step3Errors = getStep3ErrorsMap();

  const isStep1Valid = Object.keys(step1Errors).length === 0;
  const isStep2Valid = Object.keys(step2Errors).length === 0;
  const isStep3Valid = Object.keys(step3Errors).length === 0;

  const isValid = isStep1Valid && isStep2Valid && isStep3Valid && !isEditing;

  function handleChange(e) {
    const { name, value, type } = e.target;
    let val;
    if (type === 'email' || name === 'priority') {
      val = value.toLocaleLowerCase();
    } else {
      val = value.toLocaleUpperCase();
    }
    setForm((prev) => ({ ...prev, [name]: val }));
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
    const rawFiles = Array.from(filesList);
    if (!rawFiles.length) return;

    let rejectedType = 0;
    let oversized = 0;

    const validFiles = rawFiles.filter((f) => {
      const isImg = f.type.startsWith('image/') || ALLOWED_IMAGE_TYPES.includes(f.type);
      if (!isImg) {
        rejectedType++;
        return false;
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        oversized++;
        return false;
      }
      return true;
    });

    if (oversized > 0) {
      showUploadNotice(`Se ignoraron ${oversized} imagen(es) por superar el tamaño máximo de 50 MB.`, 'error');
    }
    if (rejectedType > 0 && oversized === 0) {
      showUploadNotice(`Se ignoraron ${rejectedType} archivo(s) que no son imágenes válidas (JPG, PNG, WebP, GIF).`, 'warning');
    }

    if (!validFiles.length) return;

    setScreenshots((prev) => {
      const availableSpace = MAX_SCREENSHOTS - prev.length;
      if (availableSpace <= 0) {
        showUploadNotice('Alcanzaste el límite máximo de 5 capturas de pantalla.', 'warning');
        return prev;
      }

      const filesToAdd = validFiles.slice(0, availableSpace);
      if (validFiles.length > availableSpace) {
        showUploadNotice(`Se agregaron solo ${availableSpace} captura(s) para no superar el límite de 5.`, 'warning');
      }

      const newItems = filesToAdd.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        liveUrlsRef.current.add(previewUrl);
        return {
          file,
          previewUrl,
          name: file.name,
          size: formatBytes(file.size),
          type: file.type,
          isConverting: true,
        };
      });

      filesToAdd.forEach((file) => {
        setConvertingCount((count) => count + 1);
        convertToWebP(file)
          .then((converted) => {
            setScreenshots((current) =>
              current.map((item) =>
                item.file === file ? { ...item, file: converted, size: formatBytes(converted.size), isConverting: false } : item
              )
            );
          })
          .catch(() => {
            setScreenshots((current) =>
              current.map((item) => (item.file === file ? { ...item, isConverting: false } : item))
            );
          })
          .finally(() => {
            setConvertingCount((count) => Math.max(0, count - 1));
          });
      });

      return [...prev, ...newItems];
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
    if (!e.dataTransfer.files?.length) return;
    const droppedFiles = Array.from(e.dataTransfer.files);

    const images = droppedFiles.filter((f) => f.type.startsWith('image/'));
    const docs = droppedFiles.filter((f) => !f.type.startsWith('image/'));

    if (images.length) addScreenshotFiles(images);
    if (docs.length) {
      addDocumentFiles(docs);
      showUploadNotice('Se clasificaron automáticamente los documentos en Documentos de Soporte.', 'info');
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
    const rawFiles = Array.from(filesList);
    if (!rawFiles.length) return;

    let rejectedType = 0;
    let oversized = 0;

    const validFiles = rawFiles.filter((f) => {
      const ext = '.' + f.name.split('.').pop().toLowerCase();
      const isValidDoc = ALLOWED_DOC_MIMES.includes(f.type) || ALLOWED_DOC_EXTENSIONS.includes(ext);
      if (!isValidDoc) {
        rejectedType++;
        return false;
      }
      if (f.size > MAX_FILE_SIZE_BYTES) {
        oversized++;
        return false;
      }
      return true;
    });

    if (oversized > 0) {
      showUploadNotice(`Se ignoraron ${oversized} documento(s) por superar el tamaño máximo de 50 MB.`, 'error');
    }
    if (rejectedType > 0 && oversized === 0) {
      showUploadNotice(`Se ignoraron ${rejectedType} archivo(s) no permitidos. Solo se admiten PDF, Excel (.xlsx, .xls) y CSV.`, 'warning');
    }

    if (!validFiles.length) return;

    setDocuments((prev) => {
      const availableSpace = MAX_DOCUMENTS - prev.length;
      if (availableSpace <= 0) {
        showUploadNotice('Alcanzaste el límite máximo de 5 documentos de soporte.', 'warning');
        return prev;
      }

      const filesToAdd = validFiles.slice(0, availableSpace);
      if (validFiles.length > availableSpace) {
        showUploadNotice(`Se agregaron solo ${availableSpace} documento(s) para no superar el límite de 5.`, 'warning');
      }

      const newItems = filesToAdd.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        liveUrlsRef.current.add(previewUrl);
        return {
          file,
          name: file.name,
          size: formatBytes(file.size),
          type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'text/csv'),
          previewUrl,
        };
      });

      return [...prev, ...newItems];
    });
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
    if (!e.dataTransfer.files?.length) return;
    const droppedFiles = Array.from(e.dataTransfer.files);

    const images = droppedFiles.filter((f) => f.type.startsWith('image/'));
    const docs = droppedFiles.filter((f) => !f.type.startsWith('image/'));

    if (docs.length) addDocumentFiles(docs);
    if (images.length) {
      addScreenshotFiles(images);
      showUploadNotice('Las imágenes arrastradas se agregaron automáticamente en Capturas de Pantalla.', 'info');
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

  const handleBlur = (e) => {
    const { name } = e.target;
    if (name) {
      setTouched((prev) => ({ ...prev, [name]: true }));
    }
  };

  const handleStepTabClick = (targetStep) => {
    if (targetStep === 1) {
      setCurrentStep(1);
      return;
    }
    if (targetStep === 2) {
      if (!isStep1Valid) {
        setAttemptedNext((prev) => ({ ...prev, 1: true }));
        setTouched((prev) => ({
          ...prev,
          cedula: true,
          nombre: true,
          apellido: true,
          applicantEmail: true,
          departmentId: true,
        }));
        return;
      }
      setCurrentStep(2);
    }
    if (targetStep === 3) {
      if (!isStep1Valid) {
        setCurrentStep(1);
        setAttemptedNext((prev) => ({ ...prev, 1: true }));
        setTouched((prev) => ({
          ...prev,
          cedula: true,
          nombre: true,
          apellido: true,
          applicantEmail: true,
          departmentId: true,
        }));
        return;
      }
      if (!isStep2Valid) {
        setCurrentStep(2);
        setAttemptedNext((prev) => ({ ...prev, 2: true }));
        setTouched((prev) => ({
          ...prev,
          moduleId: true,
          requestTypeId: true,
        }));
        return;
      }
      setCurrentStep(3);
    }
  };

  const handleInsertTemplate = (field, text) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field] ? `${prev[field]}\n${text}` : text,
    }));
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (!isStep1Valid) {
        setAttemptedNext((prev) => ({ ...prev, 1: true }));
        setTouched((prev) => ({
          ...prev,
          cedula: true,
          nombre: true,
          apellido: true,
          applicantEmail: true,
          departmentId: true,
        }));
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!isStep2Valid) {
        setAttemptedNext((prev) => ({ ...prev, 2: true }));
        setTouched((prev) => ({
          ...prev,
          moduleId: true,
          requestTypeId: true,
        }));
        return;
      }
      setCurrentStep(3);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) setCurrentStep((prev) => prev - 1);
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (isEditing) return;

    if (!isStep1Valid) {
      setCurrentStep(1);
      setAttemptedNext((prev) => ({ ...prev, 1: true }));
      setTouched((prev) => ({
        ...prev,
        cedula: true,
        nombre: true,
        apellido: true,
        applicantEmail: true,
        departmentId: true,
      }));
      return;
    }

    if (!isStep2Valid) {
      setCurrentStep(2);
      setAttemptedNext((prev) => ({ ...prev, 2: true }));
      setTouched((prev) => ({
        ...prev,
        moduleId: true,
        requestTypeId: true,
      }));
      return;
    }

    if (!isStep3Valid) {
      setAttemptedNext((prev) => ({ ...prev, 3: true }));
      setTouched((prev) => ({
        ...prev,
        processDescription: true,
        currentBehavior: true,
        expectedBehavior: true,
      }));
      return;
    }

    if (convertingCount > 0) {
      showUploadNotice('Por favor aguardá a que finalice la optimización de imágenes antes de enviar.', 'warning');
      return;
    }

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
                onClick={() => handleStepTabClick(1)}
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
                onClick={() => handleStepTabClick(2)}
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
                onClick={() => handleStepTabClick(3)}
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
                          onBlur={(e) => {
                            handleBlur(e);
                            handleCedulaBlur(e);
                          }}
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
                      <label htmlFor="applicantEmail">Correo Electrónico de Contacto *</label>
                      <input
                        id="applicantEmail"
                        type="email"
                        name="applicantEmail"
                        value={form.applicantEmail}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="ejemplo@gobernacion.gob.ve"
                        required
                        aria-required="true"
                        className={(touched.applicantEmail || attemptedNext[1]) && step1Errors.applicantEmail ? 'input-error' : undefined}
                      />
                      {(touched.applicantEmail || attemptedNext[1]) && step1Errors.applicantEmail && (
                        <span className="field-error-text">⚠️ {step1Errors.applicantEmail}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label htmlFor="departmentId">Departamento / Dirección de Origen *</label>
                      <select
                        id="departmentId"
                        name="departmentId"
                        value={form.departmentId}
                        onChange={handleChange}
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

              {/* PASO 2: CLASIFICACIÓN DE LA SOLICITUD */}
              {currentStep === 2 && (
                <section className="form-section fade-in-step" aria-labelledby="step2-heading">
                  <h2 id="step2-heading">
                    <span className="section-icon">📋</span> Clasificación de la Solicitud
                  </h2>
                  <p className="section-desc">
                    Indicá qué sistema o módulo presenta el problema o requiere mejoras.
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
                      <label htmlFor="moduleId">Módulo / Sistema Afectado *</label>
                      <select
                        id="moduleId"
                        name="moduleId"
                        value={form.moduleId}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                        aria-required="true"
                        className={(touched.moduleId || attemptedNext[2]) && step2Errors.moduleId ? 'input-error' : undefined}
                      >
                        <option value="">-- Seleccionar módulo afectado --</option>
                        {modules.map((m) => (
                          <option key={m.module_id} value={m.module_id}>
                            💻 {m.name}
                          </option>
                        ))}
                      </select>
                      {(touched.moduleId || attemptedNext[2]) && step2Errors.moduleId && (
                        <span className="field-error-text">⚠️ {step2Errors.moduleId}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="requestTypeId">Tipo de Requerimiento *</label>
                      <select
                        id="requestTypeId"
                        name="requestTypeId"
                        value={form.requestTypeId}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                        aria-required="true"
                        className={(touched.requestTypeId || attemptedNext[2]) && step2Errors.requestTypeId ? 'input-error' : undefined}
                      >
                        <option value="">-- Seleccionar tipo de solicitud --</option>
                        {types.map((t) => (
                          <option key={t.request_type_id} value={t.request_type_id}>
                            ⚙️ {t.name}
                          </option>
                        ))}
                      </select>
                      {(touched.requestTypeId || attemptedNext[2]) && step2Errors.requestTypeId && (
                        <span className="field-error-text">⚠️ {step2Errors.requestTypeId}</span>
                      )}
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
                    <label htmlFor="processDescription">
                      1. ¿Qué proceso administrativo o trámite estabas realizando? *
                    </label>
                    <textarea
                      id="processDescription"
                      name="processDescription"
                      value={form.processDescription}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      rows={3}
                      placeholder='Ej: "Registro de nómina mensual" o "Generación de reporte trimestral de caja"...'
                      required
                      aria-required="true"
                      aria-describedby="desc-count"
                      className={(touched.processDescription || attemptedNext[3]) && step3Errors.processDescription ? 'input-error' : undefined}
                    />
                    <div className="textarea-footer">
                      <span id="desc-count" className={`char-count ${form.processDescription.length >= 10 ? 'is-valid-count' : ''}`}>
                        {form.processDescription.length} / 10 caracteres mín.
                      </span>
                    </div>
                    {(touched.processDescription || attemptedNext[3]) && step3Errors.processDescription && (
                      <span className="field-error-text">⚠️ {step3Errors.processDescription}</span>
                    )}
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
                      onBlur={handleBlur}
                      rows={3}
                      placeholder='Ej: "Al presionar el botón Procesar, aparece un mensaje rojo que dice Error 500"...'
                      required
                      aria-required="true"
                      aria-describedby="current-count"
                      className={(touched.currentBehavior || attemptedNext[3]) && step3Errors.currentBehavior ? 'input-error' : undefined}
                    />
                    <div className="textarea-footer">
                      <span id="current-count" className={`char-count ${form.currentBehavior.length >= 10 ? 'is-valid-count' : ''}`}>
                        {form.currentBehavior.length} / 10 caracteres mín.
                      </span>
                    </div>
                    {(touched.currentBehavior || attemptedNext[3]) && step3Errors.currentBehavior && (
                      <span className="field-error-text">⚠️ {step3Errors.currentBehavior}</span>
                    )}
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
                      onBlur={handleBlur}
                      rows={3}
                      placeholder='Ej: "Debería emitir el comprobante PDF con la firma y actualizar el saldo actual"...'
                      required
                      aria-required="true"
                      aria-describedby="expected-count"
                      className={(touched.expectedBehavior || attemptedNext[3]) && step3Errors.expectedBehavior ? 'input-error' : undefined}
                    />
                    <div className="textarea-footer">
                      <span id="expected-count" className={`char-count ${form.expectedBehavior.length >= 10 ? 'is-valid-count' : ''}`}>
                        {form.expectedBehavior.length} / 10 caracteres mín.
                      </span>
                    </div>
                    {(touched.expectedBehavior || attemptedNext[3]) && step3Errors.expectedBehavior && (
                      <span className="field-error-text">⚠️ {step3Errors.expectedBehavior}</span>
                    )}
                  </div>

                  {/* Zona de Evidencias (Adjuntos) */}
                  {!isEditing && (
                    <div className="evidencias-container">
                      <div className="evidencias-header">
                        <h3>Adjuntar Evidencias (Opcional pero recomendado)</h3>
                        <span className="evidencias-subtitle">Máximo 5 capturas y 5 documentos de soporte (hasta 50 MB por archivo)</span>
                      </div>

                      <div className="upload-paste-tip">
                        💡 <strong>Tip rápido:</strong> Podés pegar capturas directamente con <kbd>Ctrl</kbd> + <kbd>V</kbd> (o <kbd>⌘</kbd> + <kbd>V</kbd>) en esta pantalla.
                      </div>

                      {uploadNotice && (
                        <div className={`upload-notice upload-notice-${uploadNotice.type}`} role="alert">
                          <span className="upload-notice-icon">
                            {uploadNotice.type === 'success' ? '✅' : uploadNotice.type === 'warning' ? '⚠️' : uploadNotice.type === 'info' ? 'ℹ️' : '❌'}
                          </span>
                          <span className="upload-notice-text">{uploadNotice.message}</span>
                          <button
                            type="button"
                            className="upload-notice-close"
                            onClick={() => setUploadNotice(null)}
                            aria-label="Cerrar notificación"
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      <div className="form-row">
                        {/* Dropzone Imagenes */}
                        <div className="form-group">
                          <div className="label-with-badge">
                            <label id="screenshot-label">Capturas de Pantalla (JPG, PNG, WebP)</label>
                            <span className={`upload-count-badge ${screenshots.length >= MAX_SCREENSHOTS ? 'is-max' : ''}`}>
                              {screenshots.length} / {MAX_SCREENSHOTS}
                            </span>
                          </div>
                          <div
                            className={`dropzone ${isDragOverScreenshot ? 'is-dragover' : ''} ${screenshots.length >= MAX_SCREENSHOTS ? 'is-disabled' : ''}`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragOverScreenshot(true);
                            }}
                            onDragLeave={() => setIsDragOverScreenshot(false)}
                            onDrop={handleScreenshotDrop}
                          >
                            <span className="dropzone-icon">🖼️</span>
                            <p className="dropzone-text">
                              Arrastrá imágenes aquí o{' '}
                              <label htmlFor="screenshot-input" className="dropzone-browse">
                                explorá tus archivos
                              </label>
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
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragOverDocument(true);
                            }}
                            onDragLeave={() => setIsDragOverDocument(false)}
                            onDrop={handleDocumentDrop}
                          >
                            <span className="dropzone-icon">📄</span>
                            <p className="dropzone-text">
                              Arrastrá documentos PDF o planillas o{' '}
                              <label htmlFor="document-input" className="dropzone-browse">
                                seleccioná un archivo
                              </label>
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
                      disabled={submitting || convertingCount > 0}
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