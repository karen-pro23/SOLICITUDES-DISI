const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding database...');

    await client.query('BEGIN');

    // Departments
    const departments = [
      { name: 'Contabilidad Presupuestaria', code: 'CONTPRES' },
      { name: 'Planificación y Presupuesto', code: 'PLANPRES' },
      { name: 'Tesorería', code: 'TES' },
      { name: 'Contabilidad Fiscal', code: 'CONTFIS' },
      { name: 'Nómina', code: 'NOM' },
      { name: 'Talento Humano', code: 'TALHUM' },
      { name: 'Secretaría General de Gobierno', code: 'SEGGOV' },
      { name: 'Compras', code: 'COMP' },
      { name: 'Despacho del Gobernador', code: 'DESPGOV' },
    ];
    for (const d of departments) {
      await client.query(
        `INSERT INTO departments (name, code) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING`,
        [d.name, d.code]
      );
    }

    // Admin user
    const passwordHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (full_name, email, password_hash, role, department_id)
       VALUES ($1, $2, $3, $4, (SELECT department_id FROM departments WHERE code = 'CONTPRES'))
       ON CONFLICT (email) DO NOTHING`,
      ['Administrador', 'admin@sistema.gov', passwordHash, 'admin']
    );

    // Modules (sistemas que gestiona el equipo de desarrollo)
    const modules = [
      { name: 'Sistema de Contabilidad Presupuestaria', isSystems: true },
      { name: 'Sistema de Planificación y Presupuesto', isSystems: true },
      { name: 'Sistema de Tesorería', isSystems: true },
      { name: 'Sistema de Contabilidad Fiscal', isSystems: true },
      { name: 'Sistema de Nómina', isSystems: true },
      { name: 'Sistema de Talento Humano', isSystems: true },
      { name: 'Sistema de Gestión Documental', isSystems: true },
      { name: 'Sistema de Compras', isSystems: true },
      { name: 'Sistema de Despacho', isSystems: true },
    ];
    for (const m of modules) {
      await client.query(
        `INSERT INTO modules (name, is_systems) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
        [m.name, m.isSystems]
      );
    }

    // Request types
    const types = [
      { name: 'Corrección de Error', code: 'BUG', ss: true, doc: true },
      { name: 'Ajuste/Modificación', code: 'ADJUSTMENT', ss: true, doc: true },
      { name: 'Nueva Funcionalidad', code: 'FEATURE', ss: false, doc: false },
    ];
    for (const t of types) {
      await client.query(
        `INSERT INTO request_types (name, code, requires_screenshot, requires_document)
         VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING`,
        [t.name, t.code, t.ss, t.doc]
      );
    }

    await client.query('COMMIT');
    console.log('✅ Seed data inserted.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
