const serviceTicketService = require('../services/serviceTicket.service');

// Público: crear solicitud
async function create(req, res, next) {
  try {
    const { requesterName, requesterCedula, requesterPosition, departmentName, extension, description, assignedArea, observations } = req.body;
    if (!requesterName || !description) {
      return res.status(400).json({ error: 'Nombre del solicitante y descripción son requeridos' });
    }
    const ticket = await serviceTicketService.create(req.body);
    res.status(201).json({ ticket });
  } catch (err) { next(err); }
}

// Autenticado: listar
async function findAll(req, res, next) {
  try {
    const result = await serviceTicketService.findAll(req.query);
    res.json(result);
  } catch (err) { next(err); }
}

// Autenticado: ver por ID
async function getById(req, res, next) {
  try {
    const ticket = await serviceTicketService.findByCode(req.params.code);
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

// Autenticado: cerrar
async function close(req, res, next) {
  try {
    const { serviceType, closeObservations } = req.body;
    const ticket = await serviceTicketService.close(parseInt(req.params.id, 10), { serviceType, closeObservations });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado o no está en proceso' });
    res.json({ ticket });
  } catch (err) { next(err); }
}

// Público: ver por código
async function getPublicByCode(req, res, next) {
  try {
    const ticket = await serviceTicketService.findByCode(req.params.code);
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    res.json({ ticket });
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

module.exports = { create, findAll, getById, accept, close, getPublicByCode, rate, getStats, getServiceTypes };
