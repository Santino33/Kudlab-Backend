# Modelo de datos y límites: autorización por rol y responsabilidad

**Estado**: diseño de integración sobre entidades existentes de 001–003; las relaciones académicas son propuesta documental, no tablas migradas. Fuente funcional: [spec.md](spec.md) FR-001–008; decisiones en [research.md](research.md). Fuentes originales verificadas: V3 RF-004, hoja «RF corregidos» fila 5 y D-08 hoja «Decisiones y pendientes» fila 9 (ambas propuestas); A CU03 p. 32 y CU04/CU05 pp. 33–35; DBML líneas 44–58 y 154–157 (propuesta de ERD).

## Cuenta, identidad y sesión del personal (existentes)

| Entidad y campos pertinentes | Propietario | Regla de autorización |
| --- | --- | --- |
| `user_accounts`: `id` UUID, `auth_user_id`, `role` ADMIN/TEACHER, `status` PENDIENTE/ACTIVA/INACTIVA | Usuarios / cuentas 001 | Únicamente ACTIVA, un rol válido y vinculación concordante pueden solicitar operaciones protegidas; IDs de cuenta proceden del servidor. |
| `user`: `id` texto, `role` admin/teacher, `banned`, `email` | Better Auth, validado en `active-identity.ts` | Si el rol de identidad difiere del de `user_accounts`, no se autoriza. |
| `session` y `session_activity`: sesión opaca vigente, último éxito protegido | Autenticación 003 | 30 min exactos de inactividad según 003; JWT por sí solo y solicitudes denegadas no prolongan acceso. |

No se añaden columnas a estas tablas para almacenar un grupo o rol secundario. Una sesión no contiene permisos ni ámbitos congelados; tras cambio de rol se usa la cuenta actual. `account_audit_events` registra transiciones de rol/cuenta propias de 001; no se declara que ya registre lecturas de estudiantes.

## Responsabilidad académica (propuesta de dependencia, no implementada)

| Entidad lógica | Dato mínimo requerido por autorización | Relación/validación |
| --- | --- | --- |
| Grupo | ID estable, docente responsable vigente referenciado por ID de cuenta, estado/vigencia de la asignación según el diseño de Académico | Un docente puede tener varios grupos; solo relaciones vigentes dan ámbito. La tabla `groups.teacher_id` del DBML es una propuesta y apunta a `users.id` de otro diseño: debe mapearse explícitamente a `user_accounts.id` si se implementa. |
| Estudiante | ID estable y grupo al que pertenece actualmente; estado según Académico | Para autorizar un estudiante se comprueban conjuntamente su grupo real y la asignación vigente de ese grupo al docente; el grupo proporcionado en una solicitud no reemplaza este vínculo. |
| Asignación docente | Cuenta docente, grupo, vigencia/estado y versión o mecanismo equivalente para detectar cambios concurrentes | Académico decide modelo temporal al implementar; no se inventa multiplicidad ni fecha normativa. Una asignación retirada nunca autoriza solicitudes posteriores. |

Académico conserva como única autoridad la pertenencia y asignación; Usuarios solicita una decisión y no persiste réplicas. A §3.1 p. 8 y DBML pp./líneas citadas documentan modelo de grupos, no garantizan su presencia en el repositorio. El consentimiento vigente se comprueba por la operación correspondiente en Académico/Tareas: **asignación y consentimiento son condiciones distintas**.

## Solicitud, decisión y objetivo (transitorios, sin tabla nueva)

| Dato | Procedencia | Invariante |
| --- | --- | --- |
| Actor autenticado | `requireActive` + cuenta/rol revalidados | Ningún rol, cuenta o ID de docente enviado por el cliente sustituye al actor de la sesión. |
| Operación | Consumidor, nombre explícito de una operación aprobada; lectura individual, escritura o listado | ADMIN de cuentas solo permite gestión de cuentas; acciones docentes sobre menores requieren permiso del consumidor y ámbito. Operación desconocida denegada. |
| Objetivo individual | ID normalizado de grupo o estudiante | ID vacío/inválido o tipo desconocido denegado. El proveedor confirma la pertenencia real antes del acceso. |
| Ámbito de listado | Conjunto de grupos/estudiantes vigentes del docente, obtenido de Académico | Un conjunto vacío conocido produce lista vacía; error al obtener el conjunto produce denegación, no lista total. El filtro opcional del cliente solo puede reducir el conjunto. |
| Decisión | Permitido con objetivo/ámbito verificado, o denegado sin datos sensibles | No exponer la existencia de un objetivo ajeno. No reutilizar una decisión en solicitudes posteriores. |

## Consistencia, transiciones y cardinalidad

```text
Cuenta ACTIVA + sesión vigente + rol concordante + operación permitida
    + asignación vigente confirmada → decisión positiva limitada al objetivo/ámbito
Cuenta inactiva/rol discordante/sesión vencida u operación sin permiso → denegación
Asignación retirada o estudiante movido de grupo → denegación en la primera solicitud posterior
Falla de proveedor o comprobación inconclusa → denegación sin datos ni cambio
```

- Lectura individual: solo consultar el registro objetivo después de resolver su ámbito efectivo. Para listados/agregados, limitar la consulta por asignación actual **antes** de obtener filas, totales, páginas o opciones de filtro; los parámetros no autorizados no aparecen en resultados o metadatos.
- Escritura simple o múltiple: no basta una comprobación previa aislada. La asignación y todos los objetivos de la operación deben seguir vigentes durante la confirmación de la transacción (bloqueo/condición de versión equivalente según el esquema académico definitivo); si uno es ajeno o revocado, revertir toda la modificación. Evitar lecturas y escrituras separadas que permitan una reasignación intermedia sin reevaluar el permiso.
- Un mismo docente puede tener varios grupos, pero esta feature no fija cardinalidad histórica ni si un estudiante puede pertenecer a varios en el tiempo; Académico debe documentarlo antes de elegir el esquema. Las pruebas incluyen cambio de asignación y cambio de grupo sin permisos residuales.
- No crear tabla de permisos o sesión propia de 004: el cambio requerido es una decisión por solicitud y la integración de futuros consumidores. Contrato de frontera: [authorization-boundary.md](contracts/authorization-boundary.md).

## Decisión mínima aprobada para esta integración (2026-10-14)

El responsable confirmó lectura/edición docente únicamente para el ámbito asignado, con edición **solo de nombre y apellidos**, un docente vigente por grupo y un grupo vigente por estudiante. Para hacer la comprobación con una fuente persistida real en 004, Académico tendrá `groups.id` UUID, `teacher_account_id` UUID FK a `user_accounts.id`, `name`, `grade`, `school_year`; `students.id` UUID, `group_id` UUID FK, `student_code` único, `first_name` y `last_name` no vacíos y `is_active=false` por defecto. La FK del docente debe referir `user_accounts.id` (no el `users.id` del ERD alternativo). Se admite mover asignaciones mediante operación interna de Académico, **sin** ruta pública de reasignación en 004; cada acceso comprueba la fila vigente. Durante escrituras, bloquear grupo y estudiante y reevaluar el rol/estado de la cuenta dentro de la misma transacción para evitar que un cambio concurrente autorice una escritura posterior. El diseño más amplio de consentimiento, activación, registro, historial de reasignaciones y otros campos se reserva para el módulo Académico, sin introducirlos aquí como funcionalidad pública.
