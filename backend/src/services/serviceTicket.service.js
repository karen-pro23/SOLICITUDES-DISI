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

async function generateCode() {
  const year = new Date().getFullYear();
  const result = await pool.query("SELECT nextval('service_ticket_seq') as seq");
  const seq = result.rows[0].seq;
  return `ST-${year}-${String(seq).padStart(4, '0')}`;
}

async function create(data) {
  const code = await generateCode();
  const result = await pool.query(
    `INSERT INTO service_tickets (ticket_code, requester_name, requester_cedula, requester_position, department_name, extension, description, assigned_area, observations)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [code, data.requesterName, data.requesterCedula || null, data.requesterPosition || null,
     data.departmentName || null, data.extension || null, data.description,
     data.assignedArea || null, data.observations || null]
  );
  return result.rows[0];
}

async function findAll(filters = {}) {
  let sql = 'FROM service_tickets st';
  const conditions = [];
  const values = [];
  let idx = 1;

  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    values.push(filters.status);
  }
  if (filters.search) {
    conditions.push(`(ticket_code ILIKE $${idx} OR requester_name ILIKE $${idx} OR description ILIKE $${idx})`);
    values.push(`%${filters.search}%`);
    idx++;
  }
  if (filters.technicianId) {
    conditions.push(`technician_id = $${idx++}`);
    values.push(filters.technicianId);
  }

  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  const countResult = await pool.query(`SELECT COUNT(*) ${sql} ${where}`, values);
  const total = parseInt(countResult.rows[0].count, 10);

  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(parseInt(filters.limit, 10) || 20, 100);

  const result = await pool.query(
    `SELECT st.*, u.full_name as technician_name
     ${sql}
     LEFT JOIN users u ON u.user_id = st.technician_id
     ${where}
     ORDER BY st.created_at DESC
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
    `SELECT st.*, u.full_name as technician_name
     FROM service_tickets st
     LEFT JOIN users u ON u.user_id = st.technician_id
     WHERE st.ticket_code = $1`,
    [code]
  );
  return result.rows[0] || null;
}

async function accept(ticketId, technicianId) {
  const result = await pool.query(
    `UPDATE service_tickets SET status = 'EN_PROCESO', technician_id = $1, start_time = now()
     WHERE ticket_id = $2 AND status = 'PENDIENTE'
     RETURNING *`,
    [technicianId, ticketId]
  );
  return result.rows[0] || null;
}

async function close(ticketId, data) {
  const result = await pool.query(
    `UPDATE service_tickets SET status = 'CERRADA', close_time = now(),
      service_type = COALESCE($1, service_type), close_observations = $2
     WHERE ticket_id = $3 AND status = 'EN_PROCESO'
     RETURNING *`,
    [data.serviceType || null, data.closeObservations || null, ticketId]
  );
  return result.rows[0] || null;
}

async function rate(code, satisfaction) {
  const result = await pool.query(
    `UPDATE service_tickets SET satisfaction = $1
     WHERE ticket_code = $2 AND status = 'CERRADA'
     RETURNING *`,
    [satisfaction, code]
  );
  return result.rows[0] || null;
}

async function getStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'PENDIENTE') as pending,
      COUNT(*) FILTER (WHERE status = 'EN_PROCESO') as in_progress,
      COUNT(*) FILTER (WHERE status = 'CERRADA') as closed,
      COUNT(*) FILTER (WHERE satisfaction = 'satisfecho') as satisfied,
      COUNT(*) FILTER (WHERE satisfaction = 'no_satisfecho') as unsatisfied,
      COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now())) as this_month
    FROM service_tickets
  `);
  return result.rows[0];
}

module.exports = { SERVICE_TYPES, create, findAll, findByCode, accept, close, rate, getStats };
