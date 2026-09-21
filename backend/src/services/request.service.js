const pool = require('../db/pool');

// VALID_TRANSITIONS se eliminó para permitir cualquier cambio de estado

const VALID_PRIORITIES = ['baja', 'media', 'alta'];

async function findAll(filters, userId, userRole, userDeptId, isBoss, isDeptBoss = false) {
  let baseSql = `FROM requests r
                 LEFT JOIN users creator ON creator.user_id = r.created_by
                 LEFT JOIN users assignee ON assignee.user_id = r.assigned_to
                 LEFT JOIN modules m ON m.module_id = r.module_id
                 LEFT JOIN request_types rt ON rt.request_type_id = r.request_type_id
                 LEFT JOIN departments d ON d.department_id = r.department_id
                 LEFT JOIN departments creator_d ON creator_d.department_id = creator.department_id
                 LEFT JOIN departments assigned_d ON assigned_d.department_id = r.assigned_department_id
                 LEFT JOIN areas a ON a.area_id = r.area_id`;
  const conditions = [];
  const values = [];
  let idx = 1;

  // Lógica de Control de Acceso
  if (userRole === 'admin' || userDeptId == null) {
    // Caso A: Admin o sin departamento, ve todas
  } else if (isDeptBoss) {
    // Caso B: Jefe de departamento, ve TODAS las asignadas a su depto (incluyendo todas las áreas)
    conditions.push(`(r.department_id = $${idx} OR r.assigned_department_id = $${idx} OR creator.department_id = $${idx})`);
    values.push(userDeptId);
    idx++;
  } else if (isBoss) {
    // Caso C: Jefe de área, ve las asignadas a su área o creadas en su área
    conditions.push(`(r.area_id = $${idx} OR (r.created_by = $${idx} AND r.area_id IS NULL))`);
    values.push(userId);
    idx++;
  } else {
    // Caso D: Empleado, ve las que tiene asignadas o las que creó
    conditions.push(`(r.assigned_to = $${idx} OR r.created_by = $${idx})`);
    values.push(userId);
    idx++;
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
    conditions.push(`(
      r.ticket_code ILIKE $${idx} OR 
      CAST(r.request_id AS TEXT) ILIKE $${idx} OR 
      creator.cedula ILIKE $${idx} OR 
      creator.full_name ILIKE $${idx} OR 
      r.process_description ILIKE $${idx}
    )`);
    values.push(`%${filters.search}%`);
    idx++;
  }

  const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  // Contar total de registros filtrados
  const countResult = await pool.query(`SELECT COUNT(*) ${baseSql} ${whereClause}`, values);
  const totalItems = parseInt(countResult.rows[0].count, 10);

  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 10, 100);
  const totalPages = Math.ceil(totalItems / limit) || 1;

  let querySql = `SELECT r.*, 
             creator.full_name as created_by_name,
             assignee.full_name as assigned_to_name,
             m.name as module_name,
             m.is_systems,
             rt.name as request_type_name,
             COALESCE(d.name, creator_d.name, 'SIN DEPARTAMENTO') as department_name,
             assigned_d.name as assigned_department_name
             ${baseSql} ${whereClause}`;

  const queryValues = [...values];
  let qIdx = values.length + 1;

  if (filters.cursor) {
    querySql += (whereClause ? ' AND ' : ' WHERE ') + `r.created_at < $${qIdx++}`;
    queryValues.push(filters.cursor);
  }

  let orderByClause = ` ORDER BY
    CASE r.priority
      WHEN 'alta' THEN 3
      WHEN 'media' THEN 2
      WHEN 'baja' THEN 1
      ELSE 0
    END DESC,
    r.created_at DESC`;

  if (!filters.cursor && filters.sort) {
    const validSortColumns = {
      'ticket_code': 'r.ticket_code',
      'created_by_name': 'creator.full_name',
      'module_name': 'm.name',
      'status': `CASE r.status
                   WHEN 'PENDIENTE' THEN 1
                   WHEN 'ASIGNADA' THEN 2
                   WHEN 'EN_PROCESO' THEN 3
                   WHEN 'EN_PRUEBAS' THEN 4
                   WHEN 'COMPLETADA' THEN 5
                   WHEN 'RECHAZADA' THEN 6
                   ELSE 0
                 END`,
      'priority': `CASE r.priority
                     WHEN 'alta' THEN 3
                     WHEN 'media' THEN 2
                     WHEN 'baja' THEN 1
                     ELSE 0
                   END`,
      'assigned_to_name': 'assignee.full_name',
      'created_at': 'r.created_at'
    };

    if (validSortColumns[filters.sort]) {
      const order = filters.order && filters.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      orderByClause = ` ORDER BY ${validSortColumns[filters.sort]} ${order} NULLS LAST, r.request_id ASC`;
    }
  }

  querySql += orderByClause;

  if (!filters.cursor) {
    querySql += ` LIMIT $${qIdx++} OFFSET $${qIdx++}`;
    queryValues.push(limit, (page - 1) * limit);
  } else {
    querySql += ` LIMIT $${qIdx++}`;
    queryValues.push(limit + 1);
  }

  const result = await pool.query(querySql, queryValues);
  let rows = result.rows;
  let hasMore = false;

  if (filters.cursor) {
    rows = result.rows.slice(0, limit);
    hasMore = result.rows.length > limit;
  } else {
    hasMore = page < totalPages;
  }

  return {
    requests: rows,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      hasMore,
      nextCursor: hasMore && rows.length > 0 ? rows[rows.length - 1].created_at : null,
    },
  };
}

