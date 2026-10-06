const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config/env');
const { authenticate, requireRole } = require('../middleware/auth.middleware');
const {
  findAll, getByCode, getById, accept, reject, assign, close, rate, getStats, getServiceTypes, create, generateSummaryPdf, getTechnicians
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
router.post('/', create);
router.get('/service-types', getServiceTypes);
router.get('/public/:code', getByCode);
router.patch('/public/:code/rate', rate);

// Autenticadas (lectura)
router.get('/', authenticate, findAll);
router.get('/stats', authenticate, getStats);
router.get('/technicians', authenticate, getTechnicians);
router.get('/summary-pdf', authenticate, generateSummaryPdf);
router.get('/:id/pdf', authenticate, generateSummaryPdf);
router.get('/:code', authenticate, getByCode);
router.get('/:id', authenticate, getById);

// Mutaciones ST: solo roles del flujo de servicio técnico.
// recepcion deriva vía assign de requests, no procesa ST directamente.
const ST_MUTATION_ROLES = ['jefe_st', 'tecnico', 'developer', 'super_admin', 'admin'];
router.patch('/:id/accept', authenticate, requireRole(ST_MUTATION_ROLES), accept);
router.patch('/:id/reject', authenticate, requireRole(ST_MUTATION_ROLES), reject);
router.patch('/:id/assign', authenticate, requireRole(ST_MUTATION_ROLES), assign);
router.patch('/:id/close', authenticate, requireRole(ST_MUTATION_ROLES), upload.array('files', 5), close);

module.exports = router;
