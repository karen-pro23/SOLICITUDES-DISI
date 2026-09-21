const { Router } = require('express');
const { 
  getByDepartment, getById, create, update, remove, getAreasByUser 
} = require('../controllers/area.controller');
const { authenticateToken, requireRole } = require('../middleware/auth.middleware');

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticateToken);

// Rutas para admin
router.get('/department/:departmentId', requireRole(['admin']), getByDepartment);
router.get('/:areaId', requireRole(['admin']), getById);
router.post('/', requireRole(['admin']), create);
router.patch('/:areaId', requireRole(['admin']), update);
router.delete('/:areaId', requireRole(['admin']), remove);

// Rutas para jefes (ven áreas de su departamento)
router.get('/my-areas', requireRole(['admin', 'developer']), getAreasByUser);

module.exports = router;
