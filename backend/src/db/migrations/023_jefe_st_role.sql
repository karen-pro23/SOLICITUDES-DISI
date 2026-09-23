-- Migración 023: Rol Jefe de Servicio Técnico
-- Agrega el rol jefe_st para gestionar el módulo de servicio técnico

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'super_admin',        -- Ve y hace TODO sin restricciones
    'director',           -- Ve todo, configura sistema
    'sub_director',       -- Ve todo, asigna
    'recepcion',          -- Ve todas, asigna áreas
    'jefe_area',          -- Ve las de su área, asigna empleados
    'jefe_st',            -- Gestiona servicio técnico: asigna, ve stats
    'developer',          -- Ve y resuelve asignadas
    'tecnico',            -- Ve y resuelve asignadas
    'admin',              -- Admin del sistema (legacy)
    'requester'           -- Solicitante (público, auto-creado)
  ));
