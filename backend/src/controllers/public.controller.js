const pool = require('../db/pool');
const bcrypt = require('bcryptjs');
const requestService = require('../services/request.service');
const fileService = require('../services/file.service');

// Normaliza texto: elimina acentos y convierte a mayúsculas
function normalizeText(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // elimina acentos (áéíóú -> aeiou)
    .toUpperCase()
    .trim();
}

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

async function getPersona(req, res, next) {
  try {
    const { cedula } = req.params;
    if (!cedula) return res.status(400).json({ error: 'Cédula requerida' });

    const result = await pool.query(
      `SELECT cedula, nombre, apellido, email, telefono
       FROM persona WHERE cedula = UPPER($1)`,
      [normalizeText(cedula)]
    );

    if (result.rows.length === 0) {
      return res.json({ persona: null });
    }

    res.json({ persona: result.rows[0] });
  } catch (err) { next(err); }
}

async function createOrGetPersona(req, res, next) {
  try {
    const { cedula, nombre, apellido, email, telefono } = req.body;

    if (!cedula || !nombre || !apellido) {
      return res.status(400).json({ error: 'Cédula, nombre y apellido son obligatorios' });
    }

    // Upsert: si existe la persona, actualiza datos; si no, la crea
    const result = await pool.query(
      `INSERT INTO persona (cedula, nombre, apellido, email, telefono)
       VALUES (UPPER($1), UPPER($2), UPPER($3), $4, $5)
       ON CONFLICT (cedula) DO UPDATE
         SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido,
             email = COALESCE(EXCLUDED.email, persona.email),
             telefono = COALESCE(EXCLUDED.telefono, persona.telefono),
             updated_at = now()
       RETURNING cedula, nombre, apellido, email, telefono`,
      [normalizeText(cedula), normalizeText(nombre), normalizeText(apellido),
       email ? email.toLowerCase().trim() : null,
       telefono ? normalizeText(telefono) : null]
    );

    res.status(201).json({ persona: result.rows[0] });
  } catch (err) { next(err); }
}

async function createRequest(req, res, next) {
  try {
    const {
      cedula,
      nombre,
      apellido,
      applicantEmail,
      departmentId,
      moduleId,
      requestTypeId,
      priority,
      processDescription,
      currentBehavior,
      expectedBehavior,
    } = req.body;

    if (!cedula || !nombre || !apellido || !applicantEmail || !departmentId) {
      return res.status(400).json({ error: 'Cédula, nombre, apellido, email y departamento son obligatorios' });
    }

    if (!processDescription || !currentBehavior || !expectedBehavior) {
      return res.status(400).json({ error: 'Todos los campos del contexto funcional son obligatorios' });
    }

    const deptId = parseInt(departmentId, 10);
    const modId = parseInt(moduleId, 10);
    const typeId = parseInt(requestTypeId, 10);

    // Buscar o crear persona por cédula (sin acentos, mayúsculas, con email)
    let personaResult = await pool.query(
      `INSERT INTO persona (cedula, nombre, apellido, email)
       VALUES (UPPER($1), UPPER($2), UPPER($3), $4)
       ON CONFLICT (cedula) DO UPDATE
         SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido,
             email = COALESCE(EXCLUDED.email, persona.email),
             updated_at = now()
       RETURNING cedula, nombre, apellido, email`,
      [normalizeText(cedula), normalizeText(nombre), normalizeText(apellido),
       applicantEmail.toLowerCase().trim()]
    );
    const persona = personaResult.rows[0];

    // Buscar o crear usuario solicitante por email
    let userResult = await pool.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [applicantEmail.trim()]);
    let userId;

    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].user_id;
      // Actualizar cédula si el usuario no la tenía
      await pool.query('UPDATE users SET cedula = $1 WHERE user_id = $2 AND cedula IS NULL', [normalizeText(cedula), userId]);
    } else {
      const dummyPasswordHash = await bcrypt.hash('public_user_nopass_' + Date.now(), 8);
      const fullName = `${persona.nombre} ${persona.apellido}`;
      const newUser = await pool.query(
        `INSERT INTO users (full_name, email, password_hash, role, department_id, cedula)
         VALUES ($1, $2, $3, 'requester', $4, $5) RETURNING user_id`,
        [fullName, applicantEmail.trim(), dummyPasswordHash, deptId, normalizeText(cedula)]
      );
      userId = newUser.rows[0].user_id;
    }

    const requestData = {
      moduleId: modId,
      requestTypeId: typeId,
      priority: priority || 'media',
      processDescription: normalizeText(processDescription),
      currentBehavior: normalizeText(currentBehavior),
      expectedBehavior: normalizeText(expectedBehavior),
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

async function searchRequests(req, res, next) {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'El parámetro de búsqueda debe tener al menos 2 caracteres' });
    }

    const searchTerm = normalizeText(q);

    const result = await pool.query(
      `SELECT r.request_id, r.ticket_code, r.status, r.priority,
              r.process_description, r.created_at,
              m.name AS module_name,
              rt.name AS request_type_name,
              u.full_name AS created_by_name
       FROM requests r
       JOIN modules m ON m.module_id = r.module_id
       JOIN request_types rt ON rt.request_type_id = r.request_type_id
       JOIN users u ON u.user_id = r.created_by
       WHERE u.cedula = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [searchTerm]
    );

    res.json({ requests: result.rows });
  } catch (err) { next(err); }
}

async function getRequestPublic(req, res, next) {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT r.request_id, r.ticket_code, r.status, r.priority,
              r.process_description, r.current_behavior, r.expected_behavior,
              r.rejection_reason, r.resolution_notes,
              r.ai_priority, r.ai_category, r.ai_module_suggested, r.ai_summary,
              r.ai_generated_response,
              r.created_at, r.updated_at,
              m.name AS module_name,
              rt.name AS request_type_name,
              d.name AS department_name,
              u.full_name AS created_by_name
       FROM requests r
       JOIN modules m ON m.module_id = r.module_id
       JOIN request_types rt ON rt.request_type_id = r.request_type_id
       JOIN departments d ON d.department_id = r.department_id
       JOIN users u ON u.user_id = r.created_by
       WHERE r.request_id = $1`,
      [parseInt(id, 10)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    // Obtener historial de estados
    const historyResult = await pool.query(
      `SELECT h.history_id, h.from_status, h.to_status, h.comment, h.created_at,
              u.full_name AS changed_by_name
       FROM request_status_history h
       JOIN users u ON u.user_id = h.changed_by
       WHERE h.request_id = $1
       ORDER BY h.created_at DESC`,
      [parseInt(id, 10)]
    );

    // Obtener comentarios públicos (no internos)
    const commentsResult = await pool.query(
      `SELECT c.comment_id, c.content, c.is_internal, c.created_at,
              u.full_name AS author_name, u.role AS author_role
       FROM request_comments c
       JOIN users u ON u.user_id = c.author_id
       WHERE c.request_id = $1 AND c.is_internal = false
       ORDER BY c.created_at DESC`,
      [parseInt(id, 10)]
    );

    res.json({
      request: result.rows[0],
      history: historyResult.rows,
      comments: commentsResult.rows,
    });
  } catch (err) { next(err); }
}

module.exports = {
  getModules,
  getRequestTypes,
  getDepartments,
  getPersona,
  createOrGetPersona,
  createRequest,
  searchRequests,
  getRequestPublic,
};
