// Opciones y transiciones de estado y prioridad (fuente única)
export const STATUS_OPTIONS = [
  { value: 'PENDIENTE', label: 'PENDIENTE' },
  { value: 'EN_PROCESO', label: 'EN PROCESO' },
  { value: 'EN_PRUEBAS', label: 'EN PRUEBAS' },
  { value: 'COMPLETADA', label: 'COMPLETADA' },
  { value: 'RECHAZADA', label: 'RECHAZADA' },
];

export const STATUS_TRANSITIONS = {
  PENDIENTE: ['EN_PROCESO', 'RECHAZADA'],
  RECHAZADA: ['PENDIENTE'],
  EN_PROCESO: ['EN_PRUEBAS'],
  EN_PRUEBAS: ['COMPLETADA', 'EN_PROCESO'],
  COMPLETADA: [],
};

export const PRIORITY_OPTIONS = [
  { value: 'alta', label: 'ALTA' },
  { value: 'media', label: 'MEDIA' },
  { value: 'baja', label: 'BAJA' },
];
