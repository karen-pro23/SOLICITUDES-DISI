const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config/env');
const { authenticate } = require('../middleware/auth.middleware');
const {
  findAll, getByCode, getById, accept, assign, close, rate, getStats, getServiceTypes
} = require('../controllers/serviceTicket.controller');

const router = Router();

// Multer config para archivos temporales
const storage = multer.diskStorage({
  destination: path.resolve(__dirname, '../../uploads/tmp'),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel', 'text/csv',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.originalname}`), false);
    }
  },
});

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
router.patch('/:id/assign', authenticate, assign);
router.patch('/:id/close', authenticate, upload.array('files', 5), close);

module.exports = router;
