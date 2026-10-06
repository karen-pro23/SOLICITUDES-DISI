# Feature: Cierre de brechas críticas de autorización (roles/permisos)

## Objective

Cerrar los agujeros críticos de autorización detectados en la auditoría de roles/permisos: mutaciones de Servicio Técnico sin requireRole, updateStatus sin validación de rol, remove() sobrepoderado, jefe_st sin acceso a findById, y updatePriority sin gate.

## Problem

La auditoría de roles/permisos (sesión 2026-10-06) detectó:

1. **ST mutations sin requireRole** — `serviceTicket.routes.js:52-55` solo pide `authenticate`. Un requester con token puede cerrar/aceptar/rechazar tickets.
2. **updateStatus sin validación de rol** — `request.service.js:328` solo checa visibilidad via findById. Cualquier rol que vea una solicitud puede cambiarla a cualquier estado. Requester puede cambiar status de las suyas.
3. **remove() sobrepoderado** — `request.service.js:629` solo bloquea `requester`. recepcion (ve todas las PENDIENTE) puede borrar cualquier solicitud.
4. **jefe_st sin findById** — `request.service.js:301` cae al `default AND 1=0` → 404 en `GET /requests/:id` aunque findAll sí le lista ST requests.
5. **updatePriority sin gate** — `request.service.js:415` no tiene role check. Requester puede repriorizar sus tickets.

## Why

El usuario pidió "si comienza" después de la auditoría que mostró que la capa de visibilidad/derivación de recepción está bien, pero las mutaciones están desprotegidas. Estos son los fixes críticos de backend.

## Scope (authorized)

- Backend solamente: `serviceTicket.routes.js` + `request.service.js`.
- NO se toca frontend (los botones ya se esconden por UI; el backend es la defensa real).
- NO se agregan roles nuevos ni se modifica la migración 017.
- NO se toca: assign (ya corregido en `90f27a3`), findAll, create, comment routes.

## Constraints

- Sin test runner (`npm test` no existe) → TDD off, verificación funcional + `node --check`.
- La regla `users_role_check` de la migración 017 es la única definición de roles.
- `requireRole` ya existe en `auth.middleware.js` — reutilizar, no reinventar.
- Defence in depth: el gate en la ruta + validación en el service (patrón ya usado en `assign`).

## Route

Ruta elegida: **direct inline** (2 archivos, cambios mecánicos basados en auditoría con diseño ya resuelto; no hay decisiones de diseño abiertas).

## Delivery strategy

`single-pr`. Forecast de líneas autoriales: ~80 (bajo el umbral de 400).

## Checklist

- [ ] T1 — `serviceTicket.routes.js`: `requireRole` en accept/reject/assign/close. Roles: `jefe_st`, `tecnico`, `developer`, `super_admin`, `admin`. (recepcion queda excluido — su rol es derivar, no procesar ST.)
- [ ] T2 — `request.service.js updateStatus()`: bloquear `requester` (403). Bloquear `recepcion` salvo PENDIENTE→RECHAZADA (puede rechazar en mostrador, no cambiar a otros estados).
- [ ] T3 — `request.service.js remove()`: restringir a `super_admin`, `admin`, `director`, `sub_director`. Los demás reciben 403.
- [ ] T4 — `request.service.js findById()`: agregar `case 'jefe_st'` con `AND r.request_type_id = 8` (espejo de findAll).
- [ ] T5 — `request.service.js updatePriority()`: bloquear `requester` (403). Solo roles de flujo/gestión.
- [ ] T6 — Verificación: `node --check` sobre los 2 archivos, build frontend OK.

## Acceptance criteria

1. Un `requester` con token que envíe `PATCH /service-tickets/:id/close` recibe 403.
2. Un `recepcion` que envíe `PATCH /service-tickets/:id/accept` recibe 403.
3. Un `requester` que envíe `PATCH /requests/:id/status` recibe 403.
4. Un `recepcion` que envíe `PATCH /requests/:id/status` con `newStatus=EN_PROCESO` recibe 403; con `newStatus=RECHAZADA` y motivo, funciona.
5. Un `recepcion` que envíe `DELETE /requests/:id` recibe 403.
6. Un `jefe_st` que envíe `GET /requests/:id` sobre una solicitud ST recibe 200 (no 404).
7. Un `requester` que envíe `PATCH /requests/:id/priority` recibe 403.

## Progress

- [x] T1 — requireRole en ST routes (accept/reject/assign/close → jefe_st/tecnico/developer/super_admin/admin)
- [x] T2 — updateStatus: requester bloqueado (403), recepcion solo PENDIENTE→RECHAZADA
- [x] T3 — remove(): restringido a super_admin/admin/director/sub_director
- [x] T4 — jefe_st en findById (AND request_type_id = 8)
- [x] T5 — updatePriority: requester bloqueado (403)
- [x] T6 — Verificación: node --check OK, vite build OK

## Evidence

- `node --check` sobre los 2 archivos backend: OK.
- `npx vite build`: ✓ 5.41s (sin cambios frontend, solo backend).
- Diff: 2 archivos, +43/-10 líneas.
- Sin test runner configurado → TDD off (misma constraint que recepcion-filtro-solicitudes).

## Next step

Implementar T1-T5, verificar T6, commitear.
