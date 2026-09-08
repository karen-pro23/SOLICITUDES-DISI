const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config/env');
const {
  getModules,
  getRequestTypes,
  getDepartments,
  getPersona,
  createOrGetPersona,
  createRequest,
  searchRequests,
  getRequestPublic,
} = require('../controllers/public.controller');

const router = Router();

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

function handlePublicUploadMiddleware(req, res, next) {
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

router.get('/modules', getModules);
router.get('/types', getRequestTypes);
router.get('/departments', getDepartments);
router.get('/search', searchRequests);
router.get('/requests/:id', getRequestPublic);
router.get('/persona/:cedula', getPersona);
router.post('/persona', createOrGetPersona);
router.post('/requests', handlePublicUploadMiddleware, createRequest);

module.exports = router;
