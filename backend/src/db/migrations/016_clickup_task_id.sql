-- Migración 016: Agregar clickup_task_id a requests
-- Almacena el ID de la tarea de ClickUp asociada a cada solicitud

ALTER TABLE requests ADD COLUMN IF NOT EXISTS clickup_task_id TEXT;
