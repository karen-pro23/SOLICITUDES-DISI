const serviceTicketService = require('../services/serviceTicket.service');
const fileService = require('../services/file.service');
const serviceTicketPdfService = require('../services/serviceTicketPdf.service');

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

// Autenticado: rechazar
async function reject(req, res, next) {
  try {
    const { reason } = req.body;
    const ticket = await serviceTicketService.reject(parseInt(req.params.id, 10), reason);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado o no está pendiente' });
    res.json({ ticket });
  } catch (err) { next(err); }
}

// Autenticado: asignar técnico
async function assign(req, res, next) {
  try {
    const { technicianId } = req.body;
    if (!technicianId) return res.status(400).json({ error: 'Técnico requerido' });
    const ticket = await serviceTicketService.assign(parseInt(req.params.id, 10), parseInt(technicianId, 10));
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado o no disponible para asignación' });
    res.json({ ticket });
  } catch (err) { next(err); }
}

// Autenticado: listar técnicos elegibles para asignación
async function getTechnicians(req, res, next) {
  try {
    const technicians = await serviceTicketService.getTechnicians();
    res.json({ technicians });
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

// Público: crear solicitud de servicio técnico
async function create(req, res, next) {
  try {
    // El cargo se acepta en el payload con la clave `position` (no `cargo`) para
    // respetar el contrato de serviceTicketPdf.service.js, que lee ticket.position.
    // Es opcional: si no viene, el servicio lo guarda como NULL.
    const { cedula, nombre, apellido, email, departmentName, position, extension, description, observations } = req.body;

    if (!cedula || !nombre || !apellido || !email) {
      return res.status(400).json({ error: 'Cédula, nombre, apellido y correo son obligatorios' });
    }

    if (!description || description.trim().length < 10) {
      return res.status(400).json({ error: 'La descripción del problema debe tener al menos 10 caracteres' });
    }

    const ticket = await serviceTicketService.create({
      cedula, nombre, apellido, email,
      departmentName: departmentName || null,
      position: position || null,
      extension: extension || null,
      description: description.trim(),
      observations: observations || null,
    });

    res.status(201).json({ ticket });
  } catch (err) { next(err); }
}

// Generar PDF resumen de atención técnica (con datos estáticos por defecto o datos del ticket)
async function generateSummaryPdf(req, res, next) {
  try {
    let ticketData = {};
    // Solo el id de ruta. Anteriormente se aceptaba también `?ticketId=`, lo que
    // venía de una ruta pública que se eliminó: sin auth, ese fallback hacía el
    // endpoint enumerable por query string. El frontend usa el path param.
    const ticketId = req.params.id;
    if (ticketId && !isNaN(parseInt(ticketId, 10))) {
      const ticket = await serviceTicketService.findById(parseInt(ticketId, 10));
      if (ticket) {
        ticketData = serviceTicketPdfService.mapTicketToPdfData(ticket);
      }
    }

    const doc = serviceTicketPdfService.createServiceTicketPdf(ticketData);

    const filename = ticketData.ticketNumber
      ? `resumen-atencion-${ticketData.ticketNumber}.pdf`
      : 'resumen-atencion.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);

    doc.pipe(res);
    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  findAll,
  getByCode,
  getById,
  accept,
  reject,
  assign,
  close,
  rate,
  getStats,
  getServiceTypes,
  create,
  generateSummaryPdf,
  getTechnicians,
};
