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
            d.name as department_name, u.area_id, a.name as area_name,
            u.is_active, u.es_jefe, u.created_at
     FROM users u
     LEFT JOIN departments d ON d.department_id = u.department_id
     LEFT JOIN areas a ON a.area_id = u.area_id
     WHERE u.role != 'requester'
     ORDER BY u.created_at DESC`
  );
  return result.rows;
}

async function findById(userId) {
  const result = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.role, u.department_id,
            d.name as department_name, u.is_active, u.es_jefe, u.created_at
     FROM users u
     LEFT JOIN departments d ON d.department_id = u.department_id
     WHERE u.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

async function getByDepartment(departmentId) {
  const result = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.role, u.department_id,
            d.name as department_name, u.is_active, u.es_jefe, u.created_at
     FROM users u
     LEFT JOIN departments d ON d.department_id = u.department_id
     WHERE u.department_id = $1 AND u.is_active = true
     ORDER BY u.full_name ASC`,
    [departmentId]
  );
  return result.rows;
}

async function getByArea(areaId) {
  const result = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.role, u.department_id, u.area_id,
            d.name as department_name, a.name as area_name, u.is_active, u.es_jefe, u.created_at
     FROM users u
     LEFT JOIN departments d ON d.department_id = u.department_id
     LEFT JOIN areas a ON a.area_id = u.area_id
     WHERE u.area_id = $1 AND u.is_active = true
     ORDER BY u.full_name ASC`,
    [areaId]
  );
  return result.rows;
}

async function create(data) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, department_id, es_jefe)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING user_id, full_name, email, role, department_id, es_jefe, is_active, created_at`,
    [normalizeText(data.fullName), data.email.toLowerCase().trim(), passwordHash, data.role, data.departmentId || null, data.es_jefe || false]
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
  if (data.departmentId !== undefined) { fields.push(`department_id = $${idx++}`); values.push(data.departmentId || null); }
  if (data.es_jefe !== undefined) { fields.push(`es_jefe = $${idx++}`); values.push(data.es_jefe); }
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
     RETURNING user_id, full_name, email, role, department_id, es_jefe, is_active, created_at`,
    values
  );
  return result.rows[0];
}

async function remove(userId) {
  await pool.query('DELETE FROM users WHERE user_id = $1', [userId]);
}

module.exports = { findAll, findById, getByDepartment, getByArea, create, update, remove };
