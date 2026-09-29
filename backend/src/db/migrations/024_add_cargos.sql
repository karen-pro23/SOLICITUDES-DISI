-- Migración 024: Catálogo de cargos + campo de cargo en solicitante y ticket
-- Espeja el patrón de departments: tabla de catálogo con endpoint público.
-- Idempotente: el runner de migraciones NO lleva tabla de control, por lo que
-- este archivo se re-ejecuta en cada `npm run migrate`.

-- Catálogo de cargos (solo se siembra el cargo que ya existe en el sistema)
CREATE TABLE IF NOT EXISTS cargos (
  cargo_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Único cargo existente en el código (mismo valor que el fallback del PDF de
-- servicio técnico en serviceTicketPdf.service.js). No se inventan otros.
INSERT INTO cargos (name)
VALUES ('SECRETARIO EJECUTIVO I')
ON CONFLICT (name) DO NOTHING;

-- Cargo actual del solicitante: fuente para el prefill al buscar por cédula.
ALTER TABLE persona ADD COLUMN IF NOT EXISTS position TEXT;

-- Snapshot histórico del cargo al momento de registrar la solicitud.
-- El nombre de la columna sigue el contrato del PDF (ticket.position).
ALTER TABLE requests ADD COLUMN IF NOT EXISTS position TEXT;

-- Sin índices en position a propósito: nadie filtra ni ordena por cargo, y en
-- tablas de alta frecuencia los índices sin acceso de lectura solo encarecen
-- los INSERT/actualización.
