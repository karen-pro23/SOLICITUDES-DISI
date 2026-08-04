-- 009_add_ai_fields_to_requests.sql
-- Agrega campos de clasificación y respuesta IA a las solicitudes

ALTER TABLE requests ADD COLUMN IF NOT EXISTS ai_priority VARCHAR(20);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS ai_category VARCHAR(50);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS ai_module_suggested VARCHAR(100);
ALTER TABLE requests ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS ai_generated_response TEXT;

CREATE INDEX IF NOT EXISTS idx_requests_ai_priority ON requests (ai_priority);
CREATE INDEX IF NOT EXISTS idx_requests_ai_category ON requests (ai_category);
