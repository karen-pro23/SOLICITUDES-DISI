-- 011_add_cedula_to_users.sql
-- Agrega cédula a users para vincular directamente con persona

ALTER TABLE users ADD COLUMN IF NOT EXISTS cedula VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_users_cedula ON users (cedula);

-- Vincular usuarios requester existentes con persona por nombre
UPDATE users u
SET cedula = p.cedula
FROM persona p
WHERE u.role = 'requester'
  AND UPPER(TRIM(u.full_name)) = UPPER(TRIM(CONCAT(p.nombre, ' ', p.apellido)))
  AND u.cedula IS NULL;
