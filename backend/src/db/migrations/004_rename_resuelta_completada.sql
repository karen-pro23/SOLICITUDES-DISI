-- Renombrar el estado RESUELTA -> COMPLETADA en solicitudapp
-- Idempotente: run-migrations.js re-ejecuta todos los .sql sin tracking.

UPDATE requests SET status = 'COMPLETADA' WHERE status = 'RESUELTA';

UPDATE request_status_history SET to_status = 'COMPLETADA' WHERE to_status = 'RESUELTA';
UPDATE request_status_history SET from_status = 'COMPLETADA' WHERE from_status = 'RESUELTA';

ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE requests ADD CONSTRAINT requests_status_check
  CHECK (status IN ('PENDIENTE','RECHAZADA','EN_PROCESO','EN_PRUEBAS','COMPLETADA'));
