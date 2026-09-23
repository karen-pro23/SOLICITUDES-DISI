const { Router } = require('express');
const { authenticate } = require('../middleware/auth.middleware');
const {
  create, findAll, getById, accept, close,
  getPublicByCode, rate, getStats, getServiceTypes
} = require('../controllers/serviceTicket.controller');

const router = Router();

// Públicas
router.post('/', create);
router.get('/public/:code', getPublicByCode);
router.patch('/public/:code/rate', rate);

// Autenticadas
router.get('/', authenticate, findAll);
router.get('/stats', authenticate, getStats);
router.get('/service-types', authenticate, getServiceTypes);
router.get('/:code', authenticate, getById);
router.patch('/:id/accept', authenticate, accept);
router.patch('/:id/close', authenticate, close);

module.exports = router;
