-- =====================================================================
-- Script: Pasar a MAYÚSCULAS los registros de la base solicitudapp
-- Base   : solicitudapp (PostgreSQL, puerto 5433)
-- Fecha  : 2026-08-03
--
-- Qué hace: Aplica UPPER() a todas las columnas de texto de cada tabla
--           que pueden convertirse sin romper la aplicación.
--
-- Qué NO toca y por qué (columnas comentadas al final):
--   - users.password_hash            : hash bcrypt, comparación exacta -> rompe login
--   - refresh_tokens.token_hash      : hash SHA-256 en hex, comparación exacta -> rompe refresh
--   - users.role                     : CHECK (requester|developer|admin) -> viola constraint
--   - requests.priority              : CHECK (baja|media|alta) -> viola constraint
--   - request_attachments.file_type  : CHECK (screenshot|document) -> viola constraint
--   - request_attachments.file_path  : ruta física del archivo en disco -> rompe descarga/borrado
--   - request_attachments.mime_type  : se usa como Content-Type -> valores como IMAGE/PNG
--   - users.email                    : no rompe login (se compara con LOWER()),
--                                      pero es mala práctica (opcional al final)
--
-- El script es idempotente y transaccional: si algo falla, no se aplica nada.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) departments
-- ---------------------------------------------------------------------
UPDATE departments
SET name = UPPER(name)
WHERE name IS DISTINCT FROM UPPER(name);

UPDATE departments
SET code = UPPER(code)
WHERE code IS DISTINCT FROM UPPER(code);

-- ---------------------------------------------------------------------
-- 3) modules
-- ---------------------------------------------------------------------
UPDATE modules
SET name = UPPER(name)
WHERE name IS DISTINCT FROM UPPER(name);

UPDATE modules
SET description = UPPER(description)
WHERE description IS DISTINCT FROM UPPER(description);

-- ---------------------------------------------------------------------
-- 4) request_types
-- ---------------------------------------------------------------------
UPDATE request_types
SET name = UPPER(name)
WHERE name IS DISTINCT FROM UPPER(name);

UPDATE request_types
SET code = UPPER(code)
WHERE code IS DISTINCT FROM UPPER(code);

-- ---------------------------------------------------------------------
-- 5) requests
--    (ticket_code y status ya están en mayúsculas: UPDATE no-op)
-- ---------------------------------------------------------------------
UPDATE requests
SET ticket_code = UPPER(ticket_code)
WHERE ticket_code IS DISTINCT FROM UPPER(ticket_code);

UPDATE requests
SET status = UPPER(status)
WHERE status IS DISTINCT FROM UPPER(status);

UPDATE requests
SET process_description = UPPER(process_description)
WHERE process_description IS DISTINCT FROM UPPER(process_description);

UPDATE requests
SET current_behavior = UPPER(current_behavior)
WHERE current_behavior IS DISTINCT FROM UPPER(current_behavior);

UPDATE requests
SET expected_behavior = UPPER(expected_behavior)
WHERE expected_behavior IS DISTINCT FROM UPPER(expected_behavior);

UPDATE requests
SET rejection_reason = UPPER(rejection_reason)
WHERE rejection_reason IS DISTINCT FROM UPPER(rejection_reason);

UPDATE requests
SET resolution_notes = UPPER(resolution_notes)
WHERE resolution_notes IS DISTINCT FROM UPPER(resolution_notes);

-- ---------------------------------------------------------------------
-- 6) request_attachments
--    (file_name es solo nombre de visualización; el archivo físico
--     se resuelve por file_path, que NO se toca)
-- ---------------------------------------------------------------------
UPDATE request_attachments
SET file_name = UPPER(file_name)
WHERE file_name IS DISTINCT FROM UPPER(file_name);

-- ---------------------------------------------------------------------
-- 7) request_status_history
--    (from_status/to_status ya vienen en mayúsculas: UPDATE no-op)
-- ---------------------------------------------------------------------
UPDATE request_status_history
SET from_status = UPPER(from_status)
WHERE from_status IS DISTINCT FROM UPPER(from_status);

UPDATE request_status_history
SET to_status = UPPER(to_status)
WHERE to_status IS DISTINCT FROM UPPER(to_status);

UPDATE request_status_history
SET comment = UPPER(comment)
WHERE comment IS DISTINCT FROM UPPER(comment);

-- ---------------------------------------------------------------------
-- 8) request_comments
-- ---------------------------------------------------------------------
UPDATE request_comments
SET content = UPPER(content)
WHERE content IS DISTINCT FROM UPPER(content);

COMMIT;

-- =====================================================================
-- OPCIONAL — Columnas excluidas por seguridad
-- Descomenta SOLO si entiendes el impacto.
-- =====================================================================

-- BEGIN;
-- UPDATE users SET email = UPPER(email)
--   WHERE email IS DISTINCT FROM UPPER(email);
-- COMMIT;

-- NOTA: Las siguientes columnas NO se pueden pasar a mayúsculas sin
-- redefinir antes sus CHECK constraints (role, priority, file_type) o
-- sin romper la autenticación (password_hash, token_hash) y el acceso
-- a archivos (file_path, mime_type).
-- Si realmente las necesitas, primero ajusta constraints y lógica.
