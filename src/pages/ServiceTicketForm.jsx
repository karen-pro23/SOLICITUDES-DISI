import { useState } from 'react';
import { createServiceTicket } from '../services/api';
import toast from 'react-hot-toast';
import PublicHeader from '../components/PublicHeader';

export default function ServiceTicketForm() {
  const [form, setForm] = useState({
    requesterName: '', requesterCedula: '', requesterPosition: '',
    departmentName: '', extension: '', description: '',
    assignedArea: '', observations: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  const AREAS = ['SOPORTE', 'REDES', 'TELEFONÍA', 'HARDWARE', 'SOFTWARE'];

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    createServiceTicket(form)
      .then(ticket => {
        setCreated(ticket);
        toast.success('Solicitud creada con éxito');
      })
      .catch(err => toast.error(err.response?.data?.error || 'Error al crear'))
      .finally(() => setSubmitting(false));
  }

  if (created) {
    return (
      <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
        <PublicHeader />
        <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '2.5rem', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Solicitud Registrada</h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Guarde su número de ticket para dar seguimiento</p>
            <div style={{ background: '#f0f9ff', border: '2px solid #0ea5e9', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Su número de ticket</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0369a1', fontVariantNumeric: 'tabular-nums', marginTop: '0.25rem' }}>{created.ticket_code}</div>
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>Puede consultar el estado en <strong>/buscar</strong> con su número de ticket</p>
            <button className="btn btn-primary" onClick={() => setCreated(null)} style={{ marginTop: '1rem' }}>Crear otra solicitud</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <PublicHeader />
      <div style={{ maxWidth: '700px', margin: '2rem auto', padding: '0 1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>Solicitud de Servicio Técnico</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Complete el formulario para registrar su solicitud de soporte técnico</p>

        <form onSubmit={handleSubmit} style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Datos del Solicitante</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={labelStyle}>Nombre completo *</label>
              <input value={form.requesterName} onChange={e => setForm({...form, requesterName: e.target.value.toLocaleUpperCase()})} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cédula</label>
              <input value={form.requesterCedula} onChange={e => setForm({...form, requesterCedula: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cargo</label>
              <input value={form.requesterPosition} onChange={e => setForm({...form, requesterPosition: e.target.value.toLocaleUpperCase()})} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Dependencia</label>
              <input value={form.departmentName} onChange={e => setForm({...form, departmentName: e.target.value.toLocaleUpperCase()})} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Extensión</label>
              <input value={form.extension} onChange={e => setForm({...form, extension: e.target.value})} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Área Asignada</label>
              <select value={form.assignedArea} onChange={e => setForm({...form, assignedArea: e.target.value})} style={inputStyle}>
                <option value="">Seleccionar...</option>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Descripción del Requerimiento</h3>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Descripción *</label>
            <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value.toLocaleUpperCase()})} rows={4} required style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Describa el problema o requerimiento técnico..." />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Observaciones</label>
            <textarea value={form.observations} onChange={e => setForm({...form, observations: e.target.value.toLocaleUpperCase()})} rows={3} style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Información adicional..." />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', padding: '0.75rem', fontSize: '0.9375rem' }}>
            {submitting ? 'Registrando...' : 'Registrar Solicitud'}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { fontWeight: 600, fontSize: '0.75rem', color: '#475569', marginBottom: '0.375rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.03em' };
const inputStyle = { width: '100%', padding: '0.625rem 0.875rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', fontFamily: 'inherit', boxSizing: 'border-box' };
