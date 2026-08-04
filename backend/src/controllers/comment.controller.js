const commentService = require('../services/comment.service');
const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const requestId = parseInt(req.params.id, 10);
    const comments = await commentService.getByRequest(requestId, req.user.role);
    res.json({ comments });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { content, isInternal } = req.body;

    // Verificar que la solicitud existe
    const result = await pool.query(
      'SELECT request_id FROM requests WHERE request_id = $1',
      [requestId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Solo admin/developer pueden crear comentarios internos
    if (isInternal && req.user.role === 'requester') {
      return res.status(403).json({ error: 'No puedes crear comentarios internos' });
    }

    const comment = await commentService.create(requestId, req.user.userId, content, isInternal);
    res.status(201).json({ comment });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = { getAll, create };
