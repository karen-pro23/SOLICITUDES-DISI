const { Router } = require('express');
const { classifyRequest, generateResponse } = require('../services/ai.service');
const pool = require('../db/pool');

const router = Router();

/**
 * POST /ai/classify
 * Clasifica una solicitud existente: prioridad, categoría, módulo y resumen.
 * Body: { requestId }
 */
router.post('/classify', async (req, res, next) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'requestId es requerido' });

    const parsed = parseInt(requestId, 10);

    // Obtener datos de la solicitud
    const reqResult = await pool.query(
      `SELECT r.*, rt.name as request_type_name, m.name as module_name
       FROM requests r
       JOIN request_types rt ON rt.request_type_id = r.request_type_id
       JOIN modules m ON m.module_id = r.module_id
       WHERE r.request_id = $1`,
      [parsed]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const r = reqResult.rows[0];

    const clasificacion = await classifyRequest({
      processDescription: r.process_description,
      currentBehavior: r.current_behavior,
      expectedBehavior: r.expected_behavior,
      moduleName: r.module_name,
    });

    // Guardar clasificación en la solicitud
    await pool.query(
      `UPDATE requests SET
         ai_priority = $1,
         ai_category = $2,
         ai_module_suggested = $3,
         ai_summary = $4
       WHERE request_id = $5`,
      [
        clasificacion.prioridad,
        clasificacion.categoria,
        clasificacion.modulo_sugerido,
        clasificacion.resumen,
        parsed,
      ]
    );

    res.json({ clasificacion });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /ai/generate-response
 * Genera una respuesta formal para una solicitud.
 * Body: { requestId, tipoRespuesta, observaciones? }
 */
router.post('/generate-response', async (req, res, next) => {
  try {
    const { requestId, tipoRespuesta, observaciones } = req.body;
    if (!requestId || !tipoRespuesta) {
      return res.status(400).json({ error: 'requestId y tipoRespuesta son requeridos' });
    }

    const validTypes = ['acuse', 'avance', 'info_adicional', 'resuelta', 'rechazada', 'observaciones'];
    if (!validTypes.includes(tipoRespuesta)) {
      return res.status(400).json({ error: `tipoRespuesta debe ser uno de: ${validTypes.join(', ')}` });
    }

    const parsed = parseInt(requestId, 10);

    // Obtener datos de la solicitud y del solicitante
    const reqResult = await pool.query(
      `SELECT r.ticket_code, r.process_description,
              rt.name as request_type_name, r.priority,
              u.full_name as applicant_name
       FROM requests r
       JOIN request_types rt ON rt.request_type_id = r.request_type_id
       JOIN users u ON u.user_id = r.created_by
       WHERE r.request_id = $1`,
      [parsed]
    );

    if (reqResult.rows.length === 0) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    const r = reqResult.rows[0];

    const respuesta = await generateResponse({
      requestCode: r.ticket_code,
      applicantName: r.applicant_name,
      requestType: r.request_type_name,
      priority: r.priority,
      tipoRespuesta,
      observaciones,
      processDescription: r.process_description,
    });

    res.json({ respuesta });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
