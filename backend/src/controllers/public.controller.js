const pool = require('../db/pool');
const bcrypt = require('bcryptjs');
const requestService = require('../services/request.service');
const fileService = require('../services/file.service');

async function getModules(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM modules WHERE is_active = true ORDER BY name');
    res.json({ modules: result.rows });
  } catch (err) { next(err); }
}

async function getRequestTypes(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM request_types ORDER BY name');
    res.json({ requestTypes: result.rows });
  } catch (err) { next(err); }
}

async function getDepartments(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM departments WHERE is_active = true ORDER BY name');
    res.json({ departments: result.rows });
  } catch (err) { next(err); }
}

async function createRequest(req, res, next) {
  try {
    const {
      applicantName,
      applicantEmail,
      departmentId,
      moduleId,
      requestTypeId,
      priority,
      processDescription,
      currentBehavior,
      expectedBehavior,
    } = req.body;

    if (!applicantName || !applicantEmail || !departmentId) {
      return res.status(400).json({ error: 'Nombre, email y departamento del solicitante son obligatorios' });
    }

    if (!processDescription || !currentBehavior || !expectedBehavior) {
      return res.status(400).json({ error: 'Todos los campos del contexto funcional son obligatorios' });
    }

    const deptId = parseInt(departmentId, 10);
    const modId = parseInt(moduleId, 10);
    const typeId = parseInt(requestTypeId, 10);

    // Buscar o crear usuario solicitante por email
    let userResult = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [applicantEmail.trim()]);
    let userId;

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].user_id;
    } else {
      const dummyPasswordHash = await bcrypt.hash('public_user_nopass_' + Date.now(), 8);
      const newUser = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role, department_id)
         VALUES ($1, $2, $3, 'requester', $4) RETURNING user_id`,
        [applicantName.trim(), applicantEmail.trim(), dummyPasswordHash, deptId]
      );
      userId = newUser.rows[0].user_id;
    }

    const requestData = {
      moduleId: modId,
      requestTypeId: typeId,
      priority: priority || 'media',
      processDescription,
      currentBehavior,
      expectedBehavior,
    };

    const request = await requestService.create(requestData, userId, deptId);

    // Procesar archivos adjuntos si vienen
    const attachments = [];
    if (req.files) {
      const filesArray = Array.isArray(req.files)
        ? req.files
        : [...(req.files.screenshots || []), ...(req.files.documents || [])];

      for (const file of filesArray) {
        const fileType = file.fieldname === 'screenshots' ? 'screenshot' : 'document';
        try {
          const attachment = await fileService.saveAttachment(request.request_id, file, fileType);
          attachments.push(attachment);
        } catch (err) {
          console.error('Error guardando adjunto:', err.message);
        }
      }
    }

    res.status(201).json({ request, attachments });
  } catch (err) { next(err); }
}

module.exports = {
  getModules,
  getRequestTypes,
  getDepartments,
  createRequest,
};
