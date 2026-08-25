import { useState } from 'react';
import { Link } from 'react-router-dom';
import { searchPublicRequests, getPublicRequest } from '../services/api';
import toast from 'react-hot-toast';
import PublicHeader from '../components/PublicHeader';
import StatusBadge from '../components/StatusBadge';

// Parsea **bold** y *italic* básico a JSX
function parseMarkdown(text) {
  if (!text) return null;
  const parts = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      parts.push(<strong key={key++} style={{ fontWeight: 700 }}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={key++}>{match[3]}</em>);
    } else if (match[4]) {
      parts.push(match[4]);
    }
  }
  return parts;
}

const PRIORITY_COLORS = {
  alta: { bg: '#fee2e2', color: '#dc2626' },
  media: { bg: '#fef3c7', color: '#d97706' },
  baja: { bg: '#d1fae5', color: '#059669' },
};

export default function SearchRequests() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim() || query.trim().length < 2) return;
    setLoading(true);
    setSearched(true);
    setSelectedRequest(null);
    try {
      const data = await searchPublicRequests(query.trim());
      setResults(data);
    } catch (err) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewDetail(requestId) {
    setDetailLoading(true);
    try {
      const data = await getPublicRequest(requestId);
      setSelectedRequest(data);
    } catch (err) {
      toast.error('No se pudo cargar el detalle');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-bg)' }}>
      <PublicHeader />

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <Link to="/" style={{ fontSize: '0.875rem', color: '#6366f1', textDecoration: 'none', fontWeight: 600 }}>
            ← Volver al inicio
          </Link>
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>
          Buscar Solicitudes
        </h1>
        <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9375rem' }}>
          Ingresá tu número de cédula o el código/número de solicitud (ej: SOL-2026-0001) para consultar el estado.
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.toLocaleUpperCase())}
            placeholder="Ej: 30297111 o SOL-2026-0001"
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: '2px solid #e2e8f0',
              fontSize: '1rem',
              outline: 'none',
              fontFamily: 'inherit',
              transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            }}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || query.trim().length < 2}
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>
        </form>

        {/* Resultados */}
        {searched && !loading && results.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
            <p style={{ color: 'var(--color-gray-600)', fontSize: '1rem' }}>
              No se encontraron solicitudes asociadas a esa cédula o número de ticket.
            </p>
          </div>
        )}

        {results.length > 0 && !selectedRequest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {results.map((r) => (
              <div
                key={r.request_id}
                style={{
                  background: 'white',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '1.25rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                onClick={() => handleViewDetail(r.request_id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0369a1';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(3, 105, 161, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', letterSpacing: '-0.01em' }}>
                      {r.ticket_code}
                    </span>
                    <span style={{ margin: '0 0.5rem', color: '#cbd5e1' }}>·</span>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {r.module_name}
                    </span>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <p style={{ fontSize: '0.875rem', color: '#475569', margin: '0.5rem 0', lineHeight: 1.6 }}>
                  {r.process_description?.substring(0, 150)}{r.process_description?.length > 150 ? '...' : ''}
                </p>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                  <span>
                    <strong style={{ fontWeight: 600 }}>Prioridad:</strong>{' '}
                    <span style={{ color: PRIORITY_COLORS[r.priority]?.color, fontWeight: 600 }}>
                      {r.priority?.charAt(0).toUpperCase() + r.priority?.slice(1)}
                    </span>
                  </span>
                  <span>{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detalle de solicitud */}
        {selectedRequest && (
          <div style={{
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid #e2e8f0',
            padding: '2rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedRequest(null)}
              >
                ← Volver a resultados
              </button>
              <StatusBadge status={selectedRequest.request.status} />
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '1rem', letterSpacing: '-0.025em' }}>
              {selectedRequest.request.ticket_code}
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Módulo</div>
                <div style={{ fontWeight: 600, color: '#334155', marginTop: '0.2rem' }}>{selectedRequest.request.module_name}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipo</div>
                <div style={{ fontWeight: 600, color: '#334155', marginTop: '0.2rem' }}>{selectedRequest.request.request_type_name}</div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prioridad</div>
                <div style={{ fontWeight: 700, color: PRIORITY_COLORS[selectedRequest.request.priority]?.color, marginTop: '0.2rem' }}>
                  {selectedRequest.request.priority?.charAt(0).toUpperCase() + selectedRequest.request.priority?.slice(1)}
                </div>
              </div>
              <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.6875rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Departamento</div>
                <div style={{ fontWeight: 600, color: '#334155', marginTop: '0.2rem' }}>{selectedRequest.request.department_name}</div>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '3px', height: '14px', background: 'linear-gradient(180deg, #0369a1, #0ea5e9)', borderRadius: '2px', display: 'inline-block' }} />
                Proceso Administrativo
              </h4>
              <p style={{ color: '#334155', lineHeight: 1.7, fontSize: '0.9375rem' }}>{selectedRequest.request.process_description}</p>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <h4 style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '3px', height: '14px', background: 'linear-gradient(180deg, #0369a1, #0ea5e9)', borderRadius: '2px', display: 'inline-block' }} />
                Comportamiento Actual
              </h4>
              <p style={{ color: '#334155', lineHeight: 1.7, fontSize: '0.9375rem' }}>{selectedRequest.request.current_behavior}</p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '3px', height: '14px', background: 'linear-gradient(180deg, #0369a1, #0ea5e9)', borderRadius: '2px', display: 'inline-block' }} />
                Comportamiento Esperado
              </h4>
              <p style={{ color: '#334155', lineHeight: 1.7, fontSize: '0.9375rem' }}>{selectedRequest.request.expected_behavior}</p>
            </div>

            {/* Motivo de rechazo */}
            {selectedRequest.request.rejection_reason && (
              <div style={{ marginBottom: '1.25rem', background: '#fef2f2', padding: '1rem', borderRadius: '10px', border: '1px solid #fecaca', borderLeft: '4px solid #dc2626' }}>
                <h4 style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>
                  Motivo de Rechazo
                </h4>
                <p style={{ color: '#991b1b', lineHeight: 1.6, fontSize: '0.9375rem' }}>{parseMarkdown(selectedRequest.request.rejection_reason)}</p>
              </div>
            )}

            {/* Notas de resolución */}
            {selectedRequest.request.resolution_notes && (
              <div style={{ marginBottom: '1.25rem', background: '#f0fdf4', padding: '1rem', borderRadius: '10px', border: '1px solid #bbf7d0', borderLeft: '4px solid #16a34a' }}>
                <h4 style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem' }}>
                  Notas de Resolución
                </h4>
                <p style={{ color: '#166534', lineHeight: 1.6, fontSize: '0.9375rem' }}>{parseMarkdown(selectedRequest.request.resolution_notes)}</p>
              </div>
            )}

            {/* Respuesta generada por IA */}
            {selectedRequest.request.ai_generated_response && (
              <div style={{ marginBottom: '1.25rem', background: '#f5f3ff', padding: '1rem', borderRadius: '10px', border: '1px solid #ddd6fe', borderLeft: '4px solid #7c3aed' }}>
                <h4 style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.375rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 0 1 4 4v1a2 2 0 0 1 2 2h1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1a4 4 0 0 1-8 0H5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h1a2 2 0 0 1 2-2V6a4 4 0 0 1 4-4z" />
                  </svg>
                  Respuesta Generada
                </h4>
                <p style={{ color: '#5b21b6', lineHeight: 1.7, fontSize: '0.9375rem', whiteSpace: 'pre-wrap' }}>{parseMarkdown(selectedRequest.request.ai_generated_response)}</p>
              </div>
            )}

            {/* Clasificación IA */}
            {selectedRequest.request.ai_priority && (
              <div style={{ marginBottom: '1.5rem', background: '#eff6ff', padding: '1rem', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                <h4 style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 0 1 4 4v1a2 2 0 0 1 2 2h1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1a4 4 0 0 1-8 0H5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h1a2 2 0 0 1 2-2V6a4 4 0 0 1 4-4z" />
                  </svg>
                  Clasificación IA
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div style={{ background: 'white', padding: '0.625rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Prioridad:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.125rem' }}>{selectedRequest.request.ai_priority}</div>
                  </div>
                  <div style={{ background: 'white', padding: '0.625rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Categoría:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.125rem' }}>{selectedRequest.request.ai_category}</div>
                  </div>
                  {selectedRequest.request.ai_module_suggested && (
                    <div style={{ background: 'white', padding: '0.625rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Módulo sugerido:</span>
                      <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '0.125rem' }}>{selectedRequest.request.ai_module_suggested}</div>
                    </div>
                  )}
                  {selectedRequest.request.ai_summary && (
                    <div style={{ gridColumn: '1 / -1', background: 'white', padding: '0.625rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.625rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Resumen:</span>
                      <div style={{ color: '#334155', marginTop: '0.125rem' }}>{selectedRequest.request.ai_summary}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comentarios */}
            {selectedRequest.comments && selectedRequest.comments.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.75rem', color: '#0369a1', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '3px', height: '14px', background: 'linear-gradient(180deg, #0369a1, #0ea5e9)', borderRadius: '2px', display: 'inline-block' }} />
                  Comentarios ({selectedRequest.comments.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedRequest.comments.map((c) => (
                    <div key={c.comment_id} style={{
                      background: '#f8fafc',
                      padding: '0.875rem',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0f172a' }}>{c.author_name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>{new Date(c.created_at).toLocaleString()}</span>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#475569', margin: 0, lineHeight: 1.6 }}>{parseMarkdown(c.content)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Historial */}
            {selectedRequest.history.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                  Historial de Estados
                </h4>
                <div style={{ borderLeft: '2px solid #e2e8f0', paddingLeft: '1rem' }}>
                  {selectedRequest.history.map((h) => (
                    <div key={h.history_id} style={{ marginBottom: '0.75rem', position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        left: '-1.35rem',
                        top: '0.35rem',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: '#6366f1',
                      }} />
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <StatusBadge status={h.to_status} />
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          {h.changed_by_name} · {new Date(h.created_at).toLocaleString()}
                        </span>
                      </div>
                      {h.comment && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-gray-600)', marginTop: '0.25rem' }}>
                          {h.comment}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
