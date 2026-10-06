const pool = require('../db/pool');

const SERVICE_TYPES = [
  'INST/ACTUAL DE PROGRAMAS',
  'ADMON/SOPORTE CENTRAL TELEFÓNICA',
  'INST/REV/REP HARDWARE',
  'CHEQUEO/MTTO/REP DE PC',
  'INST/REP/MTTO DE TELEFONÍA',
  'OTROS',
  'VERIF. DE CONEXIÓN A RED',
  'INST/REP/MTTO DE PUNTO DE RED',
];

// Servicio Técnico ahora usa la tabla requests con request_type_id = 8
const ST_REQUEST_TYPE_ID = 8;

async function generateCode() {
  const year = new Date().getFullYear();
  const result = await pool.query("SELECT nextval('service_ticket_seq') as seq");
  const seq = result.rows[0].seq;
  return `ST-${year}-${String(seq).padStart(4, '0')}`;
}

async function findAll(filters = {}) {
  let sql = 'FROM requests r LEFT JOIN users assignee ON assignee.user_id = r.assigned_to LEFT JOIN users creator ON creator.user_id = r.created_by';
  const conditions = [`r.request_type_id = ${ST_REQUEST_TYPE_ID}`];
  const values = [];
  let idx = 1;

  if (filters.status) {
    conditions.push(`r.status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters.search) {
    conditions.push(`(r.ticket_code ILIKE $${idx} OR creator.full_name ILIKE $${idx} OR r.process_description ILIKE $${idx} OR r.extension ILIKE $${idx})`);
    values.push(`%${filters.search}%`);
    idx++;
  }
  if (filters.technicianId) {
    conditions.push(`r.assigned_to = $${idx++}`);
    values.push(filters.technicianId);
  }

  const where = ' WHERE ' + conditions.join(' AND ');

  const countResult = await pool.query(`SELECT COUNT(*) ${sql} ${where}`, values);
  const total = parseInt(countResult.rows[0].count, 10);

  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 20, 100);

  const result = await pool.query(
    `SELECT r.*, creator.full_name as requester_name, assignee.full_name as technician_name
     ${sql}
     ${where}
     ORDER BY r.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...values, limit, (page - 1) * limit]
  );

  return {
    tickets: result.rows,
    pagination: { page, limit, totalItems: total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

async function findByCode(code) {
  const result = await pool.query(
    `SELECT r.*, 
            creator.full_name as requester_name, 
            creator.cedula as requester_cedula,
            COALESCE(c.name, p.position, creator.position, r.position) as requester_position,
            c.name as cargo_name,
            d.name as department_name,
            assignee.full_name as technician_name,
            assignee.cedula as technician_cedula
     FROM requests r
     LEFT JOIN users assignee ON assignee.user_id = r.assigned_to
     LEFT JOIN users creator ON creator.user_id = r.created_by
     LEFT JOIN departments d ON d.department_id = COALESCE(r.department_id, creator.department_id)
     LEFT JOIN LATERAL (
       SELECT p.cargo_id, p.position
       FROM persona p
       WHERE (
         creator.cedula IS NOT NULL 
         AND regexp_replace(p.cedula, '[^0-9]', '', 'g') = regexp_replace(creator.cedula, '[^0-9]', '', 'g')
       ) OR (
         creator.cedula IS NULL 
         AND creator.email IS NOT NULL 
         AND LOWER(p.email) = LOWER(creator.email)
       )
       ORDER BY p.cargo_id IS NOT NULL DESC, p.created_at DESC NULLS LAST
       LIMIT 1
     ) p ON true
     LEFT JOIN cargos c ON c.cargo_id = p.cargo_id
     WHERE r.ticket_code = $1 AND r.request_type_id = $2`,
    [code, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(
    `SELECT r.*, 
            creator.full_name as requester_name, 
            creator.cedula as requester_cedula,
            COALESCE(c.name, p.position, creator.position, r.position) as requester_position,
            c.name as cargo_name,
            d.name as department_name,
            assignee.full_name as technician_name,
            assignee.cedula as technician_cedula
     FROM requests r
     LEFT JOIN users assignee ON assignee.user_id = r.assigned_to
     LEFT JOIN users creator ON creator.user_id = r.created_by
     LEFT JOIN departments d ON d.department_id = COALESCE(r.department_id, creator.department_id)
     LEFT JOIN LATERAL (
       SELECT p.cargo_id, p.position
       FROM persona p
       WHERE (
         creator.cedula IS NOT NULL 
         AND regexp_replace(p.cedula, '[^0-9]', '', 'g') = regexp_replace(creator.cedula, '[^0-9]', '', 'g')
       ) OR (
         creator.cedula IS NULL 
         AND creator.email IS NOT NULL 
         AND LOWER(p.email) = LOWER(creator.email)
       )
       ORDER BY p.cargo_id IS NOT NULL DESC, p.created_at DESC NULLS LAST
       LIMIT 1
     ) p ON true
     LEFT JOIN cargos c ON c.cargo_id = p.cargo_id
     WHERE r.request_id = $1 AND r.request_type_id = $2`,
    [id, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function accept(ticketId, technicianId, assetConsecutive) {
  const cleanAsset = assetConsecutive ? normalizeText(assetConsecutive) : null;
  const result = await pool.query(
    `UPDATE requests SET 
      assigned_to = COALESCE($1, assigned_to), 
      status = 'EN_PROCESO',
      service_start_time = COALESCE(service_start_time, now()),
      asset_consecutive = COALESCE($2, asset_consecutive),
      version_number = version_number + 1
     WHERE request_id = $3 AND status IN ('PENDIENTE', 'ASIGNADA') AND request_type_id = $4
     RETURNING *`,
    [technicianId, cleanAsset, ticketId, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function reject(ticketId, reason, assetConsecutive) {
  const cleanAsset = assetConsecutive ? normalizeText(assetConsecutive) : null;
  const result = await pool.query(
    `UPDATE requests SET 
      status = 'RECHAZADA',
      rejection_reason = $1,
      asset_consecutive = COALESCE($2, asset_consecutive),
      version_number = version_number + 1
     WHERE request_id = $3 AND status IN ('PENDIENTE', 'ASIGNADA') AND request_type_id = $4
     RETURNING *`,
    [reason || 'Rechazado por servicio técnico', cleanAsset, ticketId, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function assign(ticketId, technicianId, assetConsecutive) {
  const cleanAsset = assetConsecutive ? normalizeText(assetConsecutive) : null;
  const result = await pool.query(
    `UPDATE requests SET 
      assigned_to = $1, 
      status = 'ASIGNADA',
      asset_consecutive = COALESCE($2, asset_consecutive),
      version_number = version_number + 1
     WHERE request_id = $3 AND status IN ('PENDIENTE', 'ASIGNADA', 'EN_PROCESO') AND request_type_id = $4
     RETURNING *`,
    [technicianId, cleanAsset, ticketId, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function getTechnicians() {
  const result = await pool.query(
    `SELECT u.user_id, u.full_name, u.email, u.role, u.department_id, d.name as department_name
     FROM users u
     LEFT JOIN departments d ON d.department_id = u.department_id
     WHERE u.is_active = true 
       AND (u.role IN ('tecnico', 'developer', 'jefe_st', 'super_admin', 'admin', 'jefe_area') 
            OR u.department_id = 13)
     ORDER BY u.full_name ASC`
  );
  return result.rows;
}

async function close(ticketId, data = {}) {
  const closeObs = data.closeObservations ? data.closeObservations.trim() : null;
  if (!closeObs) {
    throw Object.assign(new Error('La observación de cierre es obligatoria.'), { status: 400 });
  }
  const cleanAsset = data.assetConsecutive ? normalizeText(data.assetConsecutive) : null;
  const result = await pool.query(
    `UPDATE requests SET 
      status = 'COMPLETADA',
      service_close_time = now(),
      service_type = COALESCE($1, service_type),
      close_observations = $2,
      resolution_notes = $2,
      asset_consecutive = COALESCE($3, asset_consecutive),
      completed_at = now(),
      version_number = version_number + 1
     WHERE request_id = $4 AND status = 'EN_PROCESO' AND request_type_id = $5
     RETURNING *`,
    [data.serviceType || null, closeObs, cleanAsset, ticketId, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function rate(code, satisfaction) {
  const result = await pool.query(
    `UPDATE requests SET satisfaction = $1, version_number = version_number + 1
     WHERE ticket_code = $2 AND status = 'COMPLETADA' AND request_type_id = $3
     RETURNING *`,
    [satisfaction, code, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function getStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'PENDIENTE') as pending,
      COUNT(*) FILTER (WHERE status = 'ASIGNADA') as assigned,
      COUNT(*) FILTER (WHERE status = 'EN_PROCESO') as in_progress,
      COUNT(*) FILTER (WHERE status = 'COMPLETADA') as closed,
      COUNT(*) FILTER (WHERE satisfaction = 'satisfecho') as satisfied,
      COUNT(*) FILTER (WHERE satisfaction = 'no_satisfecho') as unsatisfied,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())) as this_month
    FROM requests
    WHERE request_type_id = $1
  `, [ST_REQUEST_TYPE_ID]);
  return result.rows[0];
}

// Normaliza texto: elimina acentos y convierte a mayúsculas
function normalizeText(str) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

// Tope de longitud del cargo. Es el límite de seguridad del catálogo, NO un
// filtro de formato: cualquier texto dentro de este límite es válido. Debe
// coincidir con MAX_CARGO_LENGTH del formulario de servicio técnico.
const MAX_CARGO_LENGTH = 120;

async function create({ cedula, nombre, apellido, email, departmentName, position, extension, assignedArea, serviceType, description, observations }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Normalizar cédula
    const normalizedCedula = normalizeText(cedula);

    // 2. Resolver el cargo contra el catálogo ANTES de tocar persona y requests,
    // en la misma transacción que crea el ticket (atómico, sin segundo round
    // trip, y sin poder inflar el catálogo sin registrar una solicitud).
    // Se normaliza UNA sola vez y antes de insertar, para que exista una única
    // cadena canónica que viaje a cargos.name, persona.position y
    // requests.position: si el catálogo guardara "SECRETARIO EJECUTIVO II" y el
    // ticket "Secretario Ejecutivo II", el validador de pertenencia rechazaría
    // el prefill del próximo solicitante y bloquearía el Paso 1.
    // La ruta es pública y no valida tipos: sin este chequeo, un body con
    // `position: {}` terminaba como fila "[OBJECT OBJECT]" en el catálogo
    // compartido. Texto escrito por una persona y basura de un body arbitrario
    // no son lo mismo.
    const cargoTexto = typeof position === 'string' ? position : '';
    const rawCargo = cargoTexto ? normalizeText(cargoTexto).slice(0, MAX_CARGO_LENGTH) : '';
    let canonicalPosition = null;
    // Id del mismo catálogo que resolvió canonicalPosition. Viaja junto al
    // nombre a persona.cargo_id (FK, migración 025); requests.position
    // sigue siendo solo texto porque es snapshot.
    let canonicalCargoId = null;
    if (rawCargo) {
      // ON CONFLICT DO NOTHING: dos solicitantes pueden escribir el mismo cargo
      // nuevo al mismo tiempo. Con un INSERT pelado el segundo abortaría la
      // transacción y perdería el ticket (unique_violation 23505).
      await client.query(
        'INSERT INTO cargos (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [rawCargo]
      );
      // Se relee la fila para usar el nombre tal como quedó en la base, y de
      // paso el cargo_id que exige la FK de persona (migración 025). Se toman
      // los DOS de la misma fila a propósito: si el id y el nombre se sacaran
      // de consultas distintas, un rename concurrente entre ambas podría
      // dejar persona.cargo_id apuntando a un cargo y persona.position
      // nombrando otro.
      // Sin filtro is_active: si el solicitante escribió el cargo a mano, se le
      // registra igual. is_active gobierna la LISTA pública del catálogo
      // (getCargos la filtra), no si el cargo vale como hecho histórico de
      // esa persona. Filtrar acá descartaba en silencio lo que el solicitante
      // acababa de escribir, sin error de por medio.
      const cargoResult = await client.query(
        'SELECT cargo_id, name FROM cargos WHERE name = $1',
        [rawCargo]
      );
      canonicalPosition = cargoResult.rows[0] ? cargoResult.rows[0].name : null;
      canonicalCargoId = cargoResult.rows[0] ? cargoResult.rows[0].cargo_id : null;
    }

    // 3. Buscar o crear persona
    // Si el solicitante cambió el cargo, se actualiza a la nueva posición canónica.
    // position y cargo_id se escriben juntos y salen de la MISMA fila de cargos.
    // El COALESCE se replica en las dos columnas a propósito: si el solicitante
    // no manda cargo (canonicalCargoId es null), una persona que ya tenía uno
    // conserva tanto el id como el texto. Con NULLIF/COALESCE, un envío en
    // blanco no puede dejar cargo_id apuntando a NULL con position todavía
    // poblado, que es el estado que rompe el prefill.
    const personaResult = await client.query(
      `INSERT INTO persona (cedula, nombre, apellido, email, position, cargo_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (cedula) DO UPDATE
         SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido,
             email = COALESCE(EXCLUDED.email, persona.email),
             position = COALESCE(NULLIF(EXCLUDED.position, ''), persona.position),
             cargo_id = COALESCE(EXCLUDED.cargo_id, persona.cargo_id),
             updated_at = now()
       RETURNING cedula, nombre, apellido, email, position, cargo_id`,
      [normalizedCedula, normalizeText(nombre), normalizeText(apellido), email ? email.toLowerCase().trim() : null, canonicalPosition, canonicalCargoId]
    );
    const persona = personaResult.rows[0];

    // Buscar department_id por nombre
    let deptId = null;
    if (departmentName) {
      const deptResult = await client.query('SELECT department_id FROM departments WHERE UPPER(name) = UPPER($1)', [departmentName.trim()]);
      if (deptResult.rows.length > 0) deptId = deptResult.rows[0].department_id;
    }

    // 4. Buscar o crear usuario por email y sincronizar cargo / cédula
    let userId;
    const userResult = await client.query('SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].user_id;
      await client.query(
        `UPDATE users 
         SET cedula = COALESCE(cedula, $1),
             position = COALESCE($2, position),
             department_id = COALESCE($3, department_id)
         WHERE user_id = $4`,
        [normalizedCedula, canonicalPosition, deptId, userId]
      );
    } else {
      const bcrypt = require('bcryptjs');
      const dummyHash = await bcrypt.hash('service_ticket_' + Date.now(), 8);
      const fullName = `${persona.nombre} ${persona.apellido}`;
      const newUser = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role, department_id, cedula, position)
         VALUES ($1, $2, $3, 'requester', $4, $5, $6) RETURNING user_id`,
        [fullName, email.trim(), dummyHash, deptId, normalizedCedula, canonicalPosition]
      );
      userId = newUser.rows[0].user_id;
    }

    // Sincronizar también persona y users con esa misma cédula (con o sin prefijo V-)
    if (canonicalPosition) {
      // Esta segunda escritura de persona.position también tiene que llevar
      // cargo_id: si una cédula se grabó antes de la migración 025, su fila de
      // persona puede tener cargo_id NULL y este UPDATE la deja sincronizada
      // con el texto. Sin el id, la FK queda desalineada del texto espejo.
      // La guarda es `canonicalPosition` y no `canonicalCargoId` a propósito:
      // ambos salen de la misma fila de cargos, así que la guarda no deja
      // pasar ningún caso con texto y sin id.
      await client.query(
        `UPDATE persona 
         SET position = $1, cargo_id = $2, updated_at = now() 
         WHERE UPPER(REPLACE(REPLACE(cedula, 'V-', ''), 'V', '')) = UPPER(REPLACE(REPLACE($3, 'V-', ''), 'V', ''))`,
        [canonicalPosition, canonicalCargoId, normalizedCedula]
      );
      await client.query(
        `UPDATE users 
         SET position = $1 
         WHERE UPPER(REPLACE(REPLACE(cedula, 'V-', ''), 'V', '')) = UPPER(REPLACE(REPLACE($2, 'V-', ''), 'V', ''))`,
        [canonicalPosition, normalizedCedula]
      );
    }

    // 5. Asignar department_id del ticket
    let departmentId = deptId;

    // 6. Generar código de ticket
    const ticketCode = await generateCode();

    // 7. Insertar en requests con request_type_id = 8
    // position replica el MISMO canonicalPosition que se escribió en persona y
    // que quedó en cargos.name: los tres strings son idénticos. Es el snapshot
    // histórico del cargo y lo consume el PDF (serviceTicketPdf.service.js).
    const result = await client.query(
      `INSERT INTO requests
        (ticket_code, request_type_id, department_id, created_by, status,
         process_description, current_behavior, expected_behavior,
         extension, position, service_type, priority)
       VALUES ($1, $2, $3, $4, 'PENDIENTE',
         $5, $6, $7,
         $8, $9, $10, 'media')
       RETURNING *`,
      [
        ticketCode,
        ST_REQUEST_TYPE_ID,
        departmentId,
        userId,
        normalizeText(description || ''),
        normalizeText(observations || ''),
        normalizeText(assignedArea || ''),
        extension || null,
        canonicalPosition,
        serviceType || null,
      ]
    );

    const ticket = result.rows[0];
    await client.query('COMMIT');
    return ticket;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  SERVICE_TYPES,
  ST_REQUEST_TYPE_ID,
  findAll,
  findByCode,
  findById,
  accept,
  reject,
  assign,
  close,
  rate,
  getStats,
  create,
  getTechnicians,
};
