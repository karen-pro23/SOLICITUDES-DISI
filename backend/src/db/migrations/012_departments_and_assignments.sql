-- Modify departments table to include description if it doesn't have one
ALTER TABLE departments ADD COLUMN IF NOT EXISTS description TEXT;

-- Update users table: make department_id nullable and add es_jefe
ALTER TABLE users ALTER COLUMN department_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS es_jefe BOOLEAN DEFAULT FALSE;

-- Update requests table: add assigned_department_id (assigned_to already exists)
ALTER TABLE requests ADD COLUMN IF NOT EXISTS assigned_department_id BIGINT REFERENCES departments(department_id) ON DELETE SET NULL;
