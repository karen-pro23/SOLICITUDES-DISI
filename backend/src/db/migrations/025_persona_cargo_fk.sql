-- Migración 025: FK real de solicitante -> catálogo de cargos
--
-- Objetivo: que `cargos` sea la fuente de verdad del cargo de una persona.
-- Hoy el vínculo es igualdad de strings (`persona.position = cargos.name`), así
-- que un renombre en el catálogo rompe el prefill en silencio. La FK convierte
-- ese vínculo en algo que la base de datos garantiza.
--
-- Idempotente: el runner de migraciones NO lleva tabla de control, por lo que
-- este archivo se re-ejecuta en cada `pnpm migrate` (001->025, en orden de
-- nombre). Todas las sentencias tienen que ser no-op en la segunda pasada.

-- ---------------------------------------------------------------------------
-- 1. Columna + FK en un solo ALTER TABLE
-- ---------------------------------------------------------------------------
-- Se deja explícito que la acción referencial implícita es NO ACTION (por eso
-- no se escribe ON DELETE): NO permite borrar de `cargos` un cargo que alguien
-- tiene asignado. Esa es justamente la integridad que motiva esta migración.
-- Con ON DELETE SET NULL el borrado desconectaría en silencio a la persona y
-- dejaría solo el texto espejo, que es exactamente el modo de falla que esta
-- migración viene a eliminar.
--
-- Sin índice en persona.cargo_id, por el mismo motivo que migration 024 no
-- indexó `position`: nadie filtra ni ordena por cargo, y la única lectura del
-- FK es el LEFT JOIN de getPersona, que entra por persona.cedula (PK) y sale
-- contra cargos.cargo_id (PK, ya indexada). Un índice aquí solo pagaría el
-- costo de escritura de una tabla de alta frecuencia.
--
-- 025 es la ÚNICA migración que crea persona.cargo_id, así que el
-- `IF NOT EXISTS` cubre por sí solo la segunda pasada: si la columna ya existe,
-- entonces la constraint persona_cargo_id_fkey también existe, porque la creó
-- esta misma sentencia la primera vez. No se declara una segunda constraint con
-- nombre propio justamente para no duplicarla.
ALTER TABLE persona
  ADD COLUMN IF NOT EXISTS cargo_id BIGINT REFERENCES cargos(cargo_id);

COMMENT ON COLUMN persona.cargo_id IS
  'FK al catálogo cargos: fuente de verdad del cargo del solicitante. persona.position queda como espejo de compatibilidad y puede quedar desfasado si se renombra la entrada del catálogo.';

-- ---------------------------------------------------------------------------
-- 2. Backfill: el texto ya guardado se resuelve contra el catálogo por nombre
-- ---------------------------------------------------------------------------
-- Solo se resuelve lo que ya tiene un cargo escrito Y existe en el catálogo.
-- Las filas cuyo `position` no coincide con ninguna fila de `cargos` se dejan
-- con cargo_id NULL: no se inventa ni se crea una entrada de catálogo para
-- tapar el hueco, porque un cargo no catalogado no es un cargo que el sistema
-- pueda sostener.
--
-- El guard `cargo_id IS NULL` hace que la segunda pasada sea no-op y que la
-- migración no pise una asignación hecha por la aplicación después del primer
-- run. (Hoy son 197 personas, 1 con cargo y 0 huérfanas, así que el backfill
-- resuelve exactamente esa fila; el guard existe para que el caso siga siendo
-- correcto cuando haya más datos.)
UPDATE persona p
   SET cargo_id = c.cargo_id,
       updated_at = now()
  FROM cargos c
 WHERE c.name = p.position
   AND NULLIF(TRIM(p.position), '') IS NOT NULL
   AND p.cargo_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Lo que esta migración NO hace, y por qué
-- ---------------------------------------------------------------------------
-- `persona.position` NO se elimina. Sigue como espejo desnormalizado: hoy lo
-- leen el prefill de getPersona y nada más, pero el nombre lo manda el
-- frontend como dato externo del formulario. Droppear la columna es una
-- decisión irreversible que todavía no se tomó. ATENCIÓN: como espejo, se
-- desactualiza si alguien renombra una entrada de `cargos`; la lectura
-- principal ya no depende de él porque resuelve por la FK (ver
-- getPersona en public.controller.js).
--
-- `requests.position` NO lleva FK, y no es un olvido. Es un snapshot del cargo
-- tal como estaba al presentar la solicitud: un snapshot tiene que sobrevivir
-- al renombre de la entrada del catálogo que lo originó, que es justo lo que
-- una FK le impediría. Lo consume el PDF (serviceTicketPdf.service.js).
--
-- `users.position` NO se toca. Es un campo legacy del EQUIPO (migración 018),
-- con semántica propia, ajeno al cargo catalogado del solicitante.
