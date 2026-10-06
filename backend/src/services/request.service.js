const pool = require('../db/pool');

// VALID_TRANSITIONS se eliminó para permitir cualquier cambio de estado

const VALID_PRIORITIES = ['baja', 'media', 'alta'];

// Devuelve el área del actor para el rol jefe_area. El token ya incluye areaId;
// los tokens antiguos pueden no traerla, así que en ese caso la consultamos en
// la BD (una sola consulta barata) sin modificar la forma del token.
async function getActorAreaId(userId, userRole, userAreaId = null) {
  if (userRole !== 'jefe_area') return userAreaId || null;
  if (userAreaId) return userAreaId;
  const result = await pool.query('SELECT area_id FROM users WHERE user_id = $1', [userId]);
  return result.rows[0] && result.rows[0].area_id ? result.rows[0].area_id : null;
}

async function findAll(filters, userId, userRole, userDeptId, isBoss, isDeptBoss = false, userAreaId = null) {
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

  // Lógica de Control de Acceso por Rol
  switch (userRole) {
    case 'super_admin':
    case 'admin':
    case 'director':
    case 'sub_director':
      // Ven TODO — sin filtros
      break;

    case 'recepcion':
      // Su bandeja es SOLO la cola de filtrar: las que esperan decidir
      // (derivar a un área o rechazar). No ve el listado general.
      // Para responder en mostrador: consulta puntual por id (findById) o
      // búsqueda por cédula/código en /buscar.
      conditions.push(`r.status = 'PENDIENTE'`);
      break;

    case 'jefe_st':
      // Jefe de servicio técnico ve solo solicitudes tipo Servicio Técnico (type_id = 8)
      conditions.push(`r.request_type_id = 8`);
      break;

    case 'jefe_area': {
      // Ve las solicitudes de SU área, las que él creó sin derivar y las asignadas a él
      const actorAreaId = await getActorAreaId(userId, userRole, userAreaId);
      if (actorAreaId) {
        conditions.push(`(r.area_id = $${idx} OR (r.created_by = $${idx + 1} AND r.area_id IS NULL) OR r.assigned_to = $${idx + 1})`);
        values.push(actorAreaId, userId);
        idx += 2;
      } else {
        conditions.push(`((r.created_by = $${idx} AND r.area_id IS NULL) OR r.assigned_to = $${idx})`);
        values.push(userId);
        idx += 1;
      }
      break;
    }

    case 'developer':
    case 'tecnico':
      // Ven las asignadas a ellos o las que crearon
      conditions.push(`(r.assigned_to = $${idx} OR r.created_by = $${idx})`);
      values.push(userId);
      idx++;
      break;

    case 'requester':
      // Solo ven sus propias solicitudes
      conditions.push(`r.created_by = $${idx}`);
      values.push(userId);
      idx++;
      break;

    default:
      // Sin rol conocido, no ve nada
      conditions.push(`1 = 0`);
      break;
  }

  // En recepción el estado ya está fijado arriba a PENDIENTE: aplicar además
  // el filtro del usuario generaría `status = X AND status = 'PENDIENTE'` (lista
  // vacía) o, peor, abriría otra cola con un ?status= armado a mano.
  if (filters.status && userRole !== 'recepcion') {
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
  if (filters.unassigned === 'true' || filters.unassigned === '1') {
    // Solicitudes derivadas pero aún no asignadas a un empleado
    conditions.push(`r.assigned_to IS NULL`);
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

async function findById(requestId, userRole, userDeptId, isBoss, userId, isDeptBoss = false, userAreaId = null) {
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

  // Control de acceso por rol
  switch (userRole) {
    case 'super_admin':
    case 'admin':
    case 'director':
    case 'sub_director':
      // Ven todo — sin filtros adicionales
      break;

    case 'recepcion':
      // SIN restricción acá a propósito: la consulta puntual por id es la
      // habilidad de "¿en qué estado está esta solicitud?" para responder en
      // mostrador (y para que el refetch posterior a su propio rechazo/derivación
      // no devuelva 404). Lo restringido es el LISTADO, no la consulta de una.
      break;

    case 'jefe_area': {
      // Ve las solicitudes de SU área, las que él creó sin derivar y las asignadas a él
      const actorAreaId = await getActorAreaId(userId, userRole, userAreaId);
      if (actorAreaId) {
        sql += ` AND (r.area_id = $${idx} OR (r.created_by = $${idx + 1} AND r.area_id IS NULL) OR r.assigned_to = $${idx + 1})`;
        values.push(actorAreaId, userId);
        idx += 2;
      } else {
        sql += ` AND ((r.created_by = $${idx} AND r.area_id IS NULL) OR r.assigned_to = $${idx})`;
        values.push(userId);
        idx += 1;
      }
      break;
    }

    case 'developer':
    case 'tecnico':
      sql += ` AND (r.assigned_to = $${idx} OR r.created_by = $${idx})`;
      values.push(userId);
      idx++;
      break;

    case 'requester':
      sql += ` AND r.created_by = $${idx}`;
      values.push(userId);
      idx++;
      break;

    default:
      sql += ` AND 1 = 0`;
      break;
  }

  const result = await pool.query(sql, values);
  return result.rows[0] || null;
}

async function create(data, userId, userDeptId) {
  const { moduleId, requestTypeId, priority, processDescription, currentBehavior, expectedBehavior, extension } = data;
  const cleanPriority = ['baja', 'media', 'alta'].includes((priority || '').toLowerCase().trim())
    ? priority.toLowerCase().trim()
    : 'media';

  const result = await pool.query(
    `INSERT INTO requests (created_by, department_id, module_id, request_type_id, priority,
      process_description, current_behavior, expected_behavior, extension)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [userId, userDeptId, moduleId || null, requestTypeId, cleanPriority,
     processDescription, currentBehavior, expectedBehavior, extension || null]
  );

  return result.rows[0];
}

async function updateStatus(requestId, newStatus, rejectionReason, userId, userRole, userDeptId, isBoss, isDeptBoss = false, assetConsecutive = null, observation = null) {
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

  // Si la solicitud es de soporte técnico y va a pasar de PENDIENTE a otro estado, exigir número de bien
  const isSupport =
    Number(request.request_type_id) === 8 ||
    Number(request.area_id) === 1 ||
    request.request_type_code === 'ST' ||
    (request.request_type_name && request.request_type_name.toUpperCase().includes('SERVICIO TÉCNICO'));

  const cleanAsset = assetConsecutive ? String(assetConsecutive).trim().toUpperCase() : null;

  // Al completar una solicitud de soporte técnico, exigir número de bien
  if (isSupport && newStatus === 'COMPLETADA') {
    if (!cleanAsset && !request.asset_consecutive) {
      throw Object.assign(
        new Error('El número de bien es obligatorio para completar solicitudes de soporte técnico'),
        { status: 400 }
      );
    }
  }

  // COMPLETADA requiere observación obligatoria
  const cleanObs = observation ? String(observation).trim() : null;
  if (newStatus === 'COMPLETADA') {
    const existingObs = (request.close_observations && request.close_observations.trim()) || (request.resolution_notes && request.resolution_notes.trim());
    if (!cleanObs && !existingObs) {
      throw Object.assign(
        new Error('La observación es obligatoria al completar la tarea o solicitud'),
        { status: 400 }
      );
    }
  }

  // COMPLETADA marca completed_at y service_close_time
  const completedAt = newStatus === 'COMPLETADA' ? new Date() : null;
  const closeTime = newStatus === 'COMPLETADA' ? new Date() : null;

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
              service_close_time = COALESCE($6, service_close_time),
              close_observations = COALESCE($7, close_observations),
              resolution_notes = COALESCE($7, resolution_notes),
              asset_consecutive = COALESCE($8, asset_consecutive),
              version_number = version_number + 1
       WHERE request_id = $4 AND version_number = $5
       RETURNING *`,
      [newStatus, rejectionReason || null, completedAt, requestId, request.version_number, closeTime, cleanObs, cleanAsset]
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

async function assign(requestId, assigneeId, assignedDepartmentId, userRole, userDeptId, isBoss, userId, isDeptBoss = false, areaId = null, userAreaId = null, assetConsecutive = null) {
  // Defensa en profundidad: además del gate de rol en la ruta, validamos aquí
  // qué puede hacer cada rol sobre la solicitud.
  const actorAreaId = userRole === 'jefe_area'
    ? await getActorAreaId(userId, userRole, userAreaId)
    : null;
  if (userRole === 'jefe_area' && !actorAreaId) {
    throw Object.assign(new Error('No tienes un área asignada para asignar solicitudes'), { status: 403 });
  }

  const request = await findById(requestId, userRole, userDeptId, isBoss, userId, isDeptBoss, actorAreaId || userAreaId);
  if (!request) {
    // Para jefe_area distinguimos "existe pero pertenece a otra área" (403)
    // de "no existe" (404)
    if (actorAreaId) {
      const rawResult = await pool.query('SELECT area_id FROM requests WHERE request_id = $1', [requestId]);
      if (rawResult.rows.length > 0 && rawResult.rows[0].area_id) {
        throw Object.assign(new Error('La solicitud pertenece a otra área'), { status: 403 });
      }
    }
    throw Object.assign(new Error('Solicitud no encontrada'), { status: 404 });
  }

  if (userRole === 'recepcion') {
    // Recepción solo filtra: deriva la solicitud a un área, no la asigna a un empleado
    if (assigneeId) {
      throw Object.assign(
        new Error('El rol de recepción solo puede derivar la solicitud a un área; no puede asignarla a un empleado'),
        { status: 400 }
      );
    }
    if (!areaId) {
      throw Object.assign(
        new Error('Debe indicar el área a la que se deriva la solicitud'),
        { status: 400 }
      );
    }
    if (request.status !== 'PENDIENTE') {
      throw Object.assign(
        new Error('La solicitud solo puede derivarse a un área si está en estado PENDIENTE'),
        { status: 400 }
      );
    }
  } else if (userRole === 'jefe_area') {
    // El jefe de área solo asigna empleados de SU área
    if (areaId && Number(areaId) !== Number(actorAreaId)) {
      throw Object.assign(
        new Error('No puedes derivar la solicitud a otra área que no sea la tuya'),
        { status: 400 }
      );
    }
    if (request.area_id && Number(request.area_id) !== Number(actorAreaId)) {
      throw Object.assign(
        new Error('La solicitud pertenece a otra área'),
        { status: 403 }
      );
    }
    if (!assigneeId) {
      throw Object.assign(
        new Error('Debe indicar el empleado que tomará la solicitud'),
        { status: 400 }
      );
    }
    const employeeResult = await pool.query(
      `SELECT user_id, area_id, is_active FROM users WHERE user_id = $1`,
      [assigneeId]
    );
    if (employeeResult.rows.length === 0) {
      throw Object.assign(new Error('Empleado no encontrado'), { status: 404 });
    }
    const employee = employeeResult.rows[0];
    if (!employee.is_active) {
      throw Object.assign(new Error('El empleado seleccionado no está activo'), { status: 400 });
    }
    if (!employee.area_id || Number(employee.area_id) !== Number(actorAreaId)) {
      throw Object.assign(new Error('El empleado seleccionado no pertenece a tu área'), { status: 400 });
    }
    // La solicitud queda (o se mantiene) en el área del jefe; si no viene el
    // departamento en el payload, conservamos el que ya tenía
    areaId = actorAreaId;
    if (!assignedDepartmentId && request.assigned_department_id) {
      assignedDepartmentId = request.assigned_department_id;
    }
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

  const isSupport =
    Number(request.request_type_id) === 8 ||
    Number(request.area_id) === 1 ||
    Number(areaId) === 1 ||
    request.request_type_code === 'ST' ||
    (request.request_type_name && request.request_type_name.toUpperCase().includes('SERVICIO TÉCNICO'));

  const cleanAsset = assetConsecutive ? String(assetConsecutive).trim().toUpperCase() : null;

  // Update
  const client = await pool.connect();
  let result;
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    
    result = await client.query(
      `UPDATE requests SET 
        assigned_to = $1, 
        assigned_department_id = $2, 
        area_id = $3, 
        status = CASE WHEN status = 'PENDIENTE' THEN 'ASIGNADA' ELSE status END,
        service_start_time = CASE WHEN status = 'PENDIENTE' THEN now() ELSE service_start_time END,
        asset_consecutive = COALESCE($6, asset_consecutive),
        version_number = version_number + 1 
       WHERE request_id = $4 AND version_number = $5 
       RETURNING *`,
      [assigneeId || null, assignedDepartmentId || null, areaId || null, requestId, request.version_number, cleanAsset]
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

