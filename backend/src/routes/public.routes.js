const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const config = require('../config/env');
const {
  getModules,
  getRequestTypes,
  getDepartments,
  createRequest,
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
      cb(new Error('Tipo de archivo no permitido'), false);
    }
  },
});

router.get('/modules', getModules);
router.get('/types', getRequestTypes);
router.get('/departments', getDepartments);
router.post(
  '/requests',
  upload.fields([
    { name: 'screenshots', maxCount: 5 },
    { name: 'documents', maxCount: 5 },
  ]),
  createRequest
);

module.exports = router;
