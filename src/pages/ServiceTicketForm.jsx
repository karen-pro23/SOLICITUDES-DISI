import { useState, useEffect, useRef, useMemo } from 'react';
import CreatableSelect from 'react-select/creatable';
import {
  Check,
  AlertTriangle,
  User,
  FileText,
  FileSpreadsheet,
  Image,
  Zap,
  Loader2,
  Send,
  X,
  Copy,
} from 'lucide-react';
import {
  getPersona,
  getPublicDepartments,
  getPublicCargos,
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

const MAX_CARGO_LENGTH = 120;

// Caracteres NO admitidos en un nombre de cargo.
//
// Los dígitos y la puntuación común son VÁLIDOS en cargos reales del sistema:
// "DIRECTOR DE TI. 2", "COORDINADOR (S)", "SUB-DIRECTOR", "ANALISTA 1".
// Una versión anterior de este filtro usaba la clase [^A-ZÁÉÍÓÚÑÜ\s], que
// BORRABA los dígitos y los signos: "INGENIERO 3" se consolidaba como
// "INGENIERO" y "DIRECTOR DE TI. 2" como "DIRECTOR DE TI". Como el saneador
// también corría sobre valores que YA venían del catálogo, elegir un cargo
// existente con dígitos creaba una fila nueva mutilada en `cargos` y
// repuntaba persona.cargo_id a esa versión rota.
//
// La clase vive acá una sola vez a propósito: antes estaba duplicada en dos
// funciones con setas distintas, que es exactamente la forma en que este bug
// se coló.
const CARGO_UNSUPPORTED = /[^A-ZÁÉÍÓÚÑÜ0-9.,\-()/&\s´¨]/g;

// Se permiten transitoriamente los acentos muertos (´, ¨) para teclados físicos.
function stripUnsupportedCargoChars(val) {
  return val.replace(CARGO_UNSUPPORTED, '');
}

// Filtra en tiempo real, mientras se escribe.
function sanitizeCargoInput(val) {
  if (!val) return '';
  return val
    .normalize('NFC')
    .toUpperCase()
    .replace(CARGO_UNSUPPORTED, '');
}

// Limpia acentos muertos sueltos y espacios repetidos al consolidar el valor
function cleanFinalCargo(val) {
  if (!val) return '';
  return stripUnsupportedCargoChars(val.normalize('NFC').toUpperCase())
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CARGO_LENGTH);
}

