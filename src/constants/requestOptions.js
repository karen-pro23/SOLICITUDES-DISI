// Opciones y transiciones de estado y prioridad (fuente única)
export const STATUS_OPTIONS = [
  { value: 'PENDIENTE', label: 'PENDIENTE' },
  { value: 'ASIGNADA', label: 'ASIGNADA' },
  { value: 'EN_PROCESO', label: 'EN PROCESO' },
  { value: 'EN_PRUEBAS', label: 'EN PRUEBAS' },
  { value: 'COMPLETADA', label: 'COMPLETADA' },
  { value: 'RECHAZADA', label: 'RECHAZADA' },
];

export const STATUS_TRANSITIONS = {
  PENDIENTE: ['EN_PROCESO', 'RECHAZADA', 'ASIGNADA'],
  ASIGNADA: ['EN_PROCESO', 'RECHAZADA'],
  RECHAZADA: ['PENDIENTE'],
  EN_PROCESO: ['EN_PRUEBAS', 'ASIGNADA', 'PENDIENTE'],
  EN_PRUEBAS: ['COMPLETADA', 'EN_PROCESO'],
  COMPLETADA: [],
};

export const PRIORITY_OPTIONS = [
  { value: 'alta', label: 'ALTA' },
  { value: 'media', label: 'MEDIA' },
  { value: 'baja', label: 'BAJA' },
];

export function isSupportRequest(req) {
  if (!req) return false;
  return (
    String(req.request_type_id) === '8' ||
    req.request_type_code === 'ST' ||
    req.request_type_name === 'SERVICIO TÉCNICO' ||
    Boolean(req.service_type) ||
    String(req.area_id) === '1' ||
    (req.area_name && req.area_name.toUpperCase().includes('SERVICIO TECNICO')) ||
    (req.area_name && req.area_name.toUpperCase().includes('SOPORTE'))
  );
}

