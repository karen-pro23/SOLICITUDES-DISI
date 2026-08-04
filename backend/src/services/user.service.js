const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

// Normaliza texto: elimina acentos y convierte a mayúsculas
function normalizeText(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

async function findAll() {
  const result = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.role, u.department_id,
            d.name as department_name, u.is_active, u.created_at
     FROM users u
     JOIN departments d ON d.department_id = u.department_id
     ORDER BY u.created_at DESC`
  );
  return result.rows;
}

async function findById(userId) {
  const result = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.role, u.department_id,
            d.name as department_name, u.is_active, u.created_at
     FROM users u
     JOIN departments d ON d.department_id = u.department_id
     WHERE u.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function create(data) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, department_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING user_id, full_name, email, role, department_id, is_active, created_at`,
    [normalizeText(data.fullName), data.email.toLowerCase().trim(), passwordHash, data.role, data.departmentId]
  );
  return result.rows[0];
}

async function update(userId, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  if (data.fullName) { fields.push(`full_name = $${idx++}`); values.push(normalizeText(data.fullName)); }
  if (data.email) { fields.push(`email = $${idx++}`); values.push(data.email.toLowerCase().trim()); }
  if (data.role) { fields.push(`role = $${idx++}`); values.push(data.role); }
  if (data.departmentId) { fields.push(`department_id = $${idx++}`); values.push(data.departmentId); }
  if (data.isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(data.isActive); }
  if (data.password) {
    const hash = await bcrypt.hash(data.password, 10);
    fields.push(`password_hash = $${idx++}`);
    values.push(hash);
  }

  if (fields.length === 0) return findById(userId);

  values.push(userId);
  const result = await pool.query(
    `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${idx}
     RETURNING user_id, full_name, email, role, department_id, is_active, created_at`,
    values
  );
  return result.rows[0];
}

async function remove(userId) {
  await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
}

module.exports = { findAll, findById, create, update, remove };
