# Feature: Flujo de recepción como filtro de solicitudes

## Objective

Implementar el flujo de tres niveles: recepción filtra y deriva a áreas → jefe de área asigna a su empleado → empleado resuelve. Cerrando de paso las brechas de autorización detectadas en el endpoint de asignación.

## Problem

El sistema fue diseñado con los roles (`recepcion`, `jefe_area`) y los estados (`PENDIENTE → ASIGNADA → EN_PROCESO → COMPLETADA / RECHAZADA`) ya definidos en la migración 017, pero la lógica de flujo no está cableada:

1. `PATCH /api/requests/:id/assign` no tiene restricción de rol: cualquier usuario autenticado (incluido `requester`) puede reasignar cualquier solicitud.
2. `GET /api/admin/users/area/:id` y `/department/:id` están abiertos a cualquier autenticado.
3. La visibilidad de `jefe_area` filtra por departmento completo, no por su área: el jefe de AUTOMATIZACION vería SERVICIO TECNICO, ADMINISTRATIVA y REDES.
4. `AssignModal` ofrece los 3 pasos (depto → área → empleado) a todos los roles: recepción podría saltarse al empleado y el jefe vería pasos que no le corresponden.
5. El Dashboard no tiene filtros por defecto por rol: recepción no distingue "lo que falta filtrar" ni el jefe "lo que falta asignar a empleado".
6. `case 'recepcion'` está duplicado en `request.service.js` (líneas ~27 y ~36); el segundo es código muerto.

## Why

El usuario quiere reemplazar el flujo manual del helpdesk de recepción: las señoras de atención filtran todas las solicitudes antes de que lleguen a las áreas, y los jefes de cada área asignan a sus empleados.

## Scope (authorized)

- Backend: autorización y validación en `assign`, cierre de rutas de usuarios, visibilidad por área, filtro de no asignadas, limpieza de `case` duplicado.
- Frontend: `AssignModal` restringido por rol, filtros por defecto por rol en Dashboard.
- NO se crean usuarios de recepción ni jefes (el usuario los agrega después).
- NO se agregan estados nuevos (cero migración de estados).
- NO se toca: módulos, tipos, departamentos, flujo público `/solicitud`, servicio técnico (`jefe_st`), migraciones de esquema.

## Constraints

- Estados existentes sin modificar. "Derivada a área" vs "asignada a empleado" se distingue por `area_id`/`assigned_to IS NULL`.
- Validación de rol obligatoria en backend (defensa en profundidad); el frontend solo mejora la UX.
- La regla `users_role_check` de la migración 017 es la única definición de roles; no agregar roles nuevos.
- Sin runner de tests configurado (`npm test` no existe en frontend ni backend) → TDD off, verificación funcional + build.

## Route

Ruta elegida: **delegada direct** (disparadores: mapa de 4+ archivos ya resuelto en exploración inline; escritura de 6+ archivos no triviales → writer delegado). Fases 1-2 (backend) y 3-4 (frontend) con un writer cada una, secuenciales.

## Delivery strategy

`ask-on-risk`. Forecast de líneas autoriales: ~350 (bajo el umbral de 400). Si el cierre lo supera, preguntar antes del commit de cierre.

## Checklist

- [ ] T1 — Backend: `requireRole` en `PATCH /:id/assign` + validación por rol en `request.routes.js` y `request.service.js assign()`:
  - `recepcion`: solo `areaId` (obligatorio), rechazar `assigneeId`.
  - `jefe_area`: solo `assigneeId` de un usuario de **su** área; `areaId` solo el suyo.
  - `admin`/`super_admin`/`developer`: sin restricción.
- [ ] T2 — Backend: cerrar `GET /api/admin/users/area/:id` y `/department/:id` con `requireRole` acorde.
- [ ] T3 — Backend: visibilidad `jefe_area` por su `area_id` (propagar `areaId` del usuario al service) + filtro `unassigned=true`.
- [ ] T4 — Backend: eliminar `case 'recepcion':` duplicado en `request.service.js`.
- [ ] T5 — Frontend: `AssignModal` restringido por rol (recepción → depto+área; jefe → solo empleado de su área; admin/developer → completo).
- [ ] T6 — Frontend: filtros por defecto por rol en Dashboard (recepción → `PENDIENTE`; jefe → sin asignar).
- [ ] T7 — Verificación: `npx vite build` OK, `node --check` sobre backend modificado, revisión estructural del flujo.

## Acceptance criteria

1. Un usuario `requester` autenticado que envíe `PATCH /:id/assign` recibe 403.
2. Un usuario `recepcion` que intente enviar `assigneeId` recibe 400.
3. Un usuario `jefe_area` que intente asignar a un empleado fuera de su área recibe 400.
4. `jefe_area` solo ve solicitudes con `area_id` igual al suyo.
5. `recepcion` ve por defecto las `PENDIENTE`; puede rechazar con motivo y derivar a un área.
6. El ciudadano ve el rechazo en `/buscar` con su cédula (ya funciona, no regresión).

## Progress

- [x] Exploración y mapeo (roles, estados, endpoints, datos de producción)
- [x] T1 — assign con requireRole + validación por rol en servicio (commit `90f27a3`)
- [x] T2 — cierre de `/admin/users/area` y `/department` a roles de equipo (commit `90f27a3`)
- [x] T3 — visibilidad `jefe_area` por su `area_id` + filtro `unassigned=true` (commit `90f27a3`)
- [x] T4 — case `recepcion` duplicado eliminado (commit `90f27a3`)
- [ ] T5 — Frontend: AssignModal restringido por rol
- [ ] T6 — Frontend: filtros por defecto por rol en Dashboard
- [ ] T7 — Verificación final

## Evidence

- Commit `90f27a3` — backend T1-T4 (218+ / 23-), `node --check` 4 archivos OK, `npx vite build` ✓ 6.08s.
- RDD assess sobre `HEAD~1 --committed-only`: riesgo `medium`, `review_due=false`, reason `under_budget` → queda pendiente en el slice, sin review todavía.
- Área del actor: resuelta desde el JWT (`req.user.areaId`, presente desde 2026-09-21) con fallback a `SELECT area_id` solo para `jefe_area` con token viejo.
- `odd/tasks/...` — espejo engram PENDIENTE (mem_save falló con "could not confirm Engram session registration").

## Follow-ups detectados (fuera de alcance, no implementados)

1. `findById()` no tiene `case 'jefe_st'` → cae en `default AND 1=0` → 404 en `GET /api/requests/:id` aunque `findAll` sí le lista solicitudes. Defecto pre-existente.
2. `assignedDepartmentId` sigue permitido para `recepcion` (el modal de recepción usa depto+área; si se debe rechazar, son 3 líneas).

## Next step

Lanzar writer de frontend (T5-T6).
