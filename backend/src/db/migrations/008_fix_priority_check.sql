-- 008_fix_priority_check.sql
-- Actualiza la restricción check de prioridad en requests para que acepte variaciones de mayúsculas/minúsculas y espacios

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_priority_check;
ALTER TABLE requests ADD CONSTRAINT requests_priority_check CHECK (LOWER(TRIM(priority)) IN ('baja', 'media', 'alta'));

-- Actualizar trigger de solicitudes para asegurar que priority sea minúscula y campos opcionales no fallen
CREATE OR REPLACE FUNCTION uppercase_requests_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.process_description := UPPER(TRIM(NEW.process_description));
  NEW.current_behavior := UPPER(TRIM(NEW.current_behavior));
  NEW.expected_behavior := UPPER(TRIM(NEW.expected_behavior));
  IF NEW.rejection_reason IS NOT NULL THEN
    NEW.rejection_reason := UPPER(TRIM(NEW.rejection_reason));
  END IF;
  IF NEW.resolution_notes IS NOT NULL THEN
    NEW.resolution_notes := UPPER(TRIM(NEW.resolution_notes));
  END IF;
  IF NEW.priority IS NOT NULL THEN
    NEW.priority := LOWER(TRIM(NEW.priority));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
