import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { getPublicServiceTicket, rateServiceTicket } from '../services/api';
import toast from 'react-hot-toast';
import PublicHeader from '../components/PublicHeader';

export default function ServiceTicketRate() {
  const { code } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searched, setSearched] = useState(false);
  const [rated, setRated] = useState(false);
  const [searchCode, setSearchCode] = useState(code || '');

  function handleSearch(e) {
    e.preventDefault();
    if (!searchCode.trim()) return;
    setLoading(true);
    getPublicServiceTicket(searchCode.trim())
      .then(setTicket)
      .catch(() => { setTicket(null); toast.error('Ticket no encontrado'); })
      .finally(() => { setLoading(false); setSearched(true); });
  }

  function handleRate(satisfaction) {
    rateServiceTicket(ticket.ticket_code, satisfaction)
      .then(() => { setRated(true); toast.success('Gracias por su calificación'); })
      .catch(err => toast.error(err.response?.data?.error || 'Error al calificar'));
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      <PublicHeader />
      <div style={{ maxWidth: '600px', margin: '2rem auto', padding: '0 1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>Calificar Servicio Técnico</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Ingrese su número de ticket para calificar el servicio recibido</p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input type="text" value={searchCode} onChange={e => setSearchCode(e.target.value.toUpperCase())} placeholder="ST-2026-0001"
            style={{ flex: 1, padding: '0.625rem 1rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9375rem' }} />
          <button type="submit" className="btn btn-primary" disabled={loading}>Buscar</button>
        </form>

        {ticket && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <div style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Ticket</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#6366f1' }}>{ticket.ticket_code}</div>
              </div>
              <span style={{ padding: '0.375rem 0.75rem', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 600, background: ticket.status === 'CERRADA' ? '#dcfce7' : '#fef3c7', color: ticket.status === 'CERRADA' ? '#166534' : '#92400e' }}>
                {ticket.status}
              </span>
            </div>

            <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              <div><strong>Solicitante:</strong> {ticket.requester_name}</div>
              <div><strong>Descripción:</strong> {ticket.description}</div>
              {ticket.technician_name && <div><strong>Técnico:</strong> {ticket.technician_name}</div>}
              {ticket.close_observations && <div><strong>Solución:</strong> {ticket.close_close_observations}</div>}
            </div>

            {ticket.status === 'CERRADA' && !rated && !ticket.satisfaction && (
              <div style={{ textAlign: 'center', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
                <p style={{ fontWeight: 600, color: '#334155', marginBottom: '1rem' }}>¿Cómo fue el servicio recibido?</p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button onClick={() => handleRate('satisfecho')} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: '2px solid #dcfce7', background: '#f0fdf4', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, color: '#166534', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; e.currentTarget.style.transform = 'none'; }}>
                    😊 Satisfecho
                  </button>
                  <button onClick={() => handleRate('no_satisfecho')} style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', border: '2px solid #fecaca', background: '#fef2f2', cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, color: '#991b1b', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fecaca'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.transform = 'none'; }}>
                    😞 No Satisfecho
                  </button>
                </div>
              </div>
            )}

            {(ticket.satisfaction || rated) && (
              <div style={{ textAlign: 'center', padding: '1.5rem', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{ticket.satisfaction === 'satisfecho' ? '😊' : '😞'}</div>
                <p style={{ fontWeight: 600, color: '#166534' }}>Gracias por su calificación</p>
              </div>
            )}
          </div>
        )}

        {searched && !ticket && (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <p>No se encontró el ticket. Verifique el número e intente de nuevo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
