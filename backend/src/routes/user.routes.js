const { Router } = require('express');
const { getAll, getById, getByDepartment, getByArea, create, update, remove } = require('../controllers/user.controller');
const { requireRole } = require('../middleware/auth.middleware');

const router = Router();

// Accesible por Jefes y admins
router.get('/department/:id', getByDepartment);
router.get('/area/:id', getByArea);

router.use(requireRole('admin', 'super_admin'));
router.get('/', getAll);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
