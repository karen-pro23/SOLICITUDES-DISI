const pool = require('../db/pool');

async function getByDepartment(departmentId) {
  const result = await pool.query(
    `SELECT a.*, 
            COUNT(u.user_id) as member_count,
            u.full_name as leader_name
     FROM areas a
     LEFT JOIN users u ON u.area_id = a.area_id AND u.es_jefe = TRUE
     WHERE a.department_id = $1
     GROUP BY a.area_id, u.full_name
     ORDER BY a.name`,
    [departmentId]
  );
  return result.rows;
}

async function getById(areaId) {
  const result = await pool.query(
    `SELECT a.*, d.name as department_name
     FROM areas a
     JOIN departments d ON d.department_id = a.department_id
     WHERE a.area_id = $1`,
    [areaId]
  );
  return result.rows[0] || null;
}

async function create(departmentId, name, description) {
  const result = await pool.query(
    `INSERT INTO areas (department_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [departmentId, name.toUpperCase(), description]
  );
  return result.rows[0];
}

async function update(areaId, name, description, isActive) {
  const result = await pool.query(
    `UPDATE areas 
     SET name = COALESCE($2, name),
         description = COALESCE($3, description),
         is_active = COALESCE($4, is_active)
     WHERE area_id = $1
     RETURNING *`,
    [areaId, name?.toUpperCase(), description, isActive]
  );
  return result.rows[0] || null;
}

async function remove(areaId) {
  // Verificar que no haya usuarios en el área
  const usersResult = await pool.query(
    'SELECT COUNT(*) as count FROM users WHERE area_id = $1',
    [areaId]
  );
  if (parseInt(usersResult.rows[0].count) > 0) {
    throw Object.assign(new Error('No se puede eliminar: hay usuarios asignados al área'), { status: 400 });
  }

  // Verificar que no haya solicitudes asignadas al área
  const requestsResult = await pool.query(
    'SELECT COUNT(*) as count FROM requests WHERE area_id = $1',
    [areaId]
  );
  if (parseInt(requestsResult.rows[0].count) > 0) {
    throw Object.assign(new Error('No se puede eliminar: hay solicitudes asignadas al área'), { status: 400 });
  }

  await pool.query('DELETE FROM areas WHERE area_id = $1', [areaId]);
  return true;
}

async function getAreasByUser(userId) {
  const result = await pool.query(
    `SELECT a.*, d.name as department_name
     FROM areas a
     JOIN departments d ON d.department_id = a.department_id
     WHERE a.area_id IN (
       SELECT area_id FROM users WHERE user_id = $1
       UNION
       SELECT area_id FROM users WHERE department_id = (
         SELECT department_id FROM users WHERE user_id = $1
       ) AND es_jefe_departamento = TRUE
     )
     ORDER BY a.name`,
    [userId]
  );
  return result.rows;
}

module.exports = { getByDepartment, getById, create, update, remove, getAreasByUser };
