CREATE TABLE IF NOT EXISTS departments (
  department_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  user_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('requester', 'developer', 'admin')),
  department_id BIGINT NOT NULL REFERENCES departments(department_id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_department ON users (department_id);

CREATE TABLE IF NOT EXISTS modules (
  module_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_types (
  request_type_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  requires_screenshot BOOLEAN NOT NULL DEFAULT TRUE,
  requires_document BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requests (
  request_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ticket_code TEXT NOT NULL UNIQUE,
  created_by BIGINT NOT NULL REFERENCES users(user_id),
  department_id BIGINT NOT NULL REFERENCES departments(department_id),
  module_id BIGINT NOT NULL REFERENCES modules(module_id),
  request_type_id BIGINT NOT NULL REFERENCES request_types(request_type_id),
  priority TEXT NOT NULL DEFAULT 'media' CHECK (priority IN ('baja', 'media', 'alta')),
  process_description TEXT NOT NULL,
  current_behavior TEXT NOT NULL,
  expected_behavior TEXT NOT NULL,
  assigned_to BIGINT REFERENCES users(user_id),
  status TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE','RECHAZADA','EN_PROCESO','EN_PRUEBAS','RESUELTA')),
  rejection_reason TEXT,
  resolution_notes TEXT,
  version_number INT NOT NULL DEFAULT 1,
  estimated_at DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_creator ON requests (created_by);
CREATE INDEX IF NOT EXISTS idx_requests_assigned ON requests (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_module ON requests (module_id);
CREATE INDEX IF NOT EXISTS idx_requests_department ON requests (department_id);

CREATE TABLE IF NOT EXISTS request_attachments (
  attachment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES requests(request_id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('screenshot', 'document')),
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_request ON request_attachments (request_id);

CREATE TABLE IF NOT EXISTS request_status_history (
  history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES requests(request_id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by BIGINT NOT NULL REFERENCES users(user_id),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_history_request ON request_status_history (request_id, created_at DESC);

CREATE TABLE IF NOT EXISTS request_comments (
  comment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id BIGINT NOT NULL REFERENCES requests(request_id) ON DELETE CASCADE,
  author_id BIGINT NOT NULL REFERENCES users(user_id),
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_request ON request_comments (request_id, created_at);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  family_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_family ON refresh_tokens (family_id);
