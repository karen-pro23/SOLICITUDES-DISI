const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config/env');
const pool = require('./db/pool');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const requestRoutes = require('./routes/request.routes');
const adminRoutes = require('./routes/admin.routes');
const publicRoutes = require('./routes/public.routes');
const aiRoutes = require('./routes/ai.routes');
const { authenticate } = require('./middleware/auth.middleware');

const app = express();

// Security (Configurado para permitir ver recursos/adjuntos en iFrames y Modales)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
}));

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174,http://localhost:5270')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (server-to-server, mobile apps, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }
    // Permitir cualquier IP de red local
    if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      callback(null, true);
      return;
    }
    // Permitir orígenes en la lista configurada
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
}));

// Body parsing — 50 MB para soportar adjuntos grandes
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Archivos estáticos (Subimos 2 niveles desde backend/src para llegar a la raíz /uploads)
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// Routes
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin/users', authenticate, userRoutes);
app.use('/api/requests', authenticate, requestRoutes);
app.use('/api/admin', authenticate, adminRoutes);
app.use('/api/ai', authenticate, aiRoutes);

// Error handler
app.use((err, req, res, next) => {
  if (err && err.code && err.code.startsWith('LIMIT_')) {
    return res.status(400).json({
      error: 'Error en la carga de archivos: tamaño o cantidad excedida (máx. 50 MB / 5 archivos)',
    });
  }

  // Traducción de errores técnicos de PostgreSQL a mensajes claros para personas no técnicas
  if (err && err.code) {
    if (err.constraint === 'requests_priority_check' || (err.message && err.message.includes('requests_priority_check'))) {
      return res.status(400).json({
        error: 'No se pudo guardar la solicitud. Por favor verificá que la prioridad sea válida (Baja, Media o Alta).',
      });
    }
    if (err.code === '23514') {
      return res.status(400).json({
        error: 'Uno de los datos ingresados no cumple con los valores o formato permitido.',
      });
    }
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'El registro ingresado (código, cédula o correo) ya existe en el sistema.',
      });
    }
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'La información asociada (módulo, departamento o usuario) no está disponible o no existe.',
      });
    }
  }

  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: err.status ? err.message : 'Ocurrió un inconveniente al procesar tu solicitud. Por favor intentá nuevamente.',
  });
});

// Start
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

module.exports = app;