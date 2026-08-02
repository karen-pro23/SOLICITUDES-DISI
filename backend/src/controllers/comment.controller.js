const commentService = require('../services/comment.service');
const requestService = require('../services/request.service');

async function getAll(req, res, next) {
  try {
    const comments = await commentService.getByRequest(
      parseInt(req.params.id, 10),
      req.user.role
    );
    res.json({ comments });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const { content, isInternal } = req.body;

    // Verificar acceso a la solicitud
    const request = await requestService.findById(
      parseInt(req.params.id, 10),
      req.user.role,
      req.user.departmentId
    );
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    // Solo admin/developer pueden crear comentarios internos
    if (isInternal && req.user.role === 'requester') {
      return res.status(403).json({ error: 'No puedes crear comentarios internos' });
    }

    const comment = await commentService.create(
      parseInt(req.params.id, 10),
      req.user.userId,
      content,
      isInternal
    );
    res.status(201).json({ comment });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

module.exports = { getAll, create };
