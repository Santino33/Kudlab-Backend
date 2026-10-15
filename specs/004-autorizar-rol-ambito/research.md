# Investigación técnica: autorización por rol y responsabilidad

**Fecha**: 2026-10-14. **Estado de las fuentes funcionales**: `docs/original/requisitos_V3.xlsx`, hoja «RF corregidos», fila 5 (RF-004 V3: rol, ámbito docente y servidor; «Propuesto - corregido para validación»), hoja «Decisiones y pendientes», fila 9 (D-08: «Propuesto»). En `docs/original/3 ANALISIS DEL PROYECTO.docx.pdf`, CU03 p. 32 y secuencia p. 45 exigen rol/responsabilidad y denegación si falla la verificación; CU04/CU05 pp. 33–35 limitan resultados/filtros. Allí «RF-004» significa consulta de estudiantes (p. 19), «RF-026» restricción por rol en la tabla de usuarios (p. 23) y CU03 menciona «RF-027» (p. 32): no se equiparan a RF-004 V3. DBML `docs/original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml` líneas 44–58 y 154–157 propone `groups.teacher_id` y `students.group_id`, pero no está implementado. Decisiones de rol único y sesión opaca proceden de specs 001/003 y código existente, no del ERD.

## R-01 — Autoridad del actor y política de roles

**Decision**: Reutilizar `requireActive`, `resolveActiveIdentity` y `checkSessionActivity` de Usuarios en toda ruta protegida. Mantener el permiso ADMIN para gestión de cuentas mediante `requireAdmin` y evitar autorización genérica que conceda cualquier acción al ADMIN; permitir operaciones docentes solo mediante nombres de operación explícitos del consumidor, rol TEACHER y ámbito validado. No aceptar JWT firmado como sustituto de la sesión opaca persistida.

**Rationale**: `src/app.ts` ya protege `/api/v1/accounts` y `src/auth/active-identity.ts` contrasta cuenta ACTIVA y rol con identidad Better Auth; `src/auth/session-guard.ts` comprueba sesión e inactividad. La feature 003 confirmó que una petición denegada no reinicia la sesión. Se evita introducir privilegios por simple rol o claims obsoletos.

**Alternatives considered**: Permiso universal ADMIN sobre menores; no hay matriz aprobada. Autorizar por JWT/rol del cliente; no garantiza cuenta/sesión/rol vigentes.

## R-02 — Propiedad y forma de la asignación vigente

**Decision**: Académico será la autoridad de la relación docente↔grupo y estudiante↔grupo. El proveedor de asignaciones debe decidir por `user_accounts.id`, objetivo normalizado y operación vigente; para estudiante debe verificar pertenencia efectiva al grupo asignado. Usuarios no almacena copia ni acepta un `teacherId` o `groupId` declarados por el cliente como prueba. Un provider ausente, error o respuesta inconclusa siempre deniega.

**Rationale**: DBML líneas 44–58, 154–157 y A CU03 p. 32 documentan grupo/docente/estudiante; 002 ya creó `src/modules/usuarios/scope-authorization.ts` con un `AssignmentProvider` inyectable, pero no hay `src/modules/academico` ni rutas de estudiantes. El nuevo contrato explicita su semántica, no inventa una fuente en producción.

**Alternatives considered**: Tabla duplicada de ámbito en Usuarios o proveedor fijo de grupos para pasar pruebas; se desactualizaría o daría falsa evidencia integrada.

## R-03 — Listas, filtros y agregados

**Decision**: El consumidor debe construir sus consultas de listado/agregación **limitando los datos antes** de paginar, contar o resumir. Un filtro de ID ajeno no amplía ámbito; una lista mixta devuelve exclusivamente registros autorizados, sin metadatos sobre los descartados. Las consultas individuales ajenas y modificaciones con algún objetivo ajeno se rechazan completas. La comprobación de un `groupId` proporcionado no sustituye la relación efectiva del estudiante.

**Rationale**: RF-004 V3 fila 5 y A CU04/CU05 pp. 33–35 exigen consulta y filtros limitados. Filtrar después de sumar o paginar expondría totales y tamaños de grupos ajenos.

**Alternatives considered**: Listar todo y filtrar en SPA; filtra datos sensibles. Filtrar registros tras calcular total o resumen; revela datos agregados ajenos.

## R-04 — Consistencia frente a reasignación concurrente

**Decision**: Para lecturas, resolver rol/ámbito al momento de solicitar datos y asegurar que la consulta de datos y los filtros usan el mismo ámbito verificado; para escrituras, comprobar asignación y realizar el cambio como unidad coherente bajo transacción/condición de vigencia apropiada del módulo Académico. Invalidar la solicitud completa si una reasignación ocurre antes de confirmar la escritura. Consultas repetidas usan asignaciones actuales; no mantener cache de permisos efectivos fuera de la solicitud.

