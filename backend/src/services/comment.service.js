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
  
  // Obtener attachments para todos los comentarios de esta solicitud
  const comments = result.rows;
  if (comments.length > 0) {
    const commentIds = comments.map(c => c.comment_id);
    let attachmentsResult;
    try {
      attachmentsResult = await pool.query(
        `SELECT * FROM request_attachments WHERE comment_id = ANY($1::bigint[]) ORDER BY uploaded_at`,
        [commentIds]
      );
    } catch (_) {
      // Si la columna comment_id no existe aún (migración 014 no aplicada), devolver vacío
      attachmentsResult = { rows: [] };
    }
    
    // Mapear attachments a cada comentario
    const attachmentsByComment = {};
    for (const att of attachmentsResult.rows) {
      if (!attachmentsByComment[att.comment_id]) {
        attachmentsByComment[att.comment_id] = [];
      }
      attachmentsByComment[att.comment_id].push(att);
    }
    
    for (const comment of comments) {
      comment.attachments = attachmentsByComment[comment.comment_id] || [];
    }
  }
  
  return comments;
}

async function create(requestId, authorId, content, isInternal) {
  // Permitir comentario vacío (solo cambia estado sin comentario)
  const cleanContent = (content || '').trim();

  const result = await pool.query(
    `INSERT INTO request_comments (request_id, author_id, content, is_internal)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [requestId, authorId, cleanContent || null, isInternal || false]
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
