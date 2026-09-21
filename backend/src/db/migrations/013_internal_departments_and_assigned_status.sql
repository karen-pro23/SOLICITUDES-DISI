-- Add is_it flag to departments to identify internal systems departments
ALTER TABLE departments ADD COLUMN IF NOT EXISTS is_it BOOLEAN DEFAULT FALSE;

-- Add ASIGNADA to requests status
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;
ALTER TABLE requests ADD CONSTRAINT requests_status_check CHECK (status IN ('PENDIENTE', 'RECHAZADA', 'EN_PROCESO', 'EN_PRUEBAS', 'COMPLETADA', 'ASIGNADA'));
