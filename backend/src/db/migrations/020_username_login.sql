-- Migración 020: Campo username para login
-- Los usuarios inician sesión con username en vez de email

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (LOWER(username));

-- Generar usernames iniciales a partir del email (parte antes de @)
UPDATE users SET username = LOWER(SPLIT_PART(email, '@', 1)) WHERE username IS NULL;
