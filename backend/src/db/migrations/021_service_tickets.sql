-- Migración 021: Tabla de servicio técnico
-- Sistema de seguimiento de atención técnica con tiempos de respuesta

CREATE TABLE IF NOT EXISTS service_tickets (
  ticket_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_code TEXT NOT NULL UNIQUE,
  
  -- Datos del solicitante
  requester_name TEXT NOT NULL,
  requester_cedula TEXT,
  requester_position TEXT,
  department_name TEXT,
  extension TEXT,
  
  -- Descripción del requerimiento
  description TEXT NOT NULL,
  assigned_area TEXT,
  observations TEXT,
  
  -- Técnico y servicio
  service_type TEXT,
  technician_id BIGINT REFERENCES users(user_id),
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'EN_PROCESO', 'CERRADA')),
  
  -- Tiempos
  start_time TIMESTAMPTZ,
  close_time TIMESTAMPTZ,
  close_observations TEXT,
  
  -- Conformidad
  satisfaction TEXT CHECK (satisfaction IN ('satisfecho', 'no_satisfecho', NULL)),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_tickets_status ON service_tickets (status);
CREATE INDEX IF NOT EXISTS idx_service_tickets_code ON service_tickets (ticket_code);
CREATE INDEX IF NOT EXISTS idx_service_tickets_technician ON service_tickets (technician_id);

-- Generar secuencia de códigos
CREATE SEQUENCE IF NOT EXISTS service_ticket_seq START 1;
