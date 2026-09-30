const { Router } = require('express');
const { getAll, getById, getByDepartment, getByArea, create, update, remove } = require('../controllers/user.controller');
const { requireRole } = require('../middleware/auth.middleware');

const router = Router();

// Accesible por los roles de trabajo (Jefes, recepción, etc.) — necesario
// para el modal de asignación — excepto requester
router.use(requireRole(
  'super_admin', 'admin', 'director', 'sub_director',
  'recepcion', 'jefe_area', 'jefe_st', 'developer', 'tecnico'
));
router.get('/department/:id', getByDepartment);
router.get('/area/:id', getByArea);

router.use(requireRole('admin', 'super_admin'));
router.get('/', getAll);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
