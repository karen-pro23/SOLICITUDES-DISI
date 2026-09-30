import { useState, useEffect, useCallback } from 'react';
import { List, BarChart3, Smile, Frown, X, FileText, Search, Check, UserCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getServiceTickets, acceptServiceTicket, rejectServiceTicket, assignServiceTicket, closeServiceTicket, getServiceTicketStats, getServiceTicketSummaryPdf, getServiceTicketTechnicians } from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import PdfPreviewModal from '../components/PdfPreviewModal';
import './AdminPage.css';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  jefe_st: 'Jefe Serv. Técnico',
  jefe_area: 'Jefe de Área',
  developer: 'Desarrollador',
  tecnico: 'Técnico',
  director: 'Director',
  sub_director: 'Sub Director',
};

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
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [closeForm, setCloseForm] = useState({ serviceType: '', closeObservations: '' });
  const [closeFiles, setCloseFiles] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [selectedTechnician, setSelectedTechnician] = useState('');
  const [techSearch, setTechSearch] = useState('');
  const [loadingTechs, setLoadingTechs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState('list'); // list | stats
  const [pdfPreviewModal, setPdfPreviewModal] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  async function handleGeneratePdf(ticket = null) {
    setGeneratingPdf(true);
    const toastId = toast.loading('Generando resumen en PDF...');
    try {
      const ticketId = ticket?.request_id || null;
      const code = ticket?.ticket_code || '40145';
      const blob = await getServiceTicketSummaryPdf(ticketId);
      const url = window.URL.createObjectURL(blob);
      toast.success('PDF generado exitosamente', { id: toastId });
      setPdfPreviewModal({
        url,
        name: `Resumen_Atencion_${code}.pdf`,
      });
    } catch (err) {
      console.error('Error al generar PDF:', err);
      toast.error(err.response?.data?.error || 'Error al generar el PDF de resumen', { id: toastId });
    } finally {
      setGeneratingPdf(false);
    }
  }

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
      setLoadingTechs(true);
      getServiceTicketTechnicians()
        .then(techs => {
          setTechnicians(techs || []);
        })
        .catch(err => {
          console.error(err);
          toast.error('Error al cargar la lista de técnicos');
        })
        .finally(() => setLoadingTechs(false));
    }
  }, [showAssignModal]);

  async function handleAccept(ticket) {
    try {
      await acceptServiceTicket(ticket.request_id);
      toast.success(`Ticket ${ticket.ticket_code} aceptado`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al aceptar');
    }
  }

  async function handleReject() {
    setSubmitting(true);
    try {
      await rejectServiceTicket(selectedTicket.request_id, rejectReason);
      toast.success(`Ticket ${selectedTicket.ticket_code} rechazado`);
      setShowRejectModal(false);
      setSelectedTicket(null);
      setRejectReason('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al rechazar');
    } finally {
      setSubmitting(false);
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
          <button className={`btn ${view === 'list' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('list')} style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <List size={15} /> Lista
          </button>
          <button className={`btn ${view === 'stats' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setView('stats')} style={{ fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <BarChart3 size={15} /> Estadísticas
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
                <div style={{ fontSize: '0.75rem', color: '#166534', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <Smile size={14} /> Satisfechos
                </div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', padding: '1rem', background: '#fef2f2', borderRadius: '10px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#991b1b' }}>{stats.unsatisfied}</div>
                <div style={{ fontSize: '0.75rem', color: '#991b1b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                  <Frown size={14} /> No Satisfechos
                </div>
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
                <table className="mgmt-table mgmt-table--tickets">
                  <thead>
                    <tr>
                      {[
                        { label: 'Ticket' },
                        { label: 'Solicitante' },
                        { label: 'Ext.', cls: 'col-optional' },
                        { label: 'Estado' },
                        { label: 'Técnico', cls: 'col-optional' },
                        { label: 'Tiempo', cls: 'col-optional' },
                        { label: 'Prioridad', cls: 'col-optional-sm' },
                        { label: 'Acciones' },
                      ].map(h => (
                        <th key={h.label} className={h.cls}>{h.label}</th>
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
                          <td>
                            <Link to={`/requests/${t.request_id}`} style={{ fontWeight: 700, color: '#6366f1', fontSize: '0.8125rem', textDecoration: 'none' }}>
                              {t.ticket_code}
                            </Link>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{t.requester_name || t.created_by_name}</div>
                            <div style={{ fontSize: '0.6875rem', color: '#94a3b8' }}>{t.department_name || ''}</div>
                          </td>
                          <td className="col-optional"><code style={{ fontSize: '0.75rem', color: '#6366f1', background: '#eef2ff', padding: '0.1rem 0.375rem', borderRadius: '4px' }}>{t.extension || '-'}</code></td>
                          <td><span className="mgmt-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                          <td className="col-optional"><span style={{ fontSize: '0.8125rem' }}>{t.technician_name || <span style={{ color: '#cbd5e1' }}>Sin asignar</span>}</span></td>
                          <td className="col-optional"><span style={{ fontSize: '0.75rem', color: '#64748b' }}>{calcResponseTime(t)}</span></td>
                          <td className="col-optional-sm">
                            <span className={`priority-pill priority-${t.priority}`} style={{ fontSize: '0.6875rem', padding: '0.15rem 0.5rem' }}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="text-right">
                            <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                              {/* Asignar o Reasignar técnico */}
                              {(t.status === 'PENDIENTE' || t.status === 'ASIGNADA') && user?.role !== 'requester' && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline"
                                  onClick={() => {
                                    setSelectedTicket(t);
                                    setSelectedTechnician(t.assigned_to ? String(t.assigned_to) : '');
                                    setTechSearch('');
                                    setShowAssignModal(true);
                                  }}
                                  title={t.assigned_to ? 'Reasignar técnico' : 'Asignar técnico'}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                                >
                                  <UserCheck size={13} />
                                  {t.assigned_to ? 'Reasignar' : 'Asignar'}
                                </button>
                              )}

                              {/* Aceptar / Rechazar cuando está pendiente */}
                              {t.status === 'PENDIENTE' && user?.role !== 'requester' && (
                                <>
                                  <button className="btn btn-sm btn-success" onClick={() => handleAccept(t)}>Aceptar</button>
                                  <button className="btn btn-sm btn-danger" onClick={() => { setSelectedTicket(t); setShowRejectModal(true); }}>Rechazar</button>
                                </>
                              )}

                              {/* Cerrar cuando está en proceso */}
                              {t.status === 'EN_PROCESO' && user?.role !== 'requester' && (
                                <button className="btn btn-sm btn-primary" onClick={() => { setSelectedTicket(t); setShowCloseModal(true); }}>Cerrar</button>
                              )}

                              {/* Generar PDF resumen solo cuando la solicitud esté completada */}
                              {t.status === 'COMPLETADA' && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline"
                                  title="Generar PDF resumen de atención"
                                  onClick={() => handleGeneratePdf(t)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    color: '#0284c7',
                                    borderColor: '#bae6fd',
                                    background: '#f0f9ff',
                                    fontWeight: 600,
                                  }}
                                >
                                  <FileText size={12} /> PDF
                                </button>
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

      {/* Modal Asignar Técnico (Search Select) */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px', overflow: 'visible' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                  {selectedTicket?.assigned_to ? 'Reasignar Técnico' : 'Asignar Técnico'}
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Ticket: <strong>{selectedTicket?.ticket_code}</strong>
                </span>
              </div>
              <button className="modal-close-btn" onClick={() => setShowAssignModal(false)} aria-label="Cerrar modal"><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ overflow: 'visible' }}>
              <label style={{ fontWeight: 600, fontSize: '0.8125rem', display: 'block', marginBottom: '0.5rem', color: '#334155' }}>
                Seleccionar Técnico Responsable
              </label>

              {/* Si ya hay un técnico seleccionado y no estamos buscando, mostrar card con opción de cambiar */}
              {selectedTechnician && !techSearch && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.625rem 0.875rem',
                  border: '2px solid #3b82f6',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  marginBottom: '0.75rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: '#3b82f6',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.8125rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {(technicians.find(t => String(t.user_id) === String(selectedTechnician))?.full_name || 'T')[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#1e3a8a' }}>
                        {technicians.find(t => String(t.user_id) === String(selectedTechnician))?.full_name || 'Técnico seleccionado'}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: '#3b82f6' }}>
                        {ROLE_LABELS[technicians.find(t => String(t.user_id) === String(selectedTechnician))?.role] || 'Personal Técnico'}
                        {technicians.find(t => String(t.user_id) === String(selectedTechnician))?.department_name ? ` • ${technicians.find(t => String(t.user_id) === String(selectedTechnician))?.department_name}` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setSelectedTechnician(''); setTechSearch(''); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.4rem',
                      borderRadius: '4px',
                    }}
                    title="Cambiar técnico"
                  >
                    Cambiar
                  </button>
                </div>
              )}

              {/* Input buscador con icono de búsqueda */}
              {(!selectedTechnician || techSearch) && (
                <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
                  <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                  <input
                    type="text"
                    value={techSearch}
                    onChange={e => setTechSearch(e.target.value)}
                    placeholder="Buscar técnico por nombre, rol..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.75rem 0.625rem 2.25rem',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                  {techSearch && (
                    <button
                      type="button"
                      onClick={() => setTechSearch('')}
                      style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Lista filtrada de técnicos (Search Select Dropdown) */}
              {(!selectedTechnician || techSearch) && (
                <div style={{
                  maxHeight: '200px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  background: 'white',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                }}>
                  {loadingTechs ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8125rem' }}>
                      Cargando técnicos...
                    </div>
                  ) : technicians.filter(t => {
                    const q = techSearch.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      (t.full_name || '').toLowerCase().includes(q) ||
                      (t.role || '').toLowerCase().includes(q) ||
                      (t.email || '').toLowerCase().includes(q) ||
                      (t.department_name || '').toLowerCase().includes(q) ||
                      (ROLE_LABELS[t.role] || '').toLowerCase().includes(q)
                    );
                  }).length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.8125rem' }}>
                      No se encontraron técnicos disponibles
                    </div>
                  ) : (
                    technicians.filter(t => {
                      const q = techSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        (t.full_name || '').toLowerCase().includes(q) ||
                        (t.role || '').toLowerCase().includes(q) ||
                        (t.email || '').toLowerCase().includes(q) ||
                        (t.department_name || '').toLowerCase().includes(q) ||
                        (ROLE_LABELS[t.role] || '').toLowerCase().includes(q)
                      );
                    }).map(t => {
                      const isSelected = String(t.user_id) === String(selectedTechnician);
                      return (
                        <div
                          key={t.user_id}
                          onClick={() => {
                            setSelectedTechnician(String(t.user_id));
                            setTechSearch('');
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.6rem 0.75rem',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            background: isSelected ? '#eff6ff' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: isSelected ? '#3b82f6' : '#e2e8f0',
                              color: isSelected ? 'white' : '#475569',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              {(t.full_name || 'T')[0]}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#1e293b' }}>
                                {t.full_name}
                              </div>
                              <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                                {ROLE_LABELS[t.role] || t.role} {t.department_name ? `• ${t.department_name}` : ''}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check size={16} color="#3b82f6" />}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setShowAssignModal(false)} disabled={submitting}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={submitting || !selectedTechnician}>
                {submitting ? 'Asignando...' : 'Confirmar Asignación'}
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
              <button className="modal-close-btn" onClick={() => setShowCloseModal(false)} aria-label="Cerrar modal"><X size={18} /></button>
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

      {/* Modal Rechazar */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header" style={{ borderBottom: '2px solid #fecaca' }}>
              <h3 style={{ color: '#dc2626' }}>Rechazar Ticket {selectedTicket?.ticket_code}</h3>
              <button className="modal-close-btn" onClick={() => setShowRejectModal(false)} aria-label="Cerrar modal"><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
                Indicá el motivo del rechazo para notificar al solicitante.
              </p>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value.toLocaleUpperCase())} rows={4}
                style={{ width: '100%', padding: '0.625rem', border: '2px solid #fecaca', borderRadius: '8px', fontSize: '0.875rem', resize: 'vertical' }}
                placeholder="Motivo del rechazo..." />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowRejectModal(false)} disabled={submitting}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleReject} disabled={submitting}>
                {submitting ? 'Rechazando...' : 'Confirmar Rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Vista Previa de PDF */}
      {pdfPreviewModal && (
        <PdfPreviewModal
          url={pdfPreviewModal.url}
          name={pdfPreviewModal.name}
          onClose={() => {
            if (pdfPreviewModal.url) {
              window.URL.revokeObjectURL(pdfPreviewModal.url);
            }
            setPdfPreviewModal(null);
          }}
        />
      )}
    </div>
  );
}

