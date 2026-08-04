-- 007_uppercase_all_text_fields.sql
-- Trigger para guardar TODOS los campos de texto en mayúsculas automáticamente
-- Aplicado a: users, requests, request_comments, modules, departments, request_types

-- ============ USERS ============
CREATE OR REPLACE FUNCTION uppercase_users_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.full_name := UPPER(TRIM(NEW.full_name));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_uppercase ON users;
CREATE TRIGGER trg_users_uppercase
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION uppercase_users_fields();

-- ============ REQUESTS ============
CREATE OR REPLACE FUNCTION uppercase_requests_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.process_description := UPPER(TRIM(NEW.process_description));
  NEW.current_behavior := UPPER(TRIM(NEW.current_behavior));
  NEW.expected_behavior := UPPER(TRIM(NEW.expected_behavior));
  NEW.rejection_reason := UPPER(TRIM(NEW.rejection_reason));
  NEW.resolution_notes := UPPER(TRIM(NEW.resolution_notes));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_requests_uppercase ON requests;
CREATE TRIGGER trg_requests_uppercase
  BEFORE INSERT OR UPDATE ON requests
  FOR EACH ROW EXECUTE FUNCTION uppercase_requests_fields();

-- ============ REQUEST_COMMENTS ============
CREATE OR REPLACE FUNCTION uppercase_comments_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.content := UPPER(TRIM(NEW.content));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comments_uppercase ON request_comments;
CREATE TRIGGER trg_comments_uppercase
  BEFORE INSERT OR UPDATE ON request_comments
  FOR EACH ROW EXECUTE FUNCTION uppercase_comments_fields();

-- ============ MODULES ============
CREATE OR REPLACE FUNCTION uppercase_modules_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := UPPER(TRIM(NEW.name));
  NEW.description := UPPER(TRIM(NEW.description));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_modules_uppercase ON modules;
CREATE TRIGGER trg_modules_uppercase
  BEFORE INSERT OR UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION uppercase_modules_fields();

-- ============ DEPARTMENTS ============
CREATE OR REPLACE FUNCTION uppercase_departments_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := UPPER(TRIM(NEW.name));
  NEW.code := UPPER(TRIM(NEW.code));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_departments_uppercase ON departments;
CREATE TRIGGER trg_departments_uppercase
  BEFORE INSERT OR UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION uppercase_departments_fields();

-- ============ REQUEST_TYPES ============
CREATE OR REPLACE FUNCTION uppercase_request_types_fields()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := UPPER(TRIM(NEW.name));
  NEW.code := UPPER(TRIM(NEW.code));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_request_types_uppercase ON request_types;
CREATE TRIGGER trg_request_types_uppercase
  BEFORE INSERT OR UPDATE ON request_types
  FOR EACH ROW EXECUTE FUNCTION uppercase_request_types_fields();
