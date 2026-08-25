const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
const pool = require('../db/pool');
const config = require('../config/env');

const readFile = util.promisify(fs.readFile);

// Magic bytes por tipo MIME
const MAGIC_BYTES = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4B, 0x03, 0x04],
  'application/vnd.ms-excel': [0xD0, 0xCF, 0x11, 0xE0],
  'text/csv': null, // skip magic check for CSV
};

const ALLOWED_MIMES = Object.keys(MAGIC_BYTES);

function validateMagicBytes(buffer, mimeType) {
  const magic = MAGIC_BYTES[mimeType];
  if (!magic) return true; // no magic defined, skip
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false;
  }
  return true;
}

function sanitizeFileName(name) {
  if (!name) return 'archivo';
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const safeBase = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.\./g, '')
    .substring(0, 150);
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').substring(0, 10);
  return `${safeBase}${safeExt}` || 'archivo';
}

async function saveAttachment(requestId, file, fileType) {
  // Validar MIME type
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    fs.unlink(file.path, () => {});
    throw Object.assign(new Error(`Tipo de archivo no permitido (${file.mimetype})`), { status: 400 });
  }

  // Validar magic bytes
  let buffer;
  try {
    buffer = await readFile(file.path);
  } catch (err) {
    fs.unlink(file.path, () => {});
    throw Object.assign(new Error('No se pudo leer el archivo temporal'), { status: 400 });
  }

  if (!validateMagicBytes(buffer, file.mimetype)) {
    // Eliminar archivo temporal
    fs.unlink(file.path, () => {});
    throw Object.assign(new Error('El contenido del archivo no corresponde con su formato o extensión'), { status: 400 });
  }

  // Crear directorio UUID para la solicitud
  const dirUuid = crypto.randomUUID();
  const uploadBase = path.resolve(__dirname, '../../', config.upload.dir);
  const targetDir = path.join(uploadBase, dirUuid);
  fs.mkdirSync(targetDir, { recursive: true });

  // Sanitizar nombre y mover archivo
  const safeName = sanitizeFileName(file.originalname);
  const targetPath = path.join(targetDir, safeName);

  // Verificar path traversal
  const resolvedPath = path.resolve(targetPath);
  if (!resolvedPath.startsWith(path.resolve(uploadBase))) {
    fs.unlink(file.path, () => {});
    throw Object.assign(new Error('Path traversal detectado'), { status: 400 });
  }

  try {
    fs.renameSync(file.path, resolvedPath);
  } catch (err) {
    fs.unlink(file.path, () => {});
    throw err;
  }

  // Guardar en BD
  const result = await pool.query(
    `INSERT INTO request_attachments (request_id, file_name, file_path, file_type, mime_type, file_size)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [requestId, safeName, resolvedPath, fileType, file.mimetype, file.size]
  );

  return result.rows[0];
}

async function getAttachment(attachmentId) {
  const result = await pool.query(
    `SELECT * FROM request_attachments WHERE attachment_id = $1`,
    [attachmentId]
  );
  return result.rows[0] || null;
}

async function deleteAttachment(attachmentId) {
  const attachment = await getAttachment(attachmentId);
  if (!attachment) return null;

  // Eliminar archivo físico
  try {
    fs.unlinkSync(attachment.file_path);
  } catch (e) {
    // archivo ya no existe, continuar
  }

  await pool.query('DELETE FROM request_attachments WHERE attachment_id = $1', [attachmentId]);
  return attachment;
}

module.exports = { saveAttachment, getAttachment, deleteAttachment };
