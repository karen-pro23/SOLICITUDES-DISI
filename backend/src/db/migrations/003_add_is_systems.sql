-- Migration 003: Agregar columna is_systems a modules
-- Permite identificar qué módulos pertenecen al área de Sistemas
-- para el triaje automático en la bandeja de recepción del equipo de desarrollo.

ALTER TABLE modules
  ADD COLUMN IF NOT EXISTS is_systems BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_modules_is_systems ON modules (is_systems);
