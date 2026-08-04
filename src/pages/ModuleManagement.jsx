import { useState, useEffect } from 'react';
import { getModules as fetchModules, getRequestTypes as fetchTypes } from '../services/api';
import api from '../services/api';
import './AdminPage.css';

export default function ModuleManagement() {
  const [modules, setModules] = useState([]);
  const [types, setTypes] = useState([]);
  const [moduleForm, setModuleForm] = useState({ name: '', description: '', isSystems: false });
  const [typeForm, setTypeForm] = useState({ name: '', code: '', requiresScreenshot: true, requiresDocument: true });
  const [editingModule, setEditingModule] = useState(null);
  const [editingType, setEditingType] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchModules(), fetchTypes()])
      .then(([m, t]) => { setModules(m); setTypes(t); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
      } else {
        const { data } = await api.post('/admin/modules', moduleForm);
        setModules((prev) => [...prev, data.module]);
      }
      setModuleForm({ name: '', description: '', isSystems: false });
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function handleTypeSubmit(e) {
    e.preventDefault();
    try {
      if (editingType) {
        const { data } = await api.put(`/admin/request-types/${editingType}`, typeForm);
        setTypes((prev) => prev.map((t) => t.request_type_id === editingType ? data.requestType : t));
        setEditingType(null);
      } else {
        const { data } = await api.post('/admin/request-types', typeForm);
        setTypes((prev) => [...prev, data.requestType]);
      }
      setTypeForm({ name: '', code: '', requiresScreenshot: true, requiresDocument: true });
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function handleDeleteModule(id) {
    if (!confirm('¿Eliminar módulo?')) return;
    try { await api.delete(`/admin/modules/${id}`); setModules((prev) => prev.filter((m) => m.module_id !== id)); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  async function handleDeleteType(id) {
    if (!confirm('¿Eliminar tipo?')) return;
    try { await api.delete(`/admin/request-types/${id}`); setTypes((prev) => prev.filter((t) => t.request_type_id !== id)); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  }

  if (loading) return <p>Cargando...</p>;

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>Módulos y Tipos de Solicitud</h1>
      </div>

      <div className="admin-columns">
        <div className="admin-column">
          <div className="admin-form-card">
            <h3>{editingModule ? 'Editar Módulo' : 'Nuevo Módulo'}</h3>
              <form onSubmit={handleModuleSubmit} className="admin-form">
                <div className="form-group">
                  <label>Nombre</label>
                  <input value={moduleForm.name} onChange={(e) => setModuleForm({...moduleForm, name: e.target.value.toLocaleUpperCase()})} required />
                </div>
                <div className="form-group">
                  <label>Descripción</label>
                  <input value={moduleForm.description} onChange={(e) => setModuleForm({...moduleForm, description: e.target.value.toLocaleUpperCase()})} />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={moduleForm.isSystems}
                      onChange={(e) => setModuleForm({...moduleForm, isSystems: e.target.checked})}
                    />
                    Es de Sistemas
                  </label>
                </div>
                <div className="form-actions">
                  {editingModule && <button type="button" className="btn btn-outline" onClick={() => { setEditingModule(null); setModuleForm({ name: '', description: '', isSystems: false }); }}>Cancelar</button>}
                  <button type="submit" className="btn btn-primary">{editingModule ? 'Actualizar' : 'Crear'}</button>
                </div>
              </form>
          </div>
          <table className="table">
            <thead><tr><th>Nombre</th><th>Activo</th><th>Sistemas</th><th></th></tr></thead>
            <tbody>
              {modules.map((m) => (
                <tr key={m.module_id}>
                  <td>{m.name}</td>
                  <td>{m.is_active ? '✓' : '✗'}</td>
                  <td>{m.is_systems ? '✓' : '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => { setEditingModule(m.module_id); setModuleForm({ name: m.name, description: m.description || '', isSystems: m.is_systems }); }}>Editar</button>
                    {' '}<button className="btn btn-sm btn-danger" onClick={() => handleDeleteModule(m.module_id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-column">
          <div className="admin-form-card">
            <h3>{editingType ? 'Editar Tipo' : 'Nuevo Tipo'}</h3>
            <form onSubmit={handleTypeSubmit} className="admin-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre</label>
                  <input value={typeForm.name} onChange={(e) => setTypeForm({...typeForm, name: e.target.value.toLocaleUpperCase()})} required />
                </div>
                <div className="form-group">
                  <label>Código</label>
                  <input value={typeForm.code} onChange={(e) => setTypeForm({...typeForm, code: e.target.value.toLocaleUpperCase().toUpperCase()})} required />
                </div>
              </div>
              <div className="form-row">
                <label className="checkbox-label">
                  <input type="checkbox" checked={typeForm.requiresScreenshot} onChange={(e) => setTypeForm({...typeForm, requiresScreenshot: e.target.checked})} />
                  Requiere captura de pantalla
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={typeForm.requiresDocument} onChange={(e) => setTypeForm({...typeForm, requiresDocument: e.target.checked})} />
                  Requiere documento soporte
                </label>
              </div>
              <div className="form-actions">
                {editingType && <button type="button" className="btn btn-outline" onClick={() => { setEditingType(null); setTypeForm({ name: '', code: '', requiresScreenshot: true, requiresDocument: true }); }}>Cancelar</button>}
                <button type="submit" className="btn btn-primary">{editingType ? 'Actualizar' : 'Crear'}</button>
              </div>
            </form>
          </div>
          <table className="table">
            <thead><tr><th>Nombre</th><th>Código</th><th>Captura</th><th>Doc</th><th></th></tr></thead>
            <tbody>
              {types.map((t) => (
                <tr key={t.request_type_id}>
                  <td>{t.name}</td>
                  <td>{t.code}</td>
                  <td>{t.requires_screenshot ? '✓' : '✗'}</td>
                  <td>{t.requires_document ? '✓' : '✗'}</td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => { setEditingType(t.request_type_id); setTypeForm({ name: t.name, code: t.code, requiresScreenshot: t.requires_screenshot, requiresDocument: t.requires_document }); }}>Editar</button>
                    {' '}<button className="btn btn-sm btn-danger" onClick={() => handleDeleteType(t.request_type_id)}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
