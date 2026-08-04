-- 010_remove_department_from_persona.sql
-- Quita department_id de la tabla persona (no es dato de persona)

ALTER TABLE persona DROP COLUMN IF EXISTS department_id;
