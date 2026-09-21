-- Migración 015: Tabla de áreas y jerarquía de jefes
-- Un departamento tiene muchas áreas, cada área tiene un jefe,
-- y el departamento tiene un jefe general

-- Crear tabla de áreas
CREATE TABLE IF NOT EXISTS areas (
  area_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  department_id BIGINT NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(department_id, name)
);

CREATE INDEX IF NOT EXISTS idx_areas_department ON areas (department_id);

-- Agregar area_id a users (nullable, para usuarios que pertenecen a un área)
ALTER TABLE users ADD COLUMN IF NOT EXISTS area_id BIGINT REFERENCES areas(area_id) ON DELETE SET NULL;

-- Agregar is_jefe_departamento a users (para identificar al jefe general del departamento)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_jefe_departamento BOOLEAN DEFAULT FALSE;

-- Crear índice para consultas rápidas de usuarios por área
CREATE INDEX IF NOT EXISTS idx_users_area ON users (area_id);

-- Agregar area_id a requests (nullable, para asignar solicitudes directamente a un área)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS area_id BIGINT REFERENCES areas(area_id) ON DELETE SET NULL;

-- Índice para consultas rápidas de solicitudes por área
CREATE INDEX IF NOT EXISTS idx_requests_area ON requests (area_id);
