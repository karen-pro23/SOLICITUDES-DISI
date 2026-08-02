import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  createRequest,
  getModules,
  getRequestTypes,
  getDepartments,
  getRequest,
  getPublicModules,
  getPublicRequestTypes,
  getPublicDepartments,
  createPublicRequest,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import PublicHeader from '../components/PublicHeader';
import './RequestForm.css';

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
    applicantName: '',
    applicantEmail: '',
    departmentId: '',
    moduleId: '',
    requestTypeId: '',
    priority: 'media',
    processDescription: '',
    currentBehavior: '',
    expectedBehavior: '',
  });
  const [screenshots, setScreenshots] = useState([]);
  const [documents, setDocuments] = useState([]);

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
      getRequest(id).then((data) => {
        const r = data.request;
        setForm({
          applicantName: r.created_by_name || '',
          applicantEmail: '',
          departmentId: r.department_id || '',
          moduleId: r.module_id,
          requestTypeId: r.request_type_id,
          priority: r.priority,
          processDescription: r.process_description,
          currentBehavior: r.current_behavior,
          expectedBehavior: r.expected_behavior,
        });
      }).catch(() => navigate('/'));
    }
  }, [id, isPublic, user, navigate]);

  const isApplicantValid = isPublic
    ? form.applicantName.trim() !== '' &&
      form.applicantEmail.trim() !== '' &&
      Boolean(form.departmentId)
    : true;

  const isValid =
    isApplicantValid &&
    Boolean(form.moduleId) &&
    Boolean(form.requestTypeId) &&
    form.processDescription.trim().length >= 10 &&
    form.currentBehavior.trim().length >= 10 &&
    form.expectedBehavior.trim().length >= 10 &&
    !isEditing;

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid && !isEditing) return;
    setSubmitting(true);
    setError('');

    try {
      const fd = new FormData();
      if (isPublic) {
        fd.append('applicantName', form.applicantName);
        fd.append('applicantEmail', form.applicantEmail);
        fd.append('departmentId', form.departmentId);
      }
      fd.append('moduleId', form.moduleId);
      fd.append('requestTypeId', form.requestTypeId);
      fd.append('priority', form.priority);
      fd.append('processDescription', form.processDescription);
      fd.append('currentBehavior', form.currentBehavior);
      fd.append('expectedBehavior', form.expectedBehavior);

      for (const file of screenshots) fd.append('screenshots', file);
      for (const file of documents) fd.append('documents', file);

      if (isPublic) {
        const result = await createPublicRequest(fd);
        setSubmittedTicket(result.request);
      } else {
        const result = await createRequest(fd);
        navigate(`/requests/${result.request.request_id}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar solicitud');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = !isEditing && isValid && !submitting;

  // Para debug visual
  const validChecks = {
    nombre: isPublic ? form.applicantName.trim().length > 0 : true,
    email: isPublic ? form.applicantEmail.trim().length > 0 : true,
    depto: isPublic ? Boolean(form.departmentId) : true,
    modulo: Boolean(form.moduleId),
    tipo: Boolean(form.requestTypeId),
    descripcion: form.processDescription.trim().length >= 10,
    actual: form.currentBehavior.trim().length >= 10,
    esperado: form.expectedBehavior.trim().length >= 10,
  };

  function handleResetNew() {
    setSubmittedTicket(null);
    setForm({
      applicantName: '',
      applicantEmail: '',
      departmentId: '',
      moduleId: '',
      requestTypeId: '',
      priority: 'media',
      processDescription: '',
      currentBehavior: '',
      expectedBehavior: '',
    });
    setScreenshots([]);
    setDocuments([]);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-bg)' }}>
      {isPublic && <PublicHeader />}

      <div className="request-form-page" style={{ padding: '2rem 1rem' }}>
        {submittedTicket ? (
          <div className="request-form" style={{ textAlign: 'center', padding: '3.5rem 2rem', animation: 'fadeInUp 0.4s ease' }}>
            <div style={{
              width: '72px',
              height: '72px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: 'white',
              fontSize: '2rem',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)'
            }}>
              ✓
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-gray-900)', marginBottom: '0.5rem' }}>
              ¡Solicitud Enviada con Éxito!
            </h1>
            <p style={{ color: 'var(--color-gray-600)', fontSize: '1rem', marginBottom: '1.75rem' }}>
              Tu solicitud ha sido ingresada al sistema y fue asignada al equipo de Desarrollo.
            </p>
            
            <div style={{
              background: 'var(--color-primary-bg)',
              border: '1px solid var(--color-primary-lightest)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.25rem',
              maxWidth: '360px',
              margin: '0 auto 2rem'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-dark)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Código de Ticket
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.25rem' }}>
                {submittedTicket.ticket_code}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleResetNew}>
              Enviar otra solicitud
            </button>
          </div>
        ) : (
          <>
            <div className="page-header" style={{ marginBottom: '1.5rem' }}>
              <div>
                <h1>{isEditing ? 'Editar Solicitud' : 'Nueva Solicitud de Sistema'}</h1>
                <p className="page-subtitle" style={{ margin: 0 }}>
                  {isPublic
                    ? 'Completá este formulario para enviar una solicitud o reporte de error al Departamento de Sistemas.'
                    : 'Ingresá el detalle técnico del ticket.'}
                </p>
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} className="request-form">
              {isPublic && (
                <section className="form-section">
                  <h2>Datos del Solicitante</h2>
                  <p className="section-desc">
                    Identificate para poder ponernos en contacto sobre el estado de tu solicitud.
                  </p>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Nombre Completo *</label>
                      <input
                        type="text"
                        name="applicantName"
                        value={form.applicantName}
                        onChange={handleChange}
                        placeholder="Ej: María González"
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Correo Electrónico *</label>
                      <input
                        type="email"
                        name="applicantEmail"
                        value={form.applicantEmail}
                        onChange={handleChange}
                        placeholder="tu@email.gov"
                        required
                      />
                    </div>
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
                </section>
              )}

              <section className="form-section">
                <h2>Datos de la Solicitud</h2>
                <div className="form-row">
                  <div className="form-group">
                    <label>Módulo afectado *</label>
                    <select name="moduleId" value={form.moduleId} onChange={handleChange} required>
                      <option value="">Seleccionar módulo...</option>
                      {modules.map((m) => (
                        <option key={m.module_id} value={m.module_id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Tipo de solicitud *</label>
                    <select name="requestTypeId" value={form.requestTypeId} onChange={handleChange} required>
                      <option value="">Seleccionar tipo...</option>
                      {types.map((t) => (
                        <option key={t.request_type_id} value={t.request_type_id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Prioridad</label>
                    <select name="priority" value={form.priority} onChange={handleChange}>
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="form-section">
                <h2>Contexto Funcional</h2>
                <p className="section-desc">
                  Explicá el proceso administrativo o contable asociado. Esta información es obligatoria para que el equipo de sistemas entienda el contexto.
                </p>
                <div className="form-group">
                  <label>¿Qué proceso administrativo/contable se está realizando? *</label>
                  <textarea
                    name="processDescription"
                    value={form.processDescription}
                    onChange={handleChange}
                    rows={3}
                    placeholder='Ej: "Cierre de ejercicio fiscal para el pago de orden N° 4500"...'
                    required
                  />
                  <span className="char-count">{form.processDescription.length} caracteres (mín 10)</span>
                </div>
                <div className="form-group">
                  <label>Comportamiento Actual (¿Qué hace el sistema ahora?) *</label>
                  <textarea
                    name="currentBehavior"
                    value={form.currentBehavior}
                    onChange={handleChange}
                    rows={3}
                    placeholder='Ej: "Al intentar aprobar la orden de pago, muestra saldo insuficiente..."'
                    required
                  />
                  <span className="char-count">{form.currentBehavior.length} caracteres (mín 10)</span>
                </div>
                <div className="form-group">
                  <label>Comportamiento Esperado (¿Qué DEBERÍA hacer?) *</label>
                  <textarea
                    name="expectedBehavior"
                    value={form.expectedBehavior}
                    onChange={handleChange}
                    rows={3}
                    placeholder='Ej: "El sistema debe permitir consolidar el saldo de la partida previa..."'
                    required
                  />
                  <span className="char-count">{form.expectedBehavior.length} caracteres (mín 10)</span>
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
                        onChange={(e) => setScreenshots([...e.target.files])}
                      />
                      <span className="file-hint">{screenshots.length} archivo(s) seleccionado(s)</span>
                    </div>
                    <div className="form-group">
                      <label>Documento de Soporte</label>
                      <input
                        type="file"
                        accept=".pdf,.csv,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        multiple
                        onChange={(e) => setDocuments([...e.target.files])}
                      />
                      <span className="file-hint">{documents.length} archivo(s) seleccionado(s)</span>
                    </div>
                  </div>
                </section>
              )}

              <div className="form-validation-hint" style={{
                display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem',
                padding: '0.75rem', background: '#f8fafc', borderRadius: 'var(--radius)',
                border: '1px solid #e2e8f0', fontSize: '0.75rem'
              }}>
                {Object.entries(validChecks).map(([key, val]) => (
                  <span key={key} style={{ color: val ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                    {val ? '✓' : '✗'} {key}
                  </span>
                ))}
                <span style={{ color: canSubmit ? '#10b981' : '#94a3b8', fontWeight: 600 }}>
                  {canSubmit ? '✓ LISTO' : '⏳ faltan campos'}
                </span>
              </div>

              <div className="form-actions">
                {!isPublic && (
                  <button type="button" className="btn btn-outline" onClick={() => navigate(-1)}>
                    Cancelar
                  </button>
                )}
                {isEditing ? (
                  <p className="text-muted">Las solicitudes en estado RECHAZADA se reabren desde el detalle.</p>
                ) : (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!canSubmit}
                    title={!isValid ? 'Completá todos los campos obligatorios' : ''}
                  >
                    {submitting ? 'Enviando...' : 'Enviar Solicitud'}
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
