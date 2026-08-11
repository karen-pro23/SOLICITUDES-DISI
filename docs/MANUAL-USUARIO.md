# Manual de Usuario — Portal de Solicitudes

Portal de solicitudes internas del **Departamento de Desarrollo de Sistemas** (DISI).
Permite enviar solicitudes sobre los sistemas informáticos de la institución (reportes de error, ajustes o nuevas funcionalidades), hacerles seguimiento y conocer su estado en todo momento.

Este manual explica, paso a paso, cómo enviar una solicitud, cómo consultar su estado y qué significan los estados del proceso.

---

## Guía rápida

1. **Enviar una solicitud**: entre a la página **Nueva Solicitud** (`/solicitud`) y complete el formulario.
2. **Anote el código de ticket** que recibe al final (formato `SOL-AAAA-NNN`, por ejemplo `SOL-2026-001`).
3. **Consultar el estado**: entre a **Buscar Solicitudes** (`/buscar`) e ingrese su **cédula de identidad** para ver todas sus solicitudes.
4. Haga clic sobre una solicitud para ver su detalle: estado actual, historial y respuesta del equipo.

> **Importante:** el sistema **no envía notificaciones por correo**. Para conocer el avance de su solicitud debe consultarla con su cédula. Revise su solicitud periódicamente.

---

## 1. ¿Qué es una solicitud?

Una solicitud es un pedido formal que un departamento envía al equipo de Desarrollo de Sistemas sobre un módulo (sistema informático). Cada solicitud contiene:

- **Código de ticket** único (ej. `SOL-2026-001`).
- **Módulo afectado** (ej. Sistema de Nómina, Sistema de Tesorería).
- **Tipo de solicitud**: Corrección de Error, Ajuste/Modificación o Nueva Funcionalidad.
- **Contexto funcional**: la descripción del problema o necesidad en 3 campos (proceso que se realiza, comportamiento actual y comportamiento esperado).
- **Evidencias** (opcional): capturas de pantalla y documentos de soporte.
- **Prioridad**, **departamento** y **solicitante**.

---

## 2. Acceso al sistema

El portal tiene **dos áreas**:

| Área | Quién la usa | Para qué |
| --- | --- | --- |
| **Portal público** (sin usuario) | Todos los empleados | Enviar solicitudes y consultar su estado por cédula. |
| **Panel interno** (con usuario) | Equipo de Desarrollo y Administradores | Bandeja de trabajo, dashboard y administración. |

Si usted es solicitante, solo necesita el **portal público**: no requiere usuario ni contraseña para enviar solicitudes ni para consultarlas.

---

## 3. Roles y permisos

| Rol | Qué puede hacer |
| --- | --- |
| **Solicitante** | Enviar solicitudes y consultar las solicitudes de su departamento. No puede cambiar estados ni prioridades. |
| **Desarrollador** | Atender todas las solicitudes: cambiar estados, prioridades, asignar y responder. |
| **Administrador** | Todo lo del desarrollador, más la administración del sistema: usuarios, módulos, tipos de solicitud y métricas. |

---

## 4. Cómo enviar una solicitud

Entre a **Nueva Solicitud** (`/solicitud`) y complete el formulario. Los campos con asterisco (*) son obligatorios.

### 4.1 Datos del solicitante

1. **Cédula de Identidad** — ingrese su cédula (ej. `V-12345678`). Si ya ha enviado solicitudes antes, el sistema **autocompleta** sus datos automáticamente y muestra "✓ Encontrada". Si es la primera vez, verá "Nueva persona" y deberá escribir sus datos.
2. **Nombre** y **Apellido** — se completan solos si su cédula ya está registrada.
3. **Correo Electrónico**.
4. **Departamento / Área** — seleccione su departamento.

### 4.2 Datos de la solicitud

5. **Módulo afectado** — seleccione el sistema al que se refiere su solicitud.
6. **Tipo de solicitud** — seleccione el tipo:
   - **Corrección de Error**: algo funciona mal.
   - **Ajuste/Modificación**: algo que hay que cambiar o ajustar.
   - **Nueva Funcionalidad**: algo nuevo que se necesita.

### 4.3 Contexto funcional

