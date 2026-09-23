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
    `SELECT r.*, creator.full_name as requester_name, assignee.full_name as technician_name
     FROM requests r
     LEFT JOIN users assignee ON assignee.user_id = r.assigned_to
     LEFT JOIN users creator ON creator.user_id = r.created_by
     WHERE r.ticket_code = $1 AND r.request_type_id = $2`,
    [code, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(
    `SELECT r.*, creator.full_name as requester_name, assignee.full_name as technician_name
     FROM requests r
     LEFT JOIN users assignee ON assignee.user_id = r.assigned_to
     LEFT JOIN users creator ON creator.user_id = r.created_by
     WHERE r.request_id = $1 AND r.request_type_id = $2`,
    [id, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function accept(ticketId, technicianId) {
  const result = await pool.query(
    `UPDATE requests SET 
      assigned_to = $1, 
      status = 'EN_PROCESO',
      service_start_time = now(),
      version_number = version_number + 1
     WHERE request_id = $2 AND status IN ('PENDIENTE', 'ASIGNADA') AND request_type_id = $3
     RETURNING *`,
    [technicianId, ticketId, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function reject(ticketId, reason) {
  const result = await pool.query(
    `UPDATE requests SET 
      status = 'RECHAZADA',
      rejection_reason = $1,
      version_number = version_number + 1
     WHERE request_id = $2 AND status IN ('PENDIENTE', 'ASIGNADA') AND request_type_id = $3
     RETURNING *`,
    [reason || 'Rechazado por servicio técnico', ticketId, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function assign(ticketId, technicianId) {
  const result = await pool.query(
    `UPDATE requests SET 
      assigned_to = $1, 
      status = 'ASIGNADA',
      version_number = version_number + 1
     WHERE request_id = $2 AND status = 'PENDIENTE' AND request_type_id = $3
     RETURNING *`,
    [technicianId, ticketId, ST_REQUEST_TYPE_ID]
  );
  return result.rows[0] || null;
}

async function close(ticketId, data) {
  const result = await pool.query(
    `UPDATE requests SET 
      status = 'COMPLETADA',
      service_close_time = now(),
      service_type = COALESCE($1, service_type),
      close_observations = $2,
      completed_at = now(),
      version_number = version_number + 1
     WHERE request_id = $3 AND status = 'EN_PROCESO' AND request_type_id = $4
     RETURNING *`,
    [data.serviceType || null, data.closeObservations || null, ticketId, ST_REQUEST_TYPE_ID]
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

module.exports = { SERVICE_TYPES, ST_REQUEST_TYPE_ID, findAll, findByCode, findById, accept, close, rate, getStats };
