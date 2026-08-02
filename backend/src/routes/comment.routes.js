const { Router } = require('express');
const { getAll, create } = require('../controllers/comment.controller');

const router = Router();

router.get('/', getAll);
router.post('/', create);

module.exports = router;
