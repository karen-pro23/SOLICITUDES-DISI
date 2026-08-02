const requestService = require('../services/request.service');
const fileService = require('../services/file.service');
const commentService = require('../services/comment.service');
const pool = require('../db/pool');

async function getAll(req, res, next) {
  try {
    const result = await requestService.findAll(
      req.query,
      req.user.userId,
      req.user.role,
      req.user.departmentId
    );
    res.json(result);
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const request = await requestService.findById(
      parseInt(req.params.id, 10),
      req.user.role,
      req.user.departmentId
    );
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    const [attachments, history, comments] = await Promise.all([
      requestService.getAttachments(request.request_id),
      requestService.getHistory(request.request_id),
      commentService.getByRequest(request.request_id, req.user.role),
    ]);

    res.json({ request, attachments, history, comments });
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const data = {
      moduleId: parseInt(req.body.moduleId, 10),
      requestTypeId: parseInt(req.body.requestTypeId, 10),
      priority: req.body.priority,
      processDescription: req.body.processDescription,
      currentBehavior: req.body.currentBehavior,
      expectedBehavior: req.body.expectedBehavior,
    };

    // Validar campos obligatorios
    if (!data.processDescription || !data.currentBehavior || !data.expectedBehavior) {
      return res.status(400).json({ error: 'Todos los campos de contexto son obligatorios' });
    }

    const request = await requestService.create(data, req.user.userId, req.user.departmentId);

    // Procesar archivos si vienen
    const attachments = [];
    if (req.files) {
      for (const file of req.files) {
        const fileType = file.fieldname === 'screenshots' ? 'screenshot' : 'document';
        try {
          const attachment = await fileService.saveAttachment(request.request_id, file, fileType);
          attachments.push(attachment);
        } catch (err) {
          console.error('Error saving attachment:', err.message);
        }
      }
    }

    res.status(201).json({ request, attachments });
  } catch (err) { next(err); }
}

async function updateStatus(req, res, next) {
  try {
    const { status, rejectionReason } = req.body;
    if (!status) return res.status(400).json({ error: 'Estado requerido' });

    const request = await requestService.updateStatus(
      parseInt(req.params.id, 10),
      status,
      rejectionReason,
      req.user.userId,
      req.user.role,
      req.user.departmentId
    );
    res.json({ request });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function assign(req, res, next) {
  try {
    const { assigneeId } = req.body;
    if (!assigneeId) return res.status(400).json({ error: 'Asignado requerido' });

    const request = await requestService.assign(
      parseInt(req.params.id, 10),
      parseInt(assigneeId, 10),
      req.user.role,
      req.user.departmentId
    );
    res.json({ request });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
}

async function getAttachmentDownload(req, res, next) {
  try {
    const attachment = await fileService.getAttachment(parseInt(req.params.fileId, 10));
    if (!attachment) return res.status(404).json({ error: 'Archivo no encontrado' });

    // Verificar acceso a la solicitud
    const request = await requestService.findById(
      attachment.request_id,
      req.user.role,
      req.user.departmentId
    );
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    res.download(attachment.file_path, attachment.file_name, {
      headers: {
        'Content-Disposition': `attachment; filename="${attachment.file_name}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) { next(err); }
}

async function deleteAttachment(req, res, next) {
  try {
    const attachment = await fileService.deleteAttachment(parseInt(req.params.fileId, 10));
    if (!attachment) return res.status(404).json({ error: 'Archivo no encontrado' });

    // Verificar acceso
    const request = await requestService.findById(
      attachment.request_id,
      req.user.role,
      req.user.departmentId
    );
    if (!request) return res.status(404).json({ error: 'Solicitud no encontrada' });

    res.json({ message: 'Archivo eliminado' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, updateStatus, assign, getAttachmentDownload, deleteAttachment };
