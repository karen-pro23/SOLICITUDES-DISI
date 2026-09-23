-- Migración 022: Campos de Servicio Técnico en requests
-- Agrega campos necesarios para el flujo de servicio técnico

-- Datos del solicitante (ya existen en la tabla persona, pero se agregan por si no se usa persona)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS extension TEXT;

-- Tiempos de servicio
ALTER TABLE requests ADD COLUMN IF NOT EXISTS service_start_time TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS service_close_time TIMESTAMPTZ;

-- Tipo de servicio prestado
ALTER TABLE requests ADD COLUMN IF NOT EXISTS service_type TEXT;

-- Observaciones de cierre y conformidad
ALTER TABLE requests ADD COLUMN IF NOT EXISTS close_observations TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS satisfaction TEXT CHECK (satisfaction IN ('satisfecho', 'no_satisfecho', NULL));

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_requests_service_type ON requests (service_type);
CREATE INDEX IF NOT EXISTS idx_requests_satisfaction ON requests (satisfaction);
