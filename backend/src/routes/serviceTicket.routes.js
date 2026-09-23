const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  findAll, getByCode, getById, accept, close, rate, getStats, getServiceTypes
} = require('../controllers/serviceTicket.controller');

const router = Router();

// Públicas
router.get('/public/:code', getByCode);
router.patch('/public/:code/rate', rate);

// Autenticadas
router.get('/', authenticate, findAll);
router.get('/stats', authenticate, getStats);
router.get('/service-types', authenticate, getServiceTypes);
router.get('/:code', authenticate, getByCode);
router.get('/:id', authenticate, getById);
router.patch('/:id/accept', authenticate, accept);
router.patch('/:id/close', authenticate, close);

module.exports = router;
