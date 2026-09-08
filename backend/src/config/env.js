require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5434,
    database: process.env.DB_NAME || 'solicitudapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || '../uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800,
  },
  googleAI: {
    apiKey: process.env.GOOGLE_AI_API_KEY || '',
  },
};
