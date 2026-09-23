-- Migración 019: Agregar rol super_admin
-- Superadmin ve TODO sin restricciones

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'super_admin',        -- Ve y hace TODO sin restricciones
    'director',           -- Ve todo, configura sistema
    'sub_director',       -- Ve todo, asigna
    'recepcion',          -- Ve todas, asigna áreas
    'jefe_area',          -- Ve las de su área, asigna empleados
    'developer',          -- Ve y resuelve asignadas
    'tecnico',            -- Ve y resuelve asignadas
    'admin',              -- Admin del sistema (legacy)
    'requester'           -- Solicitante (público, auto-creado)
  ));
