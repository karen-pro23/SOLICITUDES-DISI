const pool = require('../db/pool');

// Módulos CRUD
async function getModules(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM modules ORDER BY name');
    res.json({ modules: result.rows });
  } catch (err) { next(err); }
}

async function createModule(req, res, next) {
  try {
    const { name, description } = req.body;
    const result = await pool.query(
      'INSERT INTO modules (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json({ module: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El módulo ya existe' });
    next(err);
  }
}

async function updateModule(req, res, next) {
  try {
    const { name, description, isActive, isSystems } = req.body;
    const result = await pool.query(
      `UPDATE modules
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           is_active = COALESCE($3, is_active),
           is_systems = COALESCE($4, is_systems)
       WHERE module_id = $5 RETURNING *`,
      [name, description, isActive ?? null, isSystems ?? null, parseInt(req.params.id, 10)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Módulo no encontrado' });
    res.json({ module: result.rows[0] });
  } catch (err) { next(err); }
}

async function deleteModule(req, res, next) {
  try {
    const result = await pool.query('DELETE FROM modules WHERE module_id = $1 RETURNING *',
      [parseInt(req.params.id, 10)]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Módulo no encontrado' });
    res.json({ message: 'Módulo eliminado' });
  } catch (err) { next(err); }
}

// Tipos de solicitud CRUD
async function getRequestTypes(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM request_types ORDER BY name');
    res.json({ requestTypes: result.rows });
  } catch (err) { next(err); }
}

async function createRequestType(req, res, next) {
  try {
    const { name, code, requiresScreenshot, requiresDocument } = req.body;
    const result = await pool.query(
      `INSERT INTO request_types (name, code, requires_screenshot, requires_document)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, code, requiresScreenshot ?? true, requiresDocument ?? true]
    );
    res.status(201).json({ requestType: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'El tipo ya existe' });
    next(err);
  }
}

async function updateRequestType(req, res, next) {
  try {
    const { name, code, requiresScreenshot, requiresDocument } = req.body;
    const result = await pool.query(
      `UPDATE request_types SET name = COALESCE($1, name), code = COALESCE($2, code),
       requires_screenshot = COALESCE($3, requires_screenshot),
       requires_document = COALESCE($4, requires_document)
       WHERE request_type_id = $5 RETURNING *`,
      [name, code, requiresScreenshot, requiresDocument, parseInt(req.params.id, 10)]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tipo no encontrado' });
    res.json({ requestType: result.rows[0] });
  } catch (err) { next(err); }
}

async function deleteRequestType(req, res, next) {
  try {
    const result = await pool.query('DELETE FROM request_types WHERE request_type_id = $1 RETURNING *',
      [parseInt(req.params.id, 10)]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tipo no encontrado' });
    res.json({ message: 'Tipo eliminado' });
  } catch (err) { next(err); }
}

// Departamentos CRUD
async function getDepartments(req, res, next) {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY name');
    res.json({ departments: result.rows });
  } catch (err) { next(err); }
}

// Métricas
async function getMetrics(req, res, next) {
  try {
    const [totalResult, statusResult, deptResult, moduleResult, rejectionResult] = await Promise.all([
      pool.query('SELECT COUNT(*)::int as total FROM requests'),
      pool.query(`SELECT status, COUNT(*)::int as count FROM requests GROUP BY status ORDER BY status`),
      pool.query(`SELECT d.name, COUNT(r.request_id)::int as total,
                   SUM(CASE WHEN r.status = 'RECHAZADA' THEN 1 ELSE 0 END)::int as rejected
                   FROM departments d LEFT JOIN requests r ON r.department_id = d.department_id
                   GROUP BY d.department_id, d.name ORDER BY total DESC`),
      pool.query(`SELECT m.name, COUNT(r.request_id)::int as total
                   FROM modules m LEFT JOIN requests r ON r.module_id = m.module_id
                   GROUP BY m.module_id, m.name ORDER BY total DESC`),
      pool.query(`SELECT COUNT(*)::int as rejected_this_month FROM requests
                   WHERE status = 'RECHAZADA' AND created_at >= date_trunc('month', now())`),
    ]);

    res.json({
      metrics: {
        total: totalResult.rows[0].total,
        byStatus: statusResult.rows,
        byDepartment: deptResult.rows,
        byModule: moduleResult.rows,
        rejectedThisMonth: rejectionResult.rows[0].rejected_this_month,
      },
    });
  } catch (err) { next(err); }
}

module.exports = {
  getModules, createModule, updateModule, deleteModule,
  getRequestTypes, createRequestType, updateRequestType, deleteRequestType,
  getDepartments, getMetrics,
};
