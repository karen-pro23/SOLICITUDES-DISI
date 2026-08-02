const pool = require('../db/pool');

async function getByRequest(requestId, userRole) {
  let sql;
  if (userRole === 'admin' || userRole === 'developer') {
    sql = `SELECT c.*, u.full_name as author_name, u.role as author_role
           FROM request_comments c
           JOIN users u ON u.user_id = c.author_id
           WHERE c.request_id = $1
           ORDER BY c.created_at`;
  } else {
    sql = `SELECT c.*, u.full_name as author_name, u.role as author_role
           FROM request_comments c
           JOIN users u ON u.user_id = c.author_id
           WHERE c.request_id = $1 AND c.is_internal = false
           ORDER BY c.created_at`;
  }
  const result = await pool.query(sql, [requestId]);
  return result.rows;
}

async function create(requestId, authorId, content, isInternal) {
  if (!content || content.trim().length === 0) {
    throw Object.assign(new Error('El comentario no puede estar vacío'), { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO request_comments (request_id, author_id, content, is_internal)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [requestId, authorId, content, isInternal || false]
  );

  // Devolver con nombre del autor
  const userResult = await pool.query(
    `SELECT full_name, role FROM users WHERE user_id = $1`,
    [authorId]
  );

  return {
    ...result.rows[0],
    author_name: userResult.rows[0]?.full_name,
    author_role: userResult.rows[0]?.role,
  };
}

module.exports = { getByRequest, create };
