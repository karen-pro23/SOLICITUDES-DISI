-- Migración 014: Agregar relación opcional entre attachments y comentarios
-- Permite adjuntar archivos a comentarios/respuestas

-- Agregar columna comment_id (nullable para compatibilidad con attachments existentes)
ALTER TABLE request_attachments 
ADD COLUMN IF NOT EXISTS comment_id BIGINT REFERENCES request_comments(comment_id) ON DELETE CASCADE;

-- Índice para consultas rápidas de attachments por comentario
CREATE INDEX IF NOT EXISTS idx_attachments_comment ON request_attachments (comment_id);
