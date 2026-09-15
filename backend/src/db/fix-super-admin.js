const pool = require('./pool');

async function fixSuperAdmin() {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `UPDATE users SET department_id = NULL WHERE email = 'admin@sistema.gov' AND role = 'admin' RETURNING user_id, full_name, email, role`
    );

    if (result.rowCount === 0) {
      console.log('No se encontró el super admin con email admin@sistema.gov');
    } else {
      const user = result.rows[0];
      console.log(`✅ Super admin actualizado:`);
      console.log(`   ID: ${user.user_id}`);
      console.log(`   Nombre: ${user.full_name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Rol: ${user.role}`);
      console.log(`   department_id: NULL`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixSuperAdmin();
