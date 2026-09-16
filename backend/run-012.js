const path = require('path');
const fs = require('fs');
const pool = require('./src/db/pool');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'src/db/migrations/012_departments_and_assignments.sql'), 'utf-8');
  try {
    await pool.query(sql);
    console.log('Migration 012 applied.');
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
