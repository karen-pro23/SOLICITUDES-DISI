import { useState, useEffect, useMemo } from 'react';
import { getModules as fetchModules, getRequestTypes as fetchTypes } from '../services/api';
import api from '../services/api';
import toast from 'react-hot-toast';
import './AdminPage.css';

// ── Helpers ──────────────────────────────────────
function useSearch(items, key) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const term = q.toUpperCase();
    return items.filter((item) =>
      Object.values(item).some((v) => String(v).toUpperCase().includes(term))
    );
  }, [items, q]);
  return { q, setQ, filtered };
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      className={`mgmt-toggle ${checked ? 'mgmt-toggle--on' : ''} ${disabled ? 'mgmt-toggle--disabled' : ''}`}
      onClick={onChange}
      disabled={disabled}
      aria-pressed={checked}
    >
      <span className="mgmt-toggle-knob" />
    </button>
  );
}

function StatusDot({ active }) {
  return <span className={`mgmt-dot ${active ? 'mgmt-dot--green' : 'mgmt-dot--red'}`} />;
}

function Badge({ children, variant }) {
  return <span className={`mgmt-badge mgmt-badge--${variant || 'default'}`}>{children}</span>;
}

// ── Main Component ───────────────────────────────
export default function ModuleManagement() {
  const [modules, setModules] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [moduleForm, setModuleForm] = useState({ name: '', description: '', isSystems: false });
  const [typeForm, setTypeForm] = useState({ name: '', code: '', requiresScreenshot: true, requiresDocument: true });
  const [editingModule, setEditingModule] = useState(null);
  const [editingType, setEditingType] = useState(null);

  // Collapsible sections
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);

  // Search
  const modSearch = useSearch(modules, 'name');
  const typeSearch = useSearch(types, 'name');

  useEffect(() => {
    Promise.all([fetchModules(), fetchTypes()])
      .then(([m, t]) => { setModules(m); setTypes(t); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Module CRUD ────────────────────────────────
  async function handleModuleSubmit(e) {
    e.preventDefault();
    try {
      if (editingModule) {
        const { data } = await api.put(`/admin/modules/${editingModule}`, {
          name: moduleForm.name,
          description: moduleForm.description,
          isSystems: moduleForm.isSystems,
        });
        setModules((prev) => prev.map((m) => m.module_id === editingModule ? data.module : m));
        setEditingModule(null);
        toast.success('Módulo actualizado');
      } else {
        const { data } = await api.post('/admin/modules', moduleForm);
        setModules((prev) => [...prev, data.module]);
        toast.success('Módulo creado');
      }
      setModuleForm({ name: '', description: '', isSystems: false });
      setShowModuleForm(false);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  }

  async function handleDeleteModule(id, name) {
    if (!confirm(`¿Eliminar módulo "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/admin/modules/${id}`);
      setModules((prev) => prev.filter((m) => m.module_id !== id));
      toast.success('Módulo eliminado');
    } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar'); }
  }

  function startEditModule(m) {
    setEditingModule(m.module_id);
    setModuleForm({ name: m.name, description: m.description || '', isSystems: m.is_systems });
    setShowModuleForm(true);
  }

  function cancelEditModule() {
    setEditingModule(null);
    setModuleForm({ name: '', description: '', isSystems: false });
    setShowModuleForm(false);
  }

  // ── Type CRUD ──────────────────────────────────
  async function handleTypeSubmit(e) {
    e.preventDefault();
    try {
      if (editingType) {
        const { data } = await api.put(`/admin/request-types/${editingType}`, typeForm);
        setTypes((prev) => prev.map((t) => t.request_type_id === editingType ? data.requestType : t));
        setEditingType(null);
        toast.success('Tipo actualizado');
      } else {
        const { data } = await api.post('/admin/request-types', typeForm);
        setTypes((prev) => [...prev, data.requestType]);
        toast.success('Tipo creado');
      }
      setTypeForm({ name: '', code: '', requiresScreenshot: true, requiresDocument: true });
      setShowTypeForm(false);
    } catch (err) { toast.error(err.response?.data?.error || 'Error'); }
  }

  async function handleDeleteType(id, name) {
    if (!confirm(`¿Eliminar tipo "${name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/admin/request-types/${id}`);
      setTypes((prev) => prev.filter((t) => t.request_type_id !== id));
      toast.success('Tipo eliminado');
    } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar'); }
  }

  function startEditType(t) {
    setEditingType(t.request_type_id);
    setTypeForm({ name: t.name, code: t.code, requiresScreenshot: t.requires_screenshot, requiresDocument: t.requires_document });
    setShowTypeForm(true);
  }

  function cancelEditType() {
    setEditingType(null);
    setTypeForm({ name: '', code: '', requiresScreenshot: true, requiresDocument: true });
    setShowTypeForm(false);
  }

  if (loading) {
    return (
      <div className="admin-page">
        <div className="mgmt-skeleton">
          {[1, 2, 3, 4].map((i) => <div key={i} className="mgmt-skeleton-card" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Módulos y Tipos de Solicitud</h1>
        <p className="page-subtitle">Gestioná los módulos funcionales y los tipos de solicitud del sistema</p>
      </div>

      {/* ═══ MÓDULOS ═══ */}
      <section className="mgmt-section">
        <div className="mgmt-section-header">
          <div className="mgmt-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <h2>Módulos</h2>
            <Badge variant="blue">{modules.length}</Badge>
          </div>
          <div className="mgmt-section-actions">
            <div className="mgmt-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Buscar módulos..."
                value={modSearch.q}
                onChange={(e) => modSearch.setQ(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { cancelEditModule(); setShowModuleForm((v) => !v); }}
            >
              {showModuleForm ? '✕ Cancelar' : '+ Nuevo'}
            </button>
          </div>
        </div>

        {/* Form colapsable */}
        {showModuleForm && (
          <div className="mgmt-form-panel">
            <form onSubmit={handleModuleSubmit} className="mgmt-form">
              <div className="mgmt-form-grid">
                <div className="form-group">
                  <label>Nombre</label>
                  <input
                    value={moduleForm.name}
                    onChange={(e) => setModuleForm({ ...moduleForm, name: e.target.value.toLocaleUpperCase() })}
                    placeholder="Ej: TESORERÍA"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Descripción</label>
                  <input
                    value={moduleForm.description}
                    onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value.toLocaleUpperCase() })}
                    placeholder="Opcional"
                  />
                </div>
                <div className="form-group form-group--toggle">
                  <label>Es de Sistemas</label>
                  <Toggle
                    checked={moduleForm.isSystems}
                    onChange={() => setModuleForm({ ...moduleForm, isSystems: !moduleForm.isSystems })}
                  />
                </div>
              </div>
              <div className="mgmt-form-footer">
                {editingModule && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={cancelEditModule}>
                    Cancelar
                  </button>
                )}
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingModule ? 'Actualizar Módulo' : 'Crear Módulo'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de módulos */}
        <div className="mgmt-list">
          {modSearch.filtered.length === 0 && (
            <div className="mgmt-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              <p>{modSearch.q ? 'No se encontraron módulos' : 'No hay módulos creados'}</p>
            </div>
          )}
          {modSearch.filtered.map((m) => (
            <div key={m.module_id} className="mgmt-card">
              <div className="mgmt-card-body">
                <div className="mgmt-card-info">
                  <StatusDot active={m.is_active} />
                  <div>
                    <div className="mgmt-card-name">{m.name}</div>
                    {m.description && <div className="mgmt-card-desc">{m.description}</div>}
                  </div>
                </div>
                <div className="mgmt-card-tags">
                  {m.is_systems && <Badge variant="purple">Sistemas</Badge>}
                  <Badge variant={m.is_active ? 'green' : 'red'}>
                    {m.is_active ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
              <div className="mgmt-card-actions">
                <button className="mgmt-icon-btn" onClick={() => startEditModule(m)} title="Editar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="mgmt-icon-btn mgmt-icon-btn--danger" onClick={() => handleDeleteModule(m.module_id, m.name)} title="Eliminar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ TIPOS DE SOLICITUD ═══ */}
      <section className="mgmt-section">
        <div className="mgmt-section-header">
          <div className="mgmt-section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <h2>Tipos de Solicitud</h2>
            <Badge variant="blue">{types.length}</Badge>
          </div>
          <div className="mgmt-section-actions">
            <div className="mgmt-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
              <input
                type="text"
                placeholder="Buscar tipos..."
                value={typeSearch.q}
                onChange={(e) => typeSearch.setQ(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { cancelEditType(); setShowTypeForm((v) => !v); }}
            >
              {showTypeForm ? '✕ Cancelar' : '+ Nuevo'}
            </button>
          </div>
        </div>

        {/* Form colapsable */}
        {showTypeForm && (
          <div className="mgmt-form-panel">
            <form onSubmit={handleTypeSubmit} className="mgmt-form">
              <div className="mgmt-form-grid mgmt-form-grid--2col">
                <div className="form-group">
                  <label>Nombre</label>
                  <input
                    value={typeForm.name}
                    onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value.toLocaleUpperCase() })}
                    placeholder="Ej: CORRECCIÓN DE ERRORES"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Código</label>
                  <input
                    value={typeForm.code}
                    onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toLocaleUpperCase() })}
                    placeholder="Ej: CERR"
                    required
                  />
                </div>
              </div>
              <div className="mgmt-form-toggles">
                <label className="mgmt-toggle-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span>Captura de pantalla</span>
                  <Toggle
                    checked={typeForm.requiresScreenshot}
                    onChange={() => setTypeForm({ ...typeForm, requiresScreenshot: !typeForm.requiresScreenshot })}
                  />
                </label>
                <label className="mgmt-toggle-row">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  <span>Documento soporte</span>
                  <Toggle
                    checked={typeForm.requiresDocument}
                    onChange={() => setTypeForm({ ...typeForm, requiresDocument: !typeForm.requiresDocument })}
                  />
                </label>
              </div>
              <div className="mgmt-form-footer">
                {editingType && (
                  <button type="button" className="btn btn-outline btn-sm" onClick={cancelEditType}>
                    Cancelar
                  </button>
                )}
                <button type="submit" className="btn btn-primary btn-sm">
                  {editingType ? 'Actualizar Tipo' : 'Crear Tipo'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de tipos */}
        <div className="mgmt-list">
          {typeSearch.filtered.length === 0 && (
            <div className="mgmt-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <p>{typeSearch.q ? 'No se encontraron tipos' : 'No hay tipos creados'}</p>
            </div>
          )}
          {typeSearch.filtered.map((t) => (
            <div key={t.request_type_id} className="mgmt-card">
              <div className="mgmt-card-body">
                <div className="mgmt-card-info">
                  <div className="mgmt-card-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <div>
                    <div className="mgmt-card-name">{t.name}</div>
                    <div className="mgmt-card-desc">
                      Código: <strong>{t.code}</strong>
                    </div>
                  </div>
                </div>
                <div className="mgmt-card-tags">
                  <Badge variant={t.requires_screenshot ? 'green' : 'gray'}>
                    {t.requires_screenshot ? '📷 Captura' : 'Sin captura'}
                  </Badge>
                  <Badge variant={t.requires_document ? 'green' : 'gray'}>
                    {t.requires_document ? '📄 Documento' : 'Sin documento'}
                  </Badge>
                </div>
              </div>
              <div className="mgmt-card-actions">
                <button className="mgmt-icon-btn" onClick={() => startEditType(t)} title="Editar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button className="mgmt-icon-btn mgmt-icon-btn--danger" onClick={() => handleDeleteType(t.request_type_id, t.name)} title="Eliminar">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
