const pool = require('../db/pool');

const VALID_TRANSITIONS = {
  PENDIENTE:  ['EN_PROCESO', 'RECHAZADA'],
  RECHAZADA:  ['PENDIENTE'],
  EN_PROCESO: ['EN_PRUEBAS'],
  EN_PRUEBAS: ['RESUELTA', 'EN_PROCESO'],
  RESUELTA:   [],
};

async function findAll(filters, userId, userRole, userDeptId) {
  let sql = `SELECT r.*, 
             creator.full_name as created_by_name,
             assignee.full_name as assigned_to_name,
             m.name as module_name,
             m.is_systems,
             rt.name as request_type_name
             FROM requests r
             JOIN users creator ON creator.user_id = r.created_by
             LEFT JOIN users assignee ON assignee.user_id = r.assigned_to
             JOIN modules m ON m.module_id = r.module_id
             JOIN request_types rt ON rt.request_type_id = r.request_type_id`;
  const conditions = [];
  const values = [];
  let idx = 1;

  // Admin y developer ven todo; requester solo su departamento
  if (userRole === 'requester') {
    conditions.push(`r.department_id = $${idx++}`);
    values.push(userDeptId);
  }

  if (filters.status) {
    const statuses = filters.status.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      conditions.push(`r.status = $${idx++}`);
      values.push(filters.status.trim());
    } else if (statuses.length > 1) {
      const placeholders = statuses.map(() => `$${idx++}`).join(', ');
      conditions.push(`r.status IN (${placeholders})`);
      values.push(...statuses);
    }
  }
  if (filters.moduleId) {
    conditions.push(`r.module_id = $${idx++}`);
    values.push(parseInt(filters.moduleId, 10));
  }
  if (filters.priority) {
    conditions.push(`r.priority = $${idx++}`);
    values.push(filters.priority);
  }
  if (filters.createdBy) {
    conditions.push(`r.created_by = $${idx++}`);
    values.push(parseInt(filters.createdBy, 10));
  }
  if (filters.search) {
    conditions.push(`(r.ticket_code ILIKE $${idx} OR r.process_description ILIKE $${idx})`);
    values.push(`%${filters.search}%`);
    idx++;
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  // Cursor-based pagination
  const limit = Math.min(parseInt(filters.limit, 10) || 20, 100);
  if (filters.cursor) {
    sql += ` AND r.created_at < $${idx++}`;
    values.push(filters.cursor);
  }

  sql += ' ORDER BY r.created_at DESC LIMIT $' + idx;
  values.push(limit + 1);

  const result = await pool.query(sql, values);
  const rows = result.rows.slice(0, limit);
  const hasMore = result.rows.length > limit;

  return {
    requests: rows,
    pagination: {
      limit,
      hasMore,
      nextCursor: hasMore ? rows[rows.length - 1].created_at : null,
    },
  };
}

async function findById(requestId, userRole, userDeptId) {
  let sql = `SELECT r.*,
             creator.full_name as created_by_name,
             assignee.full_name as assigned_to_name,
             m.name as module_name,
             m.is_systems,
             rt.name as request_type_name,
             d.name as department_name
             FROM requests r
             JOIN users creator ON creator.user_id = r.created_by
             LEFT JOIN users assignee ON assignee.user_id = r.assigned_to
             JOIN modules m ON m.module_id = r.module_id
             JOIN request_types rt ON rt.request_type_id = r.request_type_id
             JOIN departments d ON d.department_id = r.department_id
             WHERE r.request_id = $1`;
  const values = [requestId];

  if (userRole === 'requester') {
    sql += ' AND r.department_id = $2';
    values.push(userDeptId);
  }

  const result = await pool.query(sql, values);
  return result.rows[0] || null;
}

async function create(data, userId, userDeptId) {
  const { moduleId, requestTypeId, priority, processDescription, currentBehavior, expectedBehavior } = data;

  const result = await pool.query(
    `INSERT INTO requests (created_by, department_id, module_id, request_type_id, priority,
      process_description, current_behavior, expected_behavior)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, userDeptId, moduleId, requestTypeId, priority || 'media',
     processDescription, currentBehavior, expectedBehavior]
  );

  return result.rows[0];
}

async function updateStatus(requestId, newStatus, rejectionReason, userId, userRole, userDeptId) {
  // Verificar que la solicitud existe y es accesible
  const request = await findById(requestId, userRole, userDeptId);
  if (!request) {
    throw Object.assign(new Error('Solicitud no encontrada'), { status: 404 });
  }

  // Validar transición
  const allowed = VALID_TRANSITIONS[request.status];
  if (!allowed || !allowed.includes(newStatus)) {
    throw Object.assign(
      new Error(`Transición inválida de ${request.status} a ${newStatus}`),
      { status: 400 }
    );
  }

  // RECHAZADA requiere motivo
  if (newStatus === 'RECHAZADA' && !rejectionReason) {
    throw Object.assign(
      new Error('El motivo de rechazo es obligatorio'),
      { status: 400 }
    );
  }

  // RESUELTA marca completed_at
  const completedAt = newStatus === 'RESUELTA' ? new Date() : null;

  // Optimistic locking con version_number
  const result = await pool.query(
    `UPDATE requests SET status = $1, rejection_reason = $2, completed_at = $3,
            version_number = version_number + 1
     WHERE request_id = $4 AND version_number = $5
     RETURNING *`,
    [newStatus, rejectionReason || null, completedAt, requestId, request.version_number]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Conflicto de concurrencia. Intentá de nuevo.'), { status: 409 });
  }

  // Registrar el cambio en el historial vía trigger de BD

  return result.rows[0];
}

async function assign(requestId, assigneeId, userRole, userDeptId) {
  const request = await findById(requestId, userRole, userDeptId);
  if (!request) {
    throw Object.assign(new Error('Solicitud no encontrada'), { status: 404 });
  }

  // Solo admin o developer pueden asignar
  if (userRole === 'requester') {
    throw Object.assign(new Error('No tienes permiso para asignar'), { status: 403 });
  }

  // Verificar que el asignado existe y es developer
  const userResult = await pool.query(
    `SELECT user_id FROM users WHERE user_id = $1 AND role IN ('developer', 'admin') AND is_active = true`,
    [assigneeId]
  );
  if (userResult.rows.length === 0) {
    throw Object.assign(new Error('Desarrollador no encontrado'), { status: 404 });
  }

  const result = await pool.query(
    `UPDATE requests SET assigned_to = $1 WHERE request_id = $2 RETURNING *`,
    [assigneeId, requestId]
  );

  return result.rows[0];
}

async function getAttachments(requestId) {
  const result = await pool.query(
    `SELECT * FROM request_attachments WHERE request_id = $1 ORDER BY uploaded_at`,
    [requestId]
  );
  return result.rows;
}

async function getHistory(requestId) {
  const result = await pool.query(
    `SELECT h.*, u.full_name as changed_by_name
     FROM request_status_history h
     JOIN users u ON u.user_id = h.changed_by
     WHERE h.request_id = $1
     ORDER BY h.created_at DESC`,
    [requestId]
  );
  return result.rows;
}

module.exports = { findAll, findById, create, updateStatus, assign, getAttachments, getHistory };