async function findById(requestId, userRole, userDeptId, isBoss, userId, isDeptBoss = false) {
  let sql = `SELECT r.*,
             creator.full_name as created_by_name,
             assignee.full_name as assigned_to_name,
             m.name as module_name,
             m.is_systems,
             rt.name as request_type_name,
             COALESCE(d.name, creator_d.name, 'SIN DEPARTAMENTO') as department_name,
             assigned_d.name as assigned_department_name,
             a.name as area_name
             FROM requests r
             LEFT JOIN users creator ON creator.user_id = r.created_by
             LEFT JOIN users assignee ON assignee.user_id = r.assigned_to
             LEFT JOIN modules m ON m.module_id = r.module_id
             LEFT JOIN request_types rt ON rt.request_type_id = r.request_type_id
             LEFT JOIN departments d ON d.department_id = r.department_id
             LEFT JOIN departments creator_d ON creator_d.department_id = creator.department_id
             LEFT JOIN departments assigned_d ON assigned_d.department_id = r.assigned_department_id
             LEFT JOIN areas a ON a.area_id = r.area_id
             WHERE r.request_id = $1`;
  const values = [requestId];
  let idx = 2;

  if (userRole !== 'admin' && userDeptId != null) {
    if (isDeptBoss) {
      // Jefe de departamento ve TODAS las solicitudes de su departamento
      sql += ` AND (r.department_id = $${idx} OR r.assigned_department_id = $${idx} OR creator.department_id = $${idx})`;
      values.push(userDeptId);
      idx++;
    } else if (isBoss) {
      // Jefe de área ve las de su área
      sql += ` AND (r.area_id = $${idx} OR (r.created_by = $${idx} AND r.area_id IS NULL))`;
      values.push(userId);
      idx++;
    } else if (userId != null) {
      sql += ` AND (r.assigned_to = $${idx} OR r.created_by = $${idx})`;
      values.push(userId);
      idx++;
    }
  }

  const result = await pool.query(sql, values);
  return result.rows[0] || null;
}

