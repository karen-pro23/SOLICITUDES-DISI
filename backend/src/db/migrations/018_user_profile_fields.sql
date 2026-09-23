-- Migración 018: Campos adicionales para usuarios del equipo

-- Datos personales
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS position TEXT;          -- Cargo
ALTER TABLE users ADD COLUMN IF NOT EXISTS start_date DATE;        -- Fecha de ingreso
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;         -- Foto de perfil

-- Índices útiles
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users (is_active);
