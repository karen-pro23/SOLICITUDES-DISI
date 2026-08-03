import './StatusBadge.css';

const STATUS_STYLES = {
  PENDIENTE: { bg: '#fef3c7', color: '#92400e', label: 'Pendiente' },
  RECHAZADA: { bg: '#fee2e2', color: '#991b1b', label: 'Rechazada' },
  EN_PROCESO: { bg: '#dbeafe', color: '#1e40af', label: 'En Proceso' },
  EN_PRUEBAS: { bg: '#e0e7ff', color: '#3730a3', label: 'En Pruebas' },
  COMPLETADA: { bg: '#d1fae5', color: '#065f46', label: 'Completada' },
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || { bg: '#f3f4f6', color: '#374151', label: status };

  return (
    <span
      className="status-badge"
      data-status={status}
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}
