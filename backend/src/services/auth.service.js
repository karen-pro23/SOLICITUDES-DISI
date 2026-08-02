const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');
const config = require('../config/env');

async function login(email, password) {
  const result = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.password_hash, u.role, u.department_id, d.name as department_name
     FROM users u
     JOIN departments d ON d.department_id = u.department_id
     WHERE LOWER(u.email) = LOWER($1) AND u.is_active = true`,
    [email]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Credenciales inválidas'), { status: 401 });
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw Object.assign(new Error('Credenciales inválidas'), { status: 401 });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = await generateRefreshToken(user.user_id);

  return {
    accessToken,
    refreshToken,
    user: {
      userId: user.user_id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      departmentId: user.department_id,
      departmentName: user.department_name,
    },
  };
}

function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.user_id,
      email: user.email,
      role: user.role,
      departmentId: user.department_id,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

async function generateRefreshToken(userId) {
  const familyId = crypto.randomUUID();
  const tokenValue = crypto.randomBytes(64).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, familyId, tokenHash, expiresAt]
  );

  return { token: tokenValue, familyId, expiresAt };
}

async function refresh(refreshTokenValue) {
  const tokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');

  const result = await pool.query(
    `SELECT rt.*, u.email, u.role, u.department_id, u.user_id, u.full_name
     FROM refresh_tokens rt
     JOIN users u ON u.user_id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.is_revoked = false AND rt.expires_at > now()`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Token de refresco inválido'), { status: 401 });
  }

  const tokenRecord = result.rows[0];

  // Rotar: revocar el actual
  await pool.query(
    `UPDATE refresh_tokens SET is_revoked = true WHERE token_id = $1`,
    [tokenRecord.token_id]
  );

  // Generar nuevo token en la misma familia
  const newTokenValue = crypto.randomBytes(64).toString('hex');
  const newTokenHash = crypto.createHash('sha256').update(newTokenValue).digest('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [tokenRecord.user_id, tokenRecord.family_id, newTokenHash, expiresAt]
  );

  const accessToken = generateAccessToken({
    user_id: tokenRecord.user_id,
    email: tokenRecord.email,
    role: tokenRecord.role,
    department_id: tokenRecord.department_id,
  });

  return {
    accessToken,
    refreshToken: { token: newTokenValue, familyId: tokenRecord.family_id, expiresAt },
  };
}

async function logout(refreshTokenValue) {
  const tokenHash = crypto.createHash('sha256').update(refreshTokenValue).digest('hex');

  const result = await pool.query(
    `SELECT family_id FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );

  if (result.rows.length > 0) {
    const { family_id } = result.rows[0];
    // Revocar toda la familia (detección de robo)
    await pool.query(
      `UPDATE refresh_tokens SET is_revoked = true WHERE family_id = $1`,
      [family_id]
    );
  }
}

function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

async function getUserById(userId) {
  const result = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.role, u.department_id, d.name as department_name
     FROM users u
     JOIN departments d ON d.department_id = u.department_id
     WHERE u.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

module.exports = { login, refresh, logout, verifyAccessToken, getUserById, generateAccessToken };
