const { Router } = require('express');
const { getAll, getById, create, update, remove } = require('../controllers/user.controller');
const { requireRole } = require('../middleware/auth.middleware');

const router = Router();

router.use(requireRole('admin'));
router.get('/', getAll);
router.get('/:id', getById);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
