import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getServiceTickets, acceptServiceTicket, assignServiceTicket, closeServiceTicket, getServiceTicketStats, getServiceTypes, getUsersByDepartment } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import './AdminPage.css';

const STATUS_COLORS = {
  PENDIENTE: { bg: '#fef3c7', color: '#92400e', label: 'Pendiente' },
  ASIGNADA: { bg: '#dbeafe', color: '#1e40af', label: 'Asignada' },
  EN_PROCESO: { bg: '#e0e7ff', color: '#4338ca', label: 'En Proceso' },
  COMPLETADA: { bg: '#dcfce7', color: '#166534', label: 'Completada' },
};

const SERVICE_TYPES = [
  'INST/ACTUAL DE PROGRAMAS',
  'ADMON/SOPORTE CENTRAL TELEFÓNICA',
  'INST/REV/REP HARDWARE',
  'CHEQUEO/MTTO/REP DE PC',
  'INST/REP/MTTO DE TELEFONÍA',
  'OTROS',
  'VERIF. DE CONEXIÓN A RED',
  'INST/REP/MTTO DE PUNTO DE RED',
];

export default function ServiceTicketDashboard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [closeForm, setCloseForm] = useState({ serviceType: '', closeObservations: '' });
  const [closeFiles, setCloseFiles] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState('list'); // list | stats

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

  useEffect(() => {
    if (showAssignModal) {
      import('../services/api').then(api => {
        api.getUsersByDepartment(user.departmentId || 13).then(setTechnicians).catch(() => {});
      });
    }
  }, [showAssignModal, user]);

  async function handleAccept(ticket) {
    try {
      await acceptServiceTicket(ticket.request_id);
      toast.success(`Ticket ${ticket.ticket_code} aceptado`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al aceptar');
    }
  }

  async function handleAssign() {
    if (!selectedTechnician) return;
    setSubmitting(true);
    try {
      await assignServiceTicket(selectedTicket.request_id, selectedTechnician);
      toast.success(`Ticket ${selectedTicket.ticket_code} asignado`);
      setShowAssignModal(false);
      setSelectedTicket(null);
      setSelectedTechnician('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al asignar');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose() {
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('serviceType', closeForm.serviceType);
      formData.append('closeObservations', closeForm.closeObservations);
      for (const file of closeFiles) {
        formData.append('files', file);
      }
      await closeServiceTicket(selectedTicket.request_id, formData);
      toast.success(`Ticket ${selectedTicket.ticket_code} cerrado`);
      setShowCloseModal(false);
      setSelectedTicket(null);
      setCloseForm({ serviceType: '', closeObservations: '' });
      setCloseFiles([]);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al cerrar');
    } finally {
      setSubmitting(false);
    }
  }

  function calcResponseTime(ticket) {
    if (!ticket.service_start_time) return '-';
    const start = new Date(ticket.service_start_time);
    const end = ticket.service_close_time ? new Date(ticket.service_close_time) : new Date();
    const mins = Math.round((end - start) / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  }

  return (
    <div className="admin-page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Servicio Técnico</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Gestión de solicitudes de soporte técnico</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('list')} style={{ fontSize: '0.8125rem' }}>
            📋 Lista
          </button>
          <button className={`btn ${view === 'stats' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('stats')} style={{ fontSize: '0.8125rem' }}>
            📊 Estadísticas
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total', value: stats.total, color: '#6366f1' },
            { label: 'Pendientes', value: stats.pending, color: '#f59e0b' },
            { label: 'Asignadas', value: stats.assigned, color: '#3b82f6' },
            { label: 'En Proceso', value: stats.in_progress, color: '#8b5cf6' },
            { label: 'Cerradas', value: stats.closed, color: '#10b981' },
            { label: 'Satisfechos', value: stats.satisfied, color: '#22c55e' },
            { label: 'No Satisfechos', value: stats.unsatisfied, color: '#ef4444' },
            { label: 'Este Mes', value: stats.this_month, color: '#0891b2' },
          ].map(s => (
            <div key={s.label} style={{ background: 'white', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>{s.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Vista de Estadísticas */}
      {view === 'stats' && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Por Tipo de Servicio */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Por Tipo de Servicio</h3>
            {SERVICE_TYPES.map(st => {
              const count = tickets.filter(t => t.service_type === st).length;
              return (
                <div key={st} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#475569' }}>{st}</span>
                  <span style={{ fontWeight: 600, color: '#6366f1' }}>{count}</span>
                </div>
              );
            })}
          </div>

          {/* Satisfacción */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Satisfacción</h3>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '1rem', background: '#f0fdf4', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#166534' }}>{stats.satisfied}</div>
                <div style={{ fontSize: '0.75rem', color: '#166534' }}>😊 Satisfechos</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '1rem', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#991b1b' }}>{stats.unsatisfied}</div>
                <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>😞 No Satisfechos</div>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: '0.8125rem', color: '#64748b' }}>
              Tasa de satisfacción: <strong style={{ color: stats.total > 0 ? '#166534' : '#94a3b8' }}>
                {stats.total > 0 ? Math.round((parseInt(stats.satisfied) / (parseInt(stats.satisfied) + parseInt(stats.unsatisfied) || 1)) * 100) : 0}%
              </strong>
            </div>
          </div>

          {/* Tiempo Promedio */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a', marginBottom: '1rem' }}>Tiempo de Respuesta</h3>
            {tickets.filter(t => t.service_start_time && t.service_close_time).length > 0 ? (
              <div>
                {tickets.filter(t => t.service_start_time && t.service_close_time).slice(0, 5).map(t => (
                  <div key={t.request_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.375rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.8125rem' }}>
                    <span style={{ color: '#475569' }}>{t.ticket_code}</span>
                    <span style={{ fontWeight: 600, color: '#6366f1' }}>{calcResponseTime(t)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontSize: '0.8125rem', textAlign: 'center' }}>Sin datos de tiempo aún</p>
            )}
          </div>
        </div>
      )}

      {/* Vista de Lista */}
      {view === 'list' && (
        <>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ticket, nombre..."
              style={{ flex: 1, minWidth: '200px', padding: '0.5rem 0.875rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.8125rem' }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '0.5rem 2rem 0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '0.8125rem', background: 'white' }}>
              <option value="">Todos los estados</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="ASIGNADA">Asignadas</option>
              <option value="EN_PROCESO">En Proceso</option>
              <option value="COMPLETADA">Completadas</option>
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
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
                  <thead>
                    <tr>
                      {['Ticket', 'Solicitante', 'Ext.', 'Estado', 'Técnico', 'Tiempo', 'Prioridad', 'Acciones'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map(t => {
                      const st = STATUS_COLORS[t.status] || STATUS_COLORS.PENDIENTE;
                      return (
                        <tr key={t.request_id} style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <td style={tdStyle}>
                            <Link to={`/requests/${t.request_id}`} style={{ fontWeight: 700, color: '#6366f1', fontSize: '0.8125rem', textDecoration: 'none' }}>
                              {t.ticket_code}
                            </Link>
                          </td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{t.requester_name || t.created_by_name}</div>
                            <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{t.department_name || ''}</div>
                          </td>
                          <td style={tdStyle}><code style={{ fontSize: '0.75rem', color: '#6366f1', background: '#eef2ff', padding: '0.1rem 0.375rem', borderRadius: '4px' }}>{t.extension || '-'}</code></td>
                          <td style={tdStyle}><span className="mgmt-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                          <td style={tdStyle}><span style={{ fontSize: '0.8125rem' }}>{t.technician_name || <span style={{ color: '#cbd5e1' }}>Sin asignar</span>}</span></td>
                          <td style={tdStyle}><span style={{ fontSize: '0.75rem', color: '#64748b' }}>{calcResponseTime(t)}</span></td>
                          <td style={tdStyle}>
                            <span className={`priority-pill priority-${t.priority}`} style={{ fontSize: '0.6875rem', padding: '0.15rem 0.5rem' }}>
                              {t.priority}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {t.status === 'PENDIENTE' && (
                                <>
                                  {(user.role === 'super_admin' || user.role === 'jefe_st') && (
                                    <button className="btn btn-sm btn-outline" onClick={() => { setSelectedTicket(t); setShowAssignModal(true); }}>Asignar</button>
                                  )}
                                  {user.role !== 'requester' && (
                                    <button className="btn btn-sm btn-success" onClick={() => handleAccept(t)}>Aceptar</button>
                                  )}
                                </>
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
        </>
      )}

      {/* Modal Asignar */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Asignar Técnico — {selectedTicket?.ticket_code}</h3>
              <button className="modal-close-btn" onClick={() => setShowAssignModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <label style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.375rem' }}>Seleccionar Técnico</label>
              <select value={selectedTechnician} onChange={e => setSelectedTechnician(e.target.value)}
                style={{ width: '100%', padding: '0.625rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem' }}>
                <option value="">Seleccionar...</option>
                {technicians.filter(t => t.role === 'tecnico' || t.role === 'developer').map(t => (
                  <option key={t.user_id} value={t.user_id}>{t.full_name}</option>
                ))}
              </select>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowAssignModal(false)} disabled={submitting}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={submitting || !selectedTechnician}>
                {submitting ? 'Asignando...' : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {SERVICE_TYPES.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.375rem' }}>Observaciones de Cierre</label>
                <textarea value={closeForm.closeObservations} onChange={e => setCloseForm({...closeForm, closeObservations: e.target.value.toLocaleUpperCase()})} rows={4}
                  style={{ width: '100%', padding: '0.625rem', border: '2px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical' }}
                  placeholder="Describa la solución aplicada..." />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.375rem' }}>Fotos del Trabajo (opcional)</label>
                <input type="file" multiple accept="image/*,.pdf" onChange={e => setCloseFiles(Array.from(e.target.files))}
                  style={{ width: '100%', padding: '0.5rem', border: '2px dashed #e2e8f0', borderRadius: '8px', fontSize: '0.8125rem' }} />
                {closeFiles.length > 0 && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                    {closeFiles.length} archivo(s) seleccionado(s)
                  </div>
                )}
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
