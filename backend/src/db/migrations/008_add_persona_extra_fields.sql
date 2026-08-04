-- 008_add_persona_extra_fields.sql
-- Agrega campos adicionales a persona para guardar todos los datos del solicitante

ALTER TABLE persona ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE persona ADD COLUMN IF NOT EXISTS telefono VARCHAR(50);
ALTER TABLE persona ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(department_id);
