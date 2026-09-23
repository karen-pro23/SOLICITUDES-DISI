-- Migración 017: Sistema de roles y permisos
-- Separa "equipo" de "solicitantes" y agrega roles jerárquicos

-- Actualizar el CHECK constraint de roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'director',           -- Ve todo, configura sistema
    'sub_director',       -- Ve todo, asigna
    'recepcion',          -- Ve todas, asigna áreas
    'jefe_area',          -- Ve las de su área, asigna empleados
    'developer',          -- Ve y resuelve asignadas
    'tecnico',            -- Ve y resuelve asignadas
    'admin',              -- Admin del sistema (legacy)
    'requester'           -- Solicitante (público, auto-creado)
  ));

-- Los requesters NO deben aparecer en gestión de usuarios del equipo
-- Se filtran por role != 'requester' en las queries
