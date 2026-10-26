-- Migración 027: Adaptar requests y request_types para Servicio Técnico
-- Idempotente: run-migrations.js no lleva tabla de control y se re-ejecuta.

-- 1. Permitir que module_id y department_id sean NULL (en servicio técnico no hay módulo de desarrollo)
ALTER TABLE requests ALTER COLUMN module_id DROP NOT NULL;
ALTER TABLE requests ALTER COLUMN department_id DROP NOT NULL;

-- 2. Asegurar que el trigger no sobreescriba el ticket_code si ya viene establecido (ej: ST-YYYY-XXXX)
CREATE OR REPLACE FUNCTION generate_ticket_code()
RETURNS TRIGGER AS $$
DECLARE
  year_prefix TEXT := to_char(now(), 'YYYY');
  seq_num     TEXT;
BEGIN
  IF NEW.ticket_code IS NULL OR TRIM(NEW.ticket_code) = '' THEN
    seq_num := LPAD(nextval('ticket_seq')::TEXT, 3, '0');
    NEW.ticket_code := 'SOL-' || year_prefix || '-' || seq_num;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Asegurar secuencia para códigos de servicio técnico
CREATE SEQUENCE IF NOT EXISTS service_ticket_seq START 1;

-- 4. Insertar request_type_id = 8 para Servicio Técnico si no existe
INSERT INTO request_types (request_type_id, name, code, requires_screenshot, requires_document)
OVERRIDING SYSTEM VALUE
VALUES (8, 'SERVICIO TÉCNICO', 'ST', FALSE, FALSE)
ON CONFLICT (request_type_id) DO UPDATE
  SET name = EXCLUDED.name, code = EXCLUDED.code;

-- Sincronizar secuencia de request_types para evitar colisiones
SELECT setval(
  pg_get_serial_sequence('request_types', 'request_type_id'),
  GREATEST((SELECT COALESCE(MAX(request_type_id), 1) FROM request_types), 8)
);
