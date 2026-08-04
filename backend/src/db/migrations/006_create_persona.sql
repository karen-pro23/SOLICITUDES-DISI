-- 006_create_persona.sql
-- Tabla de personas con cédula como identificador único
-- Todos los campos de texto se almacenan en mayúsculas automáticamente

CREATE TABLE IF NOT EXISTS persona (
  cedula VARCHAR(20) PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_persona_nombre ON persona (nombre);
CREATE INDEX IF NOT EXISTS idx_persona_apellido ON persona (apellido);

-- Trigger para convertir a mayúsculas antes de insertar o actualizar
CREATE OR REPLACE FUNCTION uppercase_persona_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cedula := UPPER(TRIM(NEW.cedula));
  NEW.nombre := UPPER(TRIM(NEW.nombre));
  NEW.apellido := UPPER(TRIM(NEW.apellido));
  NEW.email := LOWER(TRIM(NEW.email));
  NEW.telefono := UPPER(TRIM(COALESCE(NEW.telefono, '')));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_persona_uppercase ON persona;
CREATE TRIGGER trg_persona_uppercase
  BEFORE INSERT OR UPDATE ON persona
  FOR EACH ROW
  EXECUTE FUNCTION uppercase_persona_fields();
