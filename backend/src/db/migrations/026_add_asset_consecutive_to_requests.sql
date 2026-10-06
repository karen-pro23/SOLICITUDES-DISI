-- Migración 026: Agregar asset_consecutive a requests para Servicio Técnico / Soporte
ALTER TABLE requests ADD COLUMN IF NOT EXISTS asset_consecutive TEXT;
CREATE INDEX IF NOT EXISTS idx_requests_asset_consecutive ON requests (asset_consecutive);
