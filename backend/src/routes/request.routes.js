const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config/env');
const {
  getAll, getById, create, updateStatus, updatePriority, assign,
  getAttachmentDownload, getAttachmentPreview, deleteAttachment, remove,
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
      cb(new Error(`Tipo de archivo no permitido: ${file.originalname}`), false);
    }
  },
});

const uploadFields = upload.fields([
  { name: 'screenshots', maxCount: 5 },
  { name: 'documents', maxCount: 5 },
]);

function handleUploadMiddleware(req, res, next) {
  uploadFields(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Uno de los archivos supera el tamaño máximo permitido (50 MB)' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Superó el número máximo permitido de 5 archivos por sección' });
      }
      return res.status(400).json({ error: `Error en la carga de archivos: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message || 'Formato de archivo no válido' });
    }
    next();
  });
}

// Rutas de solicitudes
router.get('/', getAll);
router.get('/:id', getById);
router.post('/', handleUploadMiddleware, create);
router.patch('/:id/status', updateStatus);
router.patch('/:id/priority', updatePriority);
router.patch('/:id/assign', assign);
router.delete('/:id', remove);

// Adjuntos
router.get('/:id/attachments/:fileId/preview', getAttachmentPreview);
router.get('/:id/attachments/:fileId/download', getAttachmentDownload);
router.delete('/:id/attachments/:fileId', deleteAttachment);

// Comentarios (rutas explícitas)
router.get('/:id/comments', commentController.getAll);
router.post('/:id/comments', commentController.create);

module.exports = router;
