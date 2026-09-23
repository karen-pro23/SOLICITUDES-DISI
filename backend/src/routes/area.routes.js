const { Router } = require('express');
const { 
  getByDepartment, getById, create, update, remove, getAreasByUser 
} = require('../controllers/area.controller');
const { authenticate, requireRole } = require('../middleware/auth.middleware');

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas para jefes (ven áreas de su departamento) — ANTES de /:areaId
router.get('/my-areas', requireRole(['super_admin', 'admin', 'developer', 'jefe_area', 'recepcion']), getAreasByUser);

// Rutas para admin/super_admin
router.get('/department/:departmentId', requireRole(['super_admin', 'admin', 'recepcion']), getByDepartment);
router.post('/', requireRole(['super_admin', 'admin']), create);
router.patch('/:areaId', requireRole(['super_admin', 'admin']), update);
router.delete('/:areaId', requireRole(['super_admin', 'admin']), remove);
router.get('/:areaId', requireRole(['super_admin', 'admin', 'recepcion']), getById);

module.exports = router;
