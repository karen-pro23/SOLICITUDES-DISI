const serviceTicketService = require('../services/serviceTicket.service');
const fileService = require('../services/file.service');

// Autenticado: listar solicitudes de servicio técnico
async function findAll(req, res, next) {
  try {
    const result = await serviceTicketService.findAll(req.query);
    res.json(result);
  } catch (err) { next(err); }
}

// Autenticado: ver por código
async function getByCode(req, res, next) {
  try {
    const ticket = await serviceTicketService.findByCode(req.params.code);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json({ ticket });
  } catch (err) { next(err); }
}

// Autenticado: ver por ID
async function getById(req, res, next) {
  try {
    const ticket = await serviceTicketService.findById(parseInt(req.params.id, 10));
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json({ ticket });
  } catch (err) { next(err); }
}

// Autenticado: aceptar
async function accept(req, res, next) {
  try {
    const ticket = await serviceTicketService.accept(parseInt(req.params.id, 10), req.user.userId);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado o ya atendido' });
    res.json({ ticket });
  } catch (err) { next(err); }
}

// Autenticado: cerrar con archivos
async function close(req, res, next) {
  try {
    const { serviceType, closeObservations } = req.body;
    const ticket = await serviceTicketService.close(parseInt(req.params.id, 10), { serviceType, closeObservations });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado o no está en proceso' });

    // Procesar archivos adjuntos si vienen
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileType = file.mimetype.startsWith('image/') ? 'screenshot' : 'document';
        try {
          const attachment = await fileService.saveAttachment(ticket.request_id, file, fileType);
          attachments.push(attachment);
        } catch (err) {
          console.error('Error saving service ticket attachment:', err.message);
        }
      }
    }

    res.json({ ticket, attachments });
  } catch (err) { next(err); }
}

// Público: calificar
async function rate(req, res, next) {
  try {
    const { satisfaction } = req.body;
    if (!satisfaction || !['satisfecho', 'no_satisfecho'].includes(satisfaction)) {
      return res.status(400).json({ error: 'Calificación inválida' });
    }
    const ticket = await serviceTicketService.rate(req.params.code, satisfaction);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado o no cerrado' });
    res.json({ ticket });
  } catch (err) { next(err); }
}

// Autenticado: estadísticas
async function getStats(req, res, next) {
  try {
    const stats = await serviceTicketService.getStats();
    res.json({ stats });
  } catch (err) { next(err); }
}

// Autenticado: tipos de servicio
async function getServiceTypes(req, res, next) {
  res.json({ serviceTypes: serviceTicketService.SERVICE_TYPES });
}

module.exports = { findAll, getByCode, getById, accept, close, rate, getStats, getServiceTypes };