// Un valor que ya existe en el catálogo no se sanea NUNCA: es dato nuestro, no
// input del usuario, y volverlo a filtrar corrompe nombres legítimos.
// Solo el texto tipeado a mano pasa por cleanFinalCargo.
function resolveSelectedCargo(selectedValue, catalog) {
  const raw = String(selectedValue || '').trim();
  if (!raw) return '';
  const match = (catalog || []).find(
    (c) => String(c.name || '').trim().toUpperCase() === raw.toUpperCase()
  );
  return match ? String(match.name) : cleanFinalCargo(raw);
}


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
    description: '',
    observations: '',
  });

  const [departments, setDepartments] = useState([]);
  const [cargos, setCargos] = useState([]);
  const [cargosLoaded, setCargosLoaded] = useState(false);
  // El cargo seleccionado o creado vive en `cargoValue`.
  const [cargoValue, setCargoValue] = useState('');
  const [cargoInputValue, setCargoInputValue] = useState('');
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
  const [personaError, setPersonaError] = useState('');

  // Uploads
  const [screenshots, setScreenshots] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [convertingCount, setConvertingCount] = useState(0);
  const liveUrlsRef = useRef(new Set());
  const lastFetchedCedulaRef = useRef('');
  const [uploadNotice, setUploadNotice] = useState(null);
  const [isDragOverScreenshot, setIsDragOverScreenshot] = useState(false);
  const [isDragOverDocument, setIsDragOverDocument] = useState(false);

  // Modals
  const [pdfPreviewModal, setPdfPreviewModal] = useState(null);
  const [imagePreviewModal, setImagePreviewModal] = useState(null);

  // ── Load data on mount ──────────────────────────────
  useEffect(() => {
    getPublicDepartments().then(setDepartments).catch(() => {});
    getPublicCargos()
      .then(setCargos)
      .catch(() => {})
      .finally(() => setCargosLoaded(true));
    return () => {
      liveUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      liveUrlsRef.current.clear();
    };
  }, []);

  // ── Cargo: valor derivado y opciones para CreatableSelect ──
  const position = cargoValue;

  const cargoOptions = useMemo(() => {
    const opts = (cargos || []).map((c) => ({
      value: (c.name || '').toUpperCase(),
      label: (c.name || '').toUpperCase(),
    }));
    if (
      cargoValue &&
      !opts.some((o) => o.value === cargoValue.trim().toUpperCase())
    ) {
      const val = cleanFinalCargo(cargoValue);
      if (val) opts.unshift({ value: val, label: val });
    }
    return opts;
  }, [cargos, cargoValue]);

  // ── Paste handler for screenshots ───────────────────
  useEffect(() => {
    if (currentStep !== 2) return;

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
    // El cargo es OBLIGATORIO:
    if (!cargoValue || !cargoValue.trim()) {
      errs.position = 'Por favor seleccione o escriba su cargo institucional.';
    } else if (cargoValue.trim().length > MAX_CARGO_LENGTH) {
      errs.position = `El cargo no puede superar los ${MAX_CARGO_LENGTH} caracteres.`;
    }
    return errs;
  };

  const getStep2ErrorsMap = () => {
    const errs = {};
    const dLen = form.description.trim().length;
    if (dLen < 10) errs.description = `Describí el problema o requerimiento técnico (te faltan ${10 - dLen} caracteres para llegar al mínimo de 10).`;
    return errs;
  };

  const step1Errors = getStep1ErrorsMap();
  const step2Errors = getStep2ErrorsMap();
  const isStep1Valid = Object.keys(step1Errors).length === 0;
  const isStep2Valid = Object.keys(step2Errors).length === 0;
  const isValid = isStep1Valid && isStep2Valid;

  // ── Handlers ────────────────────────────────────────
  function handleChange(e) {
    const { name, value } = e.target;
    if (name === 'cedula') {
      const trimmed = value.trim().toUpperCase();
      if (trimmed !== lastFetchedCedulaRef.current) {
        setPersonaFound(false);
      }
    }
    setForm((prev) => ({ ...prev, [name]: value.toLocaleUpperCase() }));
  }

  async function handleCedulaBlur(e) {
    const cedula = e.target.value.trim().toUpperCase();
    if (!cedula) return;
    const cleanCedula = cedula.replace(/^V-?|^E-?/i, '');
    const cleanLastFetched = lastFetchedCedulaRef.current.replace(/^V-?|^E-?/i, '');
    // Si la cédula ya fue consultada y está verificada, no volver a consultar ni sobreescribir lo modificado por el usuario
    if (cleanCedula && cleanCedula === cleanLastFetched && personaFound) return;

    setPersonaLoading(true);
    setPersonaError('');
    try {
      const persona = await getPersona(cedula);
      if (persona) {
        lastFetchedCedulaRef.current = cedula;
        setForm((prev) => {
          let deptId = prev.departmentId;
          let deptName = prev.departmentName;
          if (!deptId && (persona.department_id || persona.department_name)) {
            const matched = departments.find(
              (d) =>
                (persona.department_id && String(d.department_id) === String(persona.department_id)) ||
                (persona.department_name && d.name.toUpperCase() === persona.department_name.toUpperCase())
            );
            if (matched) {
              deptId = String(matched.department_id);
              deptName = matched.name;
            }
          }
          return {
            ...prev,
            cedula: persona.cedula || cedula,
            nombre: persona.nombre || '',
            apellido: persona.apellido || '',
            email: persona.email || prev.email,
            departmentId: deptId,
            departmentName: deptName,
          };
        });
        if (persona.position) {
          setCargoValue(resolveSelectedCargo(persona.position, cargos));
        }
        setPersonaFound(true);
      } else {
        lastFetchedCedulaRef.current = cedula;
        setForm((prev) => ({ ...prev, cedula, nombre: '', apellido: '' }));
        setPersonaFound(false);
      }
    } catch {
      setForm((prev) => ({ ...prev, cedula }));
      setPersonaError('No se pudo consultar la cédula. Escribí tu nombre y apellido.');
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

  const handleCargoInputChange = (newValue, actionMeta) => {
    if (actionMeta.action === 'input-change') {
      const sanitized = sanitizeCargoInput(newValue);
      setCargoInputValue(sanitized);
    } else if (
      actionMeta.action === 'set-value' ||
      actionMeta.action === 'menu-close'
    ) {
      setCargoInputValue('');
    }
  };

  function handleCreateCargo(inputValue) {
    const cleaned = cleanFinalCargo(inputValue);
    if (!cleaned) return;
    setCargos((prev) => {
      if (prev.some((c) => c.name.toUpperCase() === cleaned)) {
        return prev;
      }
      return [{ cargo_id: `custom_${Date.now()}`, name: cleaned }, ...prev];
    });
    setCargoValue(cleaned);
    setCargoInputValue('');
  }

  const handleCargoBlur = () => {
    setTouched((prev) => ({ ...prev, position: true }));
    if (cargoInputValue && cargoInputValue.trim()) {
      handleCreateCargo(cargoInputValue);
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    if (name) setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleStepTabClick = (targetStep) => {
    if (targetStep === 1) { setCurrentStep(1); return; }
    if (targetStep === 2) {
      if (cargoInputValue && cargoInputValue.trim()) {
        handleCreateCargo(cargoInputValue);
      }
      if (!isStep1Valid) {
        setAttemptedNext((prev) => ({ ...prev, 1: true }));
        setTouched((prev) => ({ ...prev, cedula: true, nombre: true, apellido: true, email: true, departmentId: true, position: true }));
        return;
      }
      setCurrentStep(2);
    }
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (cargoInputValue && cargoInputValue.trim()) {
        handleCreateCargo(cargoInputValue);
      }
      if (!isStep1Valid) {
        setAttemptedNext((prev) => ({ ...prev, 1: true }));
        setTouched((prev) => ({ ...prev, cedula: true, nombre: true, apellido: true, email: true, departmentId: true, position: true }));
        return;
      }
      setCurrentStep(2);
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

    if (cargoInputValue && cargoInputValue.trim()) {
      handleCreateCargo(cargoInputValue);
    }

    if (!isStep1Valid) {
      setCurrentStep(1);
      setAttemptedNext((prev) => ({ ...prev, 1: true }));
      setTouched((prev) => ({ ...prev, cedula: true, nombre: true, apellido: true, email: true, departmentId: true, position: true }));
      return;
    }
    if (!isStep2Valid) {
      setAttemptedNext((prev) => ({ ...prev, 2: true }));
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
        // El backend y el PDF esperan el cargo con la clave `position`.
        position: cargoValue ? cargoValue.trim() : null,
        extension: form.extension,
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
      extension: '', description: '', observations: '',
    });
    // El cargo se reinicia acá también: un cargo que sobreviva al reset
    // atribuiría al siguiente solicitante el cargo del anterior.
    setCargoValue('');
    setCargoInputValue('');
    lastFetchedCedulaRef.current = '';
    setPersonaFound(false);
    setPersonaError('');
    setScreenshots([]);
    setDocuments([]);
    setTouched({});
    setAttemptedNext({});
  }

  const canSubmit = isValid && !submitting;
  const hasCargoError = Boolean((touched.position || attemptedNext[1]) && step1Errors.position);

  const creatableSelectStyles = useMemo(
    () => ({
      control: (base, state) => ({
        ...base,
        minHeight: '44px',
        borderRadius: '0.5rem',
        borderColor: hasCargoError
          ? '#ef4444'
          : state.isFocused
          ? '#2563eb'
          : '#cbd5e1',
        boxShadow: state.isFocused
          ? '0 0 0 3px rgba(37, 99, 235, 0.15)'
          : '0 1px 2px rgba(0, 0, 0, 0.04)',
        fontSize: '0.875rem',
        backgroundColor: '#ffffff',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: hasCargoError ? '#ef4444' : state.isFocused ? '#2563eb' : '#94a3b8',
        },
      }),
      valueContainer: (base) => ({
        ...base,
        padding: '0.25rem 0.75rem',
      }),
      input: (base) => ({
        ...base,
        color: '#0f172a',
        margin: 0,
        padding: 0,
        textTransform: 'uppercase',
      }),
      placeholder: (base) => ({
        ...base,
        color: '#94a3b8',
        fontSize: '0.875rem',
      }),
      singleValue: (base) => ({
        ...base,
        color: '#0f172a',
        fontSize: '0.875rem',
        fontWeight: 500,
        textTransform: 'uppercase',
      }),
      menu: (base) => ({
        ...base,
        borderRadius: '0.5rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
        border: '1px solid #e2e8f0',
        zIndex: 50,
      }),
      menuList: (base) => ({
        ...base,
        padding: '0.25rem',
        maxHeight: '220px',
      }),
      option: (base, state) => ({
        ...base,
        borderRadius: '0.375rem',
        margin: '2px 0',
        padding: '0.5rem 0.75rem',
        fontSize: '0.875rem',
        textTransform: 'uppercase',
        backgroundColor: state.isSelected
          ? '#2563eb'
          : state.isFocused
          ? '#eff6ff'
          : 'transparent',
        color: state.isSelected ? '#ffffff' : state.isFocused ? '#1e40af' : '#1e293b',
        cursor: 'pointer',
        '&:active': {
          backgroundColor: '#3b82f6',
          color: '#ffffff',
        },
      }),
      clearIndicator: (base) => ({
        ...base,
        cursor: 'pointer',
        color: '#94a3b8',
        '&:hover': { color: '#64748b' },
      }),
      dropdownIndicator: (base) => ({
        ...base,
        cursor: 'pointer',
        color: '#94a3b8',
        '&:hover': { color: '#64748b' },
      }),
      indicatorSeparator: (base) => ({
        ...base,
        backgroundColor: '#e2e8f0',
      }),
    }),
    [hasCargoError]
  );

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
                  <><Check size={14} /> Copiado al portapapeles</>
                ) : (
                  <>
                    <Copy size={14} />
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
                  Completá los 2 pasos a continuación para registrar tu solicitud de soporte técnico.
                </p>
              </div>
            </header>

            {/* ── STEPPER ─────────────────────────────── */}
            <nav className="stepper-nav" aria-label="Pasos de la solicitud">
              <div className="stepper-progress-bar-bg">
                <div
                  className="stepper-progress-bar-fill"
                  style={{ width: `${((currentStep - 1) / 1) * 100}%` }}
                />
              </div>

              <button
                type="button"
                className={`step-tab ${currentStep === 1 ? 'is-active' : ''} ${isStep1Valid ? 'is-completed' : ''}`}
                onClick={() => handleStepTabClick(1)}
                aria-current={currentStep === 1 ? 'step' : undefined}
              >
                <div className="step-badge">{isStep1Valid ? <Check size={14} strokeWidth={3} /> : '1'}</div>
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
                <div className="step-badge">{isStep2Valid ? <Check size={14} strokeWidth={3} /> : '2'}</div>
                <div className="step-label">
                  <span className="step-title">2. Detalle del Problema</span>
                  <span className="step-sub">Descripción y evidencias</span>
                </div>
              </button>
            </nav>

            {error && (
              <div className="alert alert-error" role="alert">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                  <AlertTriangle size={15} /> {error}
                </span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="request-form" noValidate>
              {/* ═══ PASO 1: DATOS DEL SOLICITANTE ═══ */}
              {currentStep === 1 && (
                <section className="form-section fade-in-step" aria-labelledby="step1-heading">
                  <h2 id="step1-heading">
                    <span className="section-icon"><User size={18} /></span> Datos del Solicitante
                  </h2>
                  <p className="section-desc">
                    Identificate con tu Cédula de Identidad para verificar tus datos institucionales.
                  </p>

                  {attemptedNext[1] && !isStep1Valid && (
                    <div className="validation-error-alert" role="alert">
                      <div className="validation-alert-header">
                        <span className="validation-alert-icon"><AlertTriangle size={16} /></span>
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
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCedulaBlur(e);
                            }
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
                              <span className="spinner-icon"><Loader2 size={13} className="spin-icon" /></span> Buscando...
                            </span>
                          )}
                          {!personaLoading && personaFound && (
                            <span className="persona-badge persona-badge-found" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Check size={12} strokeWidth={2.5} /> Verificada
                            </span>
                          )}
                          {!personaLoading && !personaFound && form.cedula.trim() !== '' && !personaError && (
                            <span className="persona-badge persona-badge-new">Nueva Persona</span>
                          )}
                          {!personaLoading && personaError && (
                            <span className="field-error-text"><AlertTriangle size={13} /> {personaError}</span>
                          )}
                        </div>
                      </div>
                      {(touched.cedula || attemptedNext[1]) && step1Errors.cedula && (
                        <span className="field-error-text"><AlertTriangle size={13} /> {step1Errors.cedula}</span>
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
                        <span className="field-error-text"><AlertTriangle size={13} /> {step1Errors.nombre}</span>
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
                        <span className="field-error-text"><AlertTriangle size={13} /> {step1Errors.apellido}</span>
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
                        <span className="field-error-text"><AlertTriangle size={13} /> {step1Errors.email}</span>
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
                        <span className="field-error-text"><AlertTriangle size={13} /> {step1Errors.departmentId}</span>
                      )}
                    </div>
                    <div className="form-group">
                      <label htmlFor="position">Cargo *</label>
                      <CreatableSelect
                        id="position"
                        inputId="position"
                        name="position"
                        isClearable
                        isSearchable
                        isLoading={!cargosLoaded}
                        placeholder="-- SELECCIONAR O ESCRIBIR CARGO * --"
                        inputValue={cargoInputValue}
                        onInputChange={handleCargoInputChange}
                        noOptionsMessage={({ inputValue }) =>
                          inputValue
                            ? `No se encontró "${inputValue.toUpperCase()}"`
                            : 'No hay cargos disponibles'
                        }
                        formatCreateLabel={(inputValue) => `Crear cargo "${cleanFinalCargo(inputValue)}"`}
                        options={cargoOptions}
                        value={
                          cargoValue
                            ? { value: cargoValue.toUpperCase(), label: cargoValue.toUpperCase() }
                            : null
                        }
                        onChange={(selected) => {
                          setCargoValue(resolveSelectedCargo(selected && selected.value, cargos));
                          setCargoInputValue('');
                        }}
                        onCreateOption={handleCreateCargo}
                        onBlur={handleCargoBlur}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && cargoInputValue && cargoInputValue.trim()) {
                            e.preventDefault();
                            handleCreateCargo(cargoInputValue);
                          }
                        }}
                        createOptionPosition="first"
                        styles={creatableSelectStyles}
                        aria-label="Cargo institucional *"
                        aria-required="true"
                        required
                      />
                      {hasCargoError && (
                        <span className="field-error-text"><AlertTriangle size={13} /> {step1Errors.position}</span>
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

              {/* ═══ PASO 2: DETALLE DEL PROBLEMA Y EVIDENCIAS ═══ */}
              {currentStep === 2 && (
                <section className="form-section fade-in-step" aria-labelledby="step2-heading">
                  <h2 id="step2-heading">
                    <span className="section-icon"><FileText size={18} /></span> Detalle del Problema y Evidencias
                  </h2>
                  <p className="section-desc">
                    Describí el problema o requerimiento técnico para que nuestro equipo pueda asistirte rápidamente.
                  </p>

                  {attemptedNext[2] && !isStep2Valid && (
                    <div className="validation-error-alert" role="alert">
                      <div className="validation-alert-header">
                        <span className="validation-alert-icon"><AlertTriangle size={16} /></span>
                        <strong>Para finalizar la solicitud, completá los detalles obligatorios:</strong>
                      </div>
                      <ul className="validation-alert-list">
                        {Object.values(step2Errors).map((msg, idx) => (
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
                      className={(touched.description || attemptedNext[2]) && step2Errors.description ? 'input-error' : undefined}
                    />
                    <div className="textarea-footer">
                      <span id="desc-count" className={`char-count ${form.description.length >= 10 ? 'is-valid-count' : ''}`}>
                        {form.description.length} / 10 caracteres mín.
                      </span>
                    </div>
                    {(touched.description || attemptedNext[2]) && step2Errors.description && (
                      <span className="field-error-text"><AlertTriangle size={13} /> {step2Errors.description}</span>
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
                        <button type="button" className="upload-notice-close" onClick={() => setUploadNotice(null)} aria-label="Cerrar notificación"><X size={14} /></button>
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
                          <span className="dropzone-icon"><Image size={36} strokeWidth={1.5} /></span>
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
                          <span className="file-hint converting-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Zap size={14} /> Optimizando imágenes a WebP...
                          </span>
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
                                ><X size={14} /></button>
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
                          <span className="dropzone-icon"><FileText size={36} strokeWidth={1.5} /></span>
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
                                    {item.type === 'application/pdf' || item.name.endsWith('.pdf') ? <FileText size={18} /> : <FileSpreadsheet size={18} />}
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
                                  ><X size={14} /></button>
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
                      ← Volver a Datos del Solicitante
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary btn-submit-lg"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      disabled={submitting || convertingCount > 0}
                    >
                      {submitting ? (
                        <><Loader2 size={16} className="spin-icon" /> Guardando Solicitud...</>
                      ) : (
                        <><Send size={16} /> Enviar Solicitud Ahora</>
                      )}
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
