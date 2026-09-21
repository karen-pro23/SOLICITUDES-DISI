const { Router } = require('express');
const { 
  getByDepartment, getById, create, update, remove, getAreasByUser 
} = require('../controllers/area.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas para jefes (ven áreas de su departamento) — ANTES de /:areaId
router.get('/my-areas', requireRole(['admin', 'developer']), getAreasByUser);

// Rutas para admin
router.get('/department/:departmentId', requireRole(['admin']), getByDepartment);
router.post('/', requireRole(['admin']), create);
router.patch('/:areaId', requireRole(['admin']), update);
router.delete('/:areaId', requireRole(['admin']), remove);
router.get('/:areaId', requireRole(['admin']), getById);

module.exports = router;