async function create(data, userId, userDeptId) {
  const { moduleId, requestTypeId, priority, processDescription, currentBehavior, expectedBehavior } = data;
  const cleanPriority = ['baja', 'media', 'alta'].includes((priority || '').toLowerCase().trim())
    ? priority.toLowerCase().trim()
    : 'media';

  const result = await pool.query(
    `INSERT INTO requests (created_by, department_id, module_id, request_type_id, priority,
      process_description, current_behavior, expected_behavior)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, userDeptId, moduleId, requestTypeId, cleanPriority,
     processDescription, currentBehavior, expectedBehavior]
  );

  return result.rows[0];
}

async function updateStatus(requestId, newStatus, rejectionReason, userId, userRole, userDeptId, isBoss, isDeptBoss = false) {
  // Verificar que la solicitud existe y es accesible
  const request = await findById(requestId, userRole, userDeptId, isBoss, userId, isDeptBoss);
  if (!request) {
    throw Object.assign(new Error('Solicitud no encontrada'), { status: 404 });
  }

  // Transiciones libres: se permite cualquier cambio de estado (ya no se valida en backend)

  // RECHAZADA requiere motivo
  if (newStatus === 'RECHAZADA' && !rejectionReason) {
    throw Object.assign(
      new Error('El motivo de rechazo es obligatorio'),
      { status: 400 }
    );
  }

  // COMPLETADA marca completed_at
  const completedAt = newStatus === 'COMPLETADA' ? new Date() : null;

  // Registrar el cambio en el historial vía trigger de BD:
  // el trigger lee el actor real de la variable de sesión app.current_user_id,
  // seteada dentro de esta transacción (set_config con is_local=true la
  // descarta automáticamente al hacer COMMIT/ROLLBACK).
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);

    // Optimistic locking con version_number
    const result = await client.query(
      `UPDATE requests SET status = $1, rejection_reason = $2, completed_at = $3,
              version_number = version_number + 1
       WHERE request_id = $4 AND version_number = $5
       RETURNING *`,
      [newStatus, rejectionReason || null, completedAt, requestId, request.version_number]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Conflicto de concurrencia. Intentá de nuevo.'), { status: 409 });
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ya terminada */ }
    throw err;
  } finally {
    client.release();
  }
}

async function updatePriority(requestId, priority, userRole, userDeptId, isBoss, userId, isDeptBoss = false) {
  // Verificar que la solicitud existe y es accesible
  const request = await findById(requestId, userRole, userDeptId, isBoss, userId, isDeptBoss);
  if (!request) {
    throw Object.assign(new Error('Solicitud no encontrada'), { status: 404 });
  }

  // Validar prioridad (se almacena en minúsculas: baja/media/alta)
  if (!VALID_PRIORITIES.includes(priority)) {
    throw Object.assign(new Error('Prioridad inválida'), { status: 400 });
  }

  // Optimistic locking con version_number
  const result = await pool.query(
    `UPDATE requests SET priority = $1, version_number = version_number + 1
     WHERE request_id = $2 AND version_number = $3
     RETURNING *`,
    [priority, requestId, request.version_number]
  );

  if (result.rows.length === 0) {
    throw Object.assign(new Error('Conflicto de concurrencia'), { status: 409 });
  }

  return result.rows[0];
}

async function assign(requestId, assigneeId, assignedDepartmentId, userRole, userDeptId, isBoss, userId, isDeptBoss = false, areaId = null) {
  const request = await findById(requestId, userRole, userDeptId, isBoss, userId, isDeptBoss);
  if (!request) {
    throw Object.assign(new Error('Solicitud no encontrada'), { status: 404 });
  }

  // Verificar que el asignado existe
  if (assigneeId) {
    const userResult = await pool.query(
      `SELECT user_id FROM users WHERE user_id = $1 AND is_active = true`,
      [assigneeId]
    );
    if (userResult.rows.length === 0) {
      throw Object.assign(new Error('Empleado no encontrado'), { status: 404 });
    }
  }

  // Verificar que el área existe si se proporciona
  if (areaId) {
    const areaResult = await pool.query(
      `SELECT area_id FROM areas WHERE area_id = $1 AND is_active = true`,
      [areaId]
    );
    if (areaResult.rows.length === 0) {
      throw Object.assign(new Error('Área no encontrada'), { status: 404 });
    }
  }

  // Update
  const client = await pool.connect();
  let result;
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    
    result = await client.query(
      `UPDATE requests SET assigned_to = $1, assigned_department_id = $2, area_id = $3, status = 'ASIGNADA', version_number = version_number + 1 WHERE request_id = $4 AND version_number = $5 RETURNING *`,
      [assigneeId || null, assignedDepartmentId || null, areaId || null, requestId, request.version_number]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      throw Object.assign(new Error('Conflicto de concurrencia. Intentá de nuevo.'), { status: 409 });
    }

    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }

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

async function remove(requestId, userRole, userDeptId, isBoss, userId, isDeptBoss = false) {
  const request = await findById(requestId, userRole, userDeptId, isBoss, userId, isDeptBoss);
  if (!request) {
    throw Object.assign(new Error('Solicitud no encontrada'), { status: 404 });
  }

  if (userRole === 'requester') {
    throw Object.assign(new Error('No tienes permiso para eliminar solicitudes'), { status: 403 });
  }

  const result = await pool.query('DELETE FROM requests WHERE request_id = $1 RETURNING *', [requestId]);
  return result.rows[0];
}

module.exports = { findAll, findById, create, updateStatus, updatePriority, assign, getAttachments, getHistory, remove };