Describa su solicitud en los 3 campos (mínimo 10 caracteres cada uno). **Cuanto más claro sea, más rápido podrá el equipo atenderla**:

1. **¿Qué proceso administrativo/contable se está realizando?** — explique la tarea o proceso involucrado.
2. **Comportamiento Actual (¿Qué hace el sistema ahora?)** — describa qué está pasando hoy (el error o la situación actual).
3. **Comportamiento Esperado (¿Qué DEBERÍA hacer?)** — describa qué resultado espera.

### 4.4 Evidencias (opcional, recomendado)

- **Captura de Pantalla del Error**: JPG, PNG, GIF o WebP, hasta 5 archivos de máximo 5 MB cada uno.
- **Documento de Soporte**: PDF, CSV, XLS o XLSX, hasta 5 archivos de máximo 5 MB cada uno.

### 4.5 Enviar

Cuando todos los campos obligatorios estén completos, el formulario mostrará "✓ LISTO" y podrá presionar el botón **Enviar Solicitud**. Al final verá la pantalla **"¡Solicitud Enviada con Éxito!"** con su **código de ticket** en grande.

> **Guarde ese código** — es el identificador de su solicitud, aunque también puede consultarla con su cédula.

---

## 5. Estados de una solicitud

Cada solicitud pasa por un proceso con estos estados:

| Estado | Significado |
| --- | --- |
| **Pendiente** | Recibida y a la espera de ser revisada por el equipo. |
| **En Proceso** | El equipo está trabajando en ella. |
| **En Pruebas** | La solución fue desarrollada y se está probando. |
| **Completada** | La solicitud fue resuelta y cerrada. |
| **Rechazada** | No se pudo atender; el sistema muestra el **motivo del rechazo**. |

### Flujo del proceso

```
Pendiente ──► En Proceso ──► En Pruebas ──► Completada
    │              │             │
    └──► Rechazada ◄─┘            └──► (vuelve a En Proceso si requiere ajustes)
```

- Si la solicitud fue **rechazada**, el equipo deja un motivo que usted podrá ver en el detalle. Si desea insistir, el equipo puede **reabrirla**.
- Si una solicitud **En Pruebas** no pasa la verificación, puede **devolverse a En Proceso**.
- **Completada** es el estado final: la solicitud quedó resuelta y cerrada, con la fecha de cierre registrada.

---

## 6. Cómo consultar el estado de una solicitud

1. Entre a **Buscar Solicitudes** (`/buscar`).
2. Ingrese su **cédula de identidad** (ej. `30297111`) y presione **Buscar**.
3. Verá la lista de sus solicitudes con: código de ticket, módulo, estado, prioridad y fecha.
4. Haga clic en una solicitud para ver el **detalle completo**:

| Sección | Qué muestra |
| --- | --- |
| Datos generales | Módulo, tipo, prioridad, departamento y fecha. |
| Contexto | Las 3 descripciones que usted completó (proceso, comportamiento actual, esperado). |
| Motivo de rechazo | Si la solicitud fue rechazada, el motivo (en caja roja). |
| Notas de resolución | La explicación de cómo se resolvió (en caja verde). |
| Respuesta del equipo | Comentarios públicos y respuestas formales. |
| Historial de estados | Línea de tiempo con todos los cambios de estado de la solicitud. |

> La búsqueda es **exacta por cédula**: use la misma cédula con la que envió la solicitud.

---

## 7. Avisos importantes

- **No hay notificaciones automáticas**: el sistema no avisa por correo ni por mensaje. Consulte su solicitud con su cédula para conocer su avance.
- **Sus datos se completan automáticamente** cuando su cédula ya está registrada; los textos se guardan en mayúsculas, usted puede escribir normal.
- **La cédula es la llave de búsqueda**: si otra persona de su departamento consulta con su cédula, verá las solicitudes asociadas a esa cédula.
- **Evidencias**: actualmente las capturas y documentos se pueden adjuntar al enviar, pero **no hay botón de descarga** en la vista pública.

---

## 8. Si tiene dudas

Diríjase al **Departamento de Desarrollo de Sistemas (DISI)** o al administrador del sistema. Para enviar una nueva solicitud o revisar una existente, use siempre el portal público — no necesita usuario ni contraseña.
