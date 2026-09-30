# Feature: Listados responsive y cómodos

## Objective

Que los listados/tablas se usen cómodamente en celular: sin scroll horizontal innecesario, columnas secundarias fuera del camino, y objetivos táctiles de tamaño decente.

## Problem

Los listados comparten el síntoma: `<div style={{overflowX:'auto'}}>` envuelve la tabla (así que la página no se rompe) pero la tabla tiene `minWidth` fijo en línea (1000px / 800px / 700px) y cada `th`/`td` lleva su `style` inline. En un celular de 375px hay que arrastrar 600px de sobra, y ningún `@media` puede tocar estilos inline.

Archivos con el problema:
- `src/pages/ServiceTicketDashboard.jsx` — `minWidth: 1000px`, 89 estilos inline
- `src/pages/UserManagement.jsx` — `minWidth: 800px`, 40 estilos inline
- `src/pages/AreaManagement.jsx` — `minWidth: 700px`, 42 estilos inline
- `src/pages/Dashboard.jsx` (vista lista) — ya tiene breakpoints en `Dashboard.css` (oculta `col-date`/`col-assigned` a ≤1024px); falta bajar a 768/480

`AdminPage.css` solo tiene 2 media queries (768px y 640px) y solo cubre `.admin-columns`, `.mgmt-*`. Las tablas de gestión no usan `.admin-table` ni `.admin-table-container`.

## Why

El usuario pidió "haz más responsive y cómodo los listados" después de ver los listados de recepción/servicio técnico en el teléfono.

## Scope (authorized)

- Mover los estilos de `th`/`td` de inline a clases CSS (en `AdminPage.css` o el CSS de cada página) para que los `@media` puedan actuar.
- Columnas de baja prioridad ocultas por breakpoint (fechas, extensiones, ids, campos secundarios) — conservar las de acción: ticket/usuario/área + estado + acciones.
- `minWidth` de la tabla: solo aplicarlo en desktop, no en móvil.
- Objetivos táctiles: botones de fila con mínimo ~40px en móvil.
- Mantener el wrapper `overflow-x:auto` como red de seguridad.
- Dashboard: completar breakpoints a 768px y 480px.

## Out of scope

- No rediseñar a tarjetas (cards) — se mantiene tabla.
- No tocar `DevInbox.css` (ya tiene 7 media queries y su propio kanban).
- No tocar `RequestForm.css`, `RequestDetail.css`, `RequestForm.jsx`.
- No cambiar lógica de negocio, endpoints ni datos.

## Constraints

- Estilos en español siguiendo la convención del archivo que se toque.
- Respeta los breakpoints ya usados en el repo: 1024 / 768 / 480 / 640.
- No romper el layout desktop existente.

## Checklist

- [ ] R1 — `ServiceTicketDashboard`: estilos de tabla en clases + columnas secundarias ocultas en móvil
- [ ] R2 — `UserManagement`: ídem
- [ ] R3 — `AreaManagement`: ídem
- [ ] R4 — `Dashboard` vista lista: breakpoints 768/480
- [ ] R5 — Verificación: `npx vite build` OK + revisión de que en 375px no haya scroll horizontal de página

## Acceptance criteria

1. A 375px de ancho ninguna página con listado produce scroll horizontal a nivel de documento.
2. Las columnas de acción siguen visibles en móvil.
3. Los botones de fila alcanzan ~40px de área táctil en móvil.
4. El layout desktop no cambia.

## Progress

- [x] Mapeo de las 4 vistas y su estado actual
- [ ] R1..R5

## Evidence

- (pendiente)

## Next step

Delegar un writer con R1-R5.
