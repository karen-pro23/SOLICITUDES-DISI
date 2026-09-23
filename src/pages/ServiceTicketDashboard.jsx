import { useState, useEffect, useCallback } from 'react';
import { getServiceTickets, acceptServiceTicket, closeServiceTicket, getServiceTicketStats, getServiceTypes } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './AdminPage.css';

const STATUS_COLORS = {
  PENDIENTE: { bg: '#fef3c7', color: '#92400e', label: 'Pendiente' },
  EN_PROCESO: { bg: '#dbeafe', color: '#1e40af', label: 'En Proceso' },
  CERRADA: { bg: '#dcfce7', color: '#166534', label: 'Cerrada' },
};

export default function ServiceTicketDashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeForm, setCloseForm] = useState({ serviceType: '', closeObservations: '' });
  const [serviceTypes, setServiceTypes] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (search) params.search = search;
      const [data, statsData] = await Promise.all([
        getServiceTickets(params),
        getServiceTicketStats().catch(() => null),
      ]);
      setTickets(data.tickets || []);
      if (statsData) setStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { getServiceTypes().then(setServiceTypes).catch(() => {}); }, []);

  async function handleAccept(ticket) {
    try {
      await acceptServiceTicket(ticket.ticket_id);
      toast.success(`Ticket ${ticket.ticket_code} aceptado`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al aceptar');
    }
  }

  async function handleClose() {
    setSubmitting(true);
    try {
      await closeServiceTicket(selectedTicket.ticket_id, closeForm);
      toast.success(`Ticket ${selectedTicket.ticket_code} cerrado`);
      setShowCloseModal(false);
      setSelectedTicket(null);
      setCloseForm({ serviceType: '', closeObservations: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cerrar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Servicio Técnico</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Gestión de solicitudes de soporte técnico</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total', value: stats.total, color: '#6366f1' },
            { label: 'Pendientes', value: stats.pending, color: '#f59e0b' },
            { label: 'En Proceso', value: stats.in_progress, color: '#3b82f6' },
            { label: 'Cerradas', value: stats.closed, color: '#10b981' },
            { label: 'Satisfechos', value: stats.satisfied, color: '#22c55e' },
            { label: 'Este Mes', value: stats.this_month, color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ticket, nombre..."
          style={{ flex: 1, minWidth: '200px', padding: '0.5rem 0.875rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.8125rem' }} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '0.5rem 2rem 0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.8125rem', background: 'white' }}>
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="EN_PROCESO">En Proceso</option>
          <option value="CERRADA">Cerradas</option>
        </select>
      </div>

      {/* Tickets */}
      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="mgmt-skeleton">{[1,2,3].map(i => <div key={i} className="mgmt-skeleton-card" />)}</div>
        ) : tickets.length === 0 ? (
          <div className="mgmt-empty"><p>No hay solicitudes de servicio técnico</p></div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
              <thead>
                <tr>
                  {['Ticket', 'Solicitante', 'Área', 'Estado', 'Técnico', 'Fecha', 'Acciones'].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => {
                  const st = STATUS_COLORS[t.status] || STATUS_COLORS.PENDIENTE;
                  return (
                    <tr key={t.ticket_id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={tdStyle}><code style={{ fontWeight: 700, color: '#6366f1', fontSize: '0.8125rem' }}>{t.ticket_code}</code></td>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{t.requester_name}</div>
                        <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{t.department_name || ''}</div>
                      </td>
                      <td style={tdStyle}><span className="mgmt-badge mgmt-badge--blue">{t.assigned_area || '-'}</span></td>
                      <td style={tdStyle}><span className="mgmt-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: '0.8125rem' }}>{t.technician_name || <span style={{ color: '#cbd5e1' }}>Sin asignar</span>}</span></td>
                      <td style={tdStyle}><span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{new Date(t.created_at).toLocaleDateString()}</span></td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                          {t.status === 'PENDIENTE' && user.role !== 'requester' && (
                            <button className="btn btn-sm btn-success" onClick={() => handleAccept(t)}>Aceptar</button>
                          )}
                          {t.status === 'EN_PROCESO' && user.role !== 'requester' && (
                            <button className="btn btn-sm btn-primary" onClick={() => { setSelectedTicket(t); setShowCloseModal(true); }}>Cerrar</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Cerrar */}
      {showCloseModal && (
        <div className="modal-overlay" onClick={() => setShowCloseModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Cerrar Ticket {selectedTicket?.ticket_code}</h3>
              <button className="modal-close-btn" onClick={() => setShowCloseModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.375rem' }}>Tipo de Servicio</label>
                <select value={closeForm.serviceType} onChange={e => setCloseForm({...closeForm, serviceType: e.target.value})} style={{ width: '100%', padding: '0.625rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem' }}>
                  <option value="">Seleccionar...</option>
                  {serviceTypes.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.375rem' }}>Observaciones de Cierre</label>
                <textarea value={closeForm.closeObservations} onChange={e => setCloseForm({...closeForm, closeObservations: e.target.value.toLocaleUpperCase()})} rows={4}
                  style={{ width: '100%', padding: '0.625rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical' }}
                  placeholder="Describa la solución aplicada..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowCloseModal(false)} disabled={submitting}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleClose} disabled={submitting}>{submitting ? 'Cerrando...' : 'Cerrar Ticket'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle = { padding: '0.875rem 1rem', fontSize: '0.6875rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', borderBottom: '2px solid #e2e8f0', background: '#f8fafc', whiteSpace: 'nowrap' };
const tdStyle = { padding: '0.875rem 1rem', fontSize: '0.8125rem', verticalAlign: 'middle' };
