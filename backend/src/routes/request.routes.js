const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config/env');
const {
  getAll, getById, create, updateStatus, updatePriority, assign,
  getAttachmentDownload, deleteAttachment,
} = require('../controllers/request.controller');
const commentController = require('../controllers/comment.controller');

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
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  },
});

// Rutas de solicitudes
router.get('/', getAll);
router.get('/:id', getById);
router.post('/',
  upload.fields([
    { name: 'screenshots', maxCount: 5 },
    { name: 'documents', maxCount: 5 },
  ]),
  create
);
router.patch('/:id/status', updateStatus);
router.patch('/:id/priority', updatePriority);
router.patch('/:id/assign', assign);

// Adjuntos
router.get('/:id/attachments/:fileId/download', getAttachmentDownload);
router.delete('/:id/attachments/:fileId', deleteAttachment);

// Comentarios (rutas explícitas)
router.get('/:id/comments', commentController.getAll);
router.post('/:id/comments', commentController.create);

module.exports = router;
