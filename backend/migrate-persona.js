const fs = require('fs');
const path = require('path');
const pool = require('./src/db/pool');

async function migrate() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error('Uso: node migrate-persona.js /ruta/al/archivo.csv');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error('Archivo no encontrado:', csvPath);
    process.exit(1);
  }

  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());

  // Saltar cabecera
  const dataLines = lines.slice(1);

  console.log(`Personas encontradas: ${dataLines.length}`);

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  try {
    for (const line of dataLines) {
      const match = line.match(/^(\d+)\s*,\s*(.+?)\s*$/);
      if (!match) {
        console.log(`  ⚠ Línea no válida: ${line.trim()}`);
        skipped++;
        continue;
      }

      const cedula = match[1].trim();
      const fullName = match[2].trim();

      // Separar nombre y apellido: las últimas 2 palabras son apellido
      const parts = fullName.split(/\s+/);
      let nombre, apellido;

      if (parts.length >= 3) {
        apellido = parts.slice(-2).join(' ');
        nombre = parts.slice(0, -2).join(' ');
      } else if (parts.length === 2) {
        nombre = parts[0];
        apellido = parts[1];
      } else {
        nombre = fullName;
        apellido = '-';
      }

      try {
        await client.query(
          `INSERT INTO persona (cedula, nombre, apellido)
           VALUES (UPPER($1), UPPER($2), UPPER($3))
           ON CONFLICT (cedula) DO UPDATE
             SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido, updated_at = now()`,
          [cedula, nombre, apellido]
        );
        inserted++;
        if (inserted % 50 === 0) {
          console.log(`  ✅ ${inserted} personas insertadas...`);
        }
      } catch (err) {
        console.error(`  ✗ Error con cédula ${cedula}: ${err.message}`);
        errors++;
      }
    }

    console.log(`\n✅ Migración completada:`);
    console.log(`   Insertadas/actualizadas: ${inserted}`);
    console.log(`   Omitidas: ${skipped}`);
    console.log(`   Errores: ${errors}`);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