**Rationale**: SC-004 exige que el primer acceso posterior a revocación pierda permiso; separar comprobación y escritura deja una carrera. El mecanismo de bloqueo/versión concreto se selecciona al implementar el esquema académico real, manteniendo el contrato de consistencia.

**Alternatives considered**: Confiar en la última vista o en tokens de ámbito de larga duración; quedarían permisos residuales tras reasignación.

## R-05 — Interfaz y pruebas proporcionales al riesgo

**Decision**: Mantener contrato público de cuentas en `specs/001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml`; documentar aquí su overlay de permisos y un contrato **interno** para el proveedor/consumidores futuros, sin crear hoy endpoints de estudiantes. Usar Vitest + PostgreSQL existentes; pruebas unitarias de negativas y rol, HTTP en cuentas, y pruebas de dos docentes con proveedor **real** y rutas reales en la fase de integración. Medir p95 con 30 sesiones cuando exista el recorrido, sin sustituir la validación con adultos por pruebas automáticas.

**Rationale**: `tests/unit/scope-authorization.test.ts` solo simula el proveedor; quickstart de 002 marca US3/SC-003 bloqueadas. `src/app.ts` monta cuentas y rutas de autenticación, no módulos académicos. A §3.2 p. 17 contiene las referencias de tiempo/concurrencia, no una aprobación de la meta propuesta de 004.

**Alternatives considered**: OpenAPI nuevo para rutas no definidas, migraciones ficticias o declarar cobertura integrada con dobles; confundirían diseño con comportamiento verificable.

## Condiciones funcionales pendientes de aprobación

- Confirmar matriz de operaciones de estudiantes/grupos por rol y subrecurso con el responsable y el módulo dueño; si no existe permiso aprobado, denegar.
- Acordar diseño de asignaciones vigentes y transición histórica entre grupos en Académico, y su contrato de altas/inactivaciones, antes de migrar o servir datos de menores.
- Los requisitos de consentimiento y auditoría de lecturas estudiantiles corresponden a sus features y a constitución II/V; deberán aplicarse junto a autorización en cada consumidor, sin inferir que una asignación prueba consentimiento.

Son dependencias funcionales de activación de futuros consumidores; las decisiones técnicas necesarias para documentar este plan y el límite cerrado actual ya están resueltas.

## Inventario efectivo al comenzar implementación (2026-10-14)

- `src/app.ts` monta `/api/v1/accounts` detrás de `requireActive` y `requireAdmin`; `accounts.routes.ts` opera bajo esa guarda. `GET /api/auth/get-session` comprueba sesión/identidad pero no renueva la actividad de negocio; `src/auth/session-activity.ts` solo registra una solicitud protegida aceptada.
- `src/auth/session-guard.ts` obtiene una sesión opaca, `resolveActiveIdentity` contrasta `user_accounts` con `user`, comprueba 30 minutos y solo registra actividad si la respuesta protegida fue exitosa. `authorizeProtectedScope` revalida identidad antes de consultar al proveedor, que hoy es opcional.
- `src/modules/usuarios/scope-authorization.ts` acepta exclusivamente TEACHER ACTIVA, `read|write`, `student|group`, ID no vacío y proveedor; devuelve denegado si falla. `tests/unit/scope-authorization.test.ts` solo emplea dobles. No existe proveedor académico ni ruta real de estudiantes o panel para verificar dos docentes de grupos distintos.
- `specs/004-autorizar-rol-ambito/contracts/accounts-authorization.md` coincide con las rutas actuales de cuentas; `contracts/authorization-boundary.md` establece el contrato **a integrar** con Académico. Las excepciones de solicitud de ascenso y de aceptación de invitación permanecen fuera de `requireAdmin` de cuentas.

## Decisiones del responsable para esta iteración (2026-10-14)

**Decision**: Docente con rol TEACHER consulta solo estudiantes/grupos asignados y modifica exclusivamente nombre y apellidos del estudiante asignado; ADMIN conserva únicamente la gestión de cuentas. Cada grupo tiene un docente vigente y cada estudiante un grupo. Alta, activación, reasignación pública, gestión de consentimiento y métricas de Seguimiento permanecen para sus features.

**Rationale**: El responsable eligió expresamente lectura/edición docente, relación de uno a muchos grupo→estudiante y edición acotada al nombre. La capa mínima de asignaciones persistidas de Académico permite probar la autorización con dos docentes reales sin convertir una asignación de tarea en una asignación de grupo. Para escrituras, la fila de grupo y la cuenta se comprueban bajo una transacción/bloqueo compartido con la modificación.

**Alternatives considered**: Autorizar toda la edición de la ficha o al ADMIN sobre menores sin decisión explícita, o continuar usando un doble de asignación: ninguna satisface la decisión ni el contrato de aislamiento.
