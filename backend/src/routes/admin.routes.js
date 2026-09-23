const { Router } = require('express');
const { requireRole } = require('../middleware/auth.middleware');
const {
  getModules, createModule, updateModule, deleteModule,
  getRequestTypes, createRequestType, updateRequestType, deleteRequestType,
  getDepartments, createDepartment, updateDepartment, deleteDepartment, getMetrics,
} = require('../controllers/admin.controller');

const router = Router();
router.use(requireRole('admin', 'super_admin'));

// Módulos
router.get('/modules', getModules);
router.post('/modules', createModule);
router.put('/modules/:id', updateModule);
router.delete('/modules/:id', deleteModule);

// Tipos de solicitud
router.get('/request-types', getRequestTypes);
router.post('/request-types', createRequestType);
router.put('/request-types/:id', updateRequestType);
router.delete('/request-types/:id', deleteRequestType);

// Departamentos
router.get('/departments', getDepartments);
router.post('/departments', createDepartment);
router.put('/departments/:id', updateDepartment);
router.delete('/departments/:id', deleteDepartment);

// Métricas
router.get('/metrics', getMetrics);

module.exports = router;
