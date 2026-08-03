import { useState, useEffect } from 'react';
import { getMetrics } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import './AdminPage.css';

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMetrics()
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted">Cargando reportes de gestión...</p>;
  if (!metrics) return <p className="alert alert-error">Error al cargar métricas</p>;

  const resolvedCount = metrics.byStatus.find((s) => s.status === 'COMPLETADA')?.count || 0;
  const inProgressCount = metrics.byStatus.find((s) => s.status === 'EN_PROCESO')?.count || 0;
  const pendingCount = metrics.byStatus.find((s) => s.status === 'PENDIENTE')?.count || 0;
  const resolutionRate = metrics.total > 0 ? ((resolvedCount / metrics.total) * 100).toFixed(1) : '0';

  return (
    <div className="admin-page" style={{ animation: 'fadeInUp 0.35s ease' }}>
      <div className="page-header">
        <div>
          <h1>Reportes de Gestión y Rendimiento</h1>
          <p className="page-subtitle" style={{ marginBottom: 0 }}>
            Estadísticas consolidadas de solicitudes por departamento y estado de atención del equipo de Sistemas.
          </p>
        </div>
      </div>

      {/* Tarjetas de Resumen KPI */}
      <div className="metrics-grid">
        <div className="metric-card metric-total">
          <div className="metric-value">{metrics.total}</div>
          <div className="metric-label">Total Solicitudes Recibidas</div>
        </div>

        <div className="metric-card metric-resolved">
          <div className="metric-value">{resolvedCount}</div>
          <div className="metric-label">Total Solicitudes Atendidas</div>
        </div>

        <div className="metric-card metric-in-progress">
          <div className="metric-value">{resolutionRate}%</div>
          <div className="metric-label">Tasa de Resolución de Sistemas</div>
        </div>

        <div className="metric-card metric-rejected">
          <div className="metric-value">{metrics.rejectedThisMonth}</div>
          <div className="metric-label">Rechazadas (Este Mes)</div>
        </div>
      </div>

      <div className="metrics-tables">
        {/* Reporte por Departamento */}
        <div className="detail-card">
          <h3>Reporte de Solicitudes por Departamento</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Departamento</th>
                <th>Total Solicitudes</th>
                <th>Rechazadas</th>
                <th>Proporción del Total</th>
              </tr>
            </thead>
            <tbody>
              {metrics.byDepartment.map((d) => {
                const percentage = metrics.total > 0 ? ((d.total / metrics.total) * 100).toFixed(0) : 0;
                return (
                  <tr key={d.name}>
                    <td><strong>{d.name}</strong></td>
                    <td>{d.total}</td>
                    <td>
                      <span style={{ color: d.rejected > 0 ? 'var(--color-danger)' : 'var(--color-gray-500)', fontWeight: d.rejected > 0 ? 700 : 400 }}>
                        {d.rejected}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                          flex: 1,
                          height: '8px',
                          background: 'var(--color-gray-100)',
                          borderRadius: '99px',
                          overflow: 'hidden'
                        }}>
                          <div style={{
                            height: '100%',
                            width: `${percentage}%`,
                            background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
                            borderRadius: '99px'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-gray-600)', minWidth: '32px' }}>
                          {percentage}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Reporte por Estado */}
        <div className="detail-card">
          <h3>Distribución por Estado</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Estado</th>
                <th>Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {metrics.byStatus.map((s) => (
                <tr key={s.status}>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td><strong>{s.count}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Reporte por Módulo */}
        <div className="detail-card">
          <h3>Solicitudes por Módulo Afectado</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Módulo</th>
                <th>Solicitudes</th>
              </tr>
            </thead>
            <tbody>
              {metrics.byModule.map((m) => (
                <tr key={m.name}>
                  <td>{m.name}</td>
                  <td><strong>{m.total}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
