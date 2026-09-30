-- Migración 017: Sistema de roles y permisos
-- Separa "equipo" de "solicitantes" y agrega roles jerárquicos
--
-- ESTA ES LA ÚNICA DEFINICIÓN DE users_role_check EN TODO EL REPO.
-- No volver a redefinir el constraint en otra migración.
--
-- Por qué: el runner (run-migrations.js) no lleva tabla de control, así que
-- este archivo se re-ejecuta en cada `npm run migrate`, SIEMPRE PRIMERO por
-- orden de nombre. Antes, 019 y 023 redefinían el mismo CHECK con listas
-- progresivamente más chicas de roles. Como 017 corría antes con solo 8 roles,
-- si existía UN usuario con super_admin o jefe_st el ADD CONSTRAINT violaba el
-- CHECK, abortaba toda la corrida, y las migraciones siguientes (incluida la
-- 024) nunca se aplicaban.
--
-- La lista debe ser SIEMPRE un superconjunto de los roles presentes en la
-- tabla users, en cualquier entorno. Para agregar un rol nuevo: se edita esta
-- lista y nada más.

-- Actualizar el CHECK constraint de roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN (
    'super_admin',        -- Ve y hace TODO sin restricciones (019)
    'director',           -- Ve todo, configura sistema
    'sub_director',       -- Ve todo, asigna
    'recepcion',          -- Ve todas, asigna áreas
    'jefe_area',          -- Ve las de su área, asigna empleados
    'jefe_st',            -- Gestiona servicio técnico: asigna, ve stats (023)
    'developer',          -- Ve y resuelve asignadas
    'tecnico',            -- Ve y resuelve asignadas
    'admin',              -- Admin del sistema (legacy)
    'requester'           -- Solicitante (público, auto-creado)
  ));

-- Los requesters NO deben aparecer en gestión de usuarios del equipo
-- Se filtran por role != 'requester' en las queries
