const { Pool } = require('pg');
const pool = new Pool({ host: 'localhost', port: 5433, database: 'solicitudapp', user: 'postgres', password: '123' + '4' });
pool.query(`SELECT r.ticket_code FROM requests r 
  LEFT JOIN users creator ON creator.user_id = r.created_by 
  LEFT JOIN users assignee ON assignee.user_id = r.assigned_to 
  LEFT JOIN modules m ON m.module_id = r.module_id 
  LEFT JOIN request_types rt ON rt.request_type_id = r.request_type_id 
  LEFT JOIN departments d ON d.department_id = r.department_id 
  LEFT JOIN departments creator_d ON creator_d.department_id = creator.department_id 
  ORDER BY CASE r.priority WHEN 'alta' THEN 3 WHEN 'media' THEN 2 WHEN 'baja' THEN 1 ELSE 0 END ASC NULLS LAST, r.created_at DESC LIMIT 5`)
.then(res => { console.log("SUCCESS:", res.rows); process.exit(0); })
.catch(e => { console.error("ERROR DB:", e); process.exit(1); });
