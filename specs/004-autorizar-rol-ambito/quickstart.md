# Guía de validación: autorización por rol y responsabilidad

**Estado**: autorización de cuentas y superficie académica mínima verificada con asignaciones y estudiantes persistidos. El panel de Seguimiento y la gestión de altas/consentimiento no están implementados; la evidencia de listas académicas no valida el panel. Modelos y reglas: [data-model.md](data-model.md); [contrato interno](contracts/authorization-boundary.md), [contrato académico](contracts/academic-students.openapi.yaml) y [contrato de cuentas](contracts/accounts-authorization.md).

## Preparación

1. Node.js 24, PostgreSQL 17 de pruebas aislado, variables de `.env.example` provistas fuera del repositorio y correo capturado solo con `NODE_ENV=test`. Reutilizar la configuración y advertencias de [quickstart de 003](../003-autenticar-usuarios/quickstart.md); no emplear datos reales de menores.
2. En la raíz del repositorio, instalar y preparar la base de prueba antes de correr la suite:

```bash
npm ci
npm run db:migrate
npm run typecheck
npm test
npm run dev
```

Si PostgreSQL no está disponible, la suite de integración falla por conexión; ello no acredita ni refuta la autorización. La migración `0008_fresh_wild_pack.sql` se generó con Drizzle sobre el modelo mínimo académico.

### Línea base al iniciar 004 (2026-10-14)

- Rama `004-autorizar-rol-ambito`; Node v24.18.0, npm 11.16.0. `npm ci` finalizó correctamente (213 paquetes instalados). El repositorio ya dispone de `.gitignore` y `.dockerignore` adecuados para el stack actual.
- PostgreSQL de pruebas aislado `kudlab_test` en `127.0.0.1:55432` (Podman `kudlab-auth-test-003`); `npm run db:migrate` con `DATABASE_URL` y `MIGRATION_DATABASE_URL` explícitas de **esa** base finalizó; `npm run typecheck` pasó. `npm test` tuvo que repetirse con mayor tiempo de espera (el primer intento superó el límite del ejecutor de 120 s): **19 archivos y 82 pruebas aprobadas** en 145,53 s. Esta cifra es la línea base de 001–003, antes de agregar pruebas de 004.
- No se ejecutó `npm run dev` porque el baseline se verificó con la API invocada directamente por Vitest; este resultado no acredita la funcionalidad integrada de ámbito ni la prueba humana.

### Frontera compartida 004

- `tests/unit/scope-authorization.test.ts` amplió casos denegados por proveedor ausente, caído o respuesta no booleana. Antes de corregir `src/modules/usuarios/scope-authorization.ts`, una respuesta malformada `'yes'` otorgaba acceso; el test falló como se esperaba. Ahora solo el booleano `true` permite el objetivo individual: suite enfocada **3/3** y `npm run typecheck` correcto. Son dobles y no validan asignaciones de Académico.
- Se revisó `src/auth/session-guard.ts`: `requireActive` ya utiliza sesión opaca persistida, `resolveActiveIdentity` valida estado/rol y `checkSessionActivity` aplica inactividad; `requireAdmin` filtra cuentas y `authorizeProtectedScope` deniega si falta proveedor o la revalidación del actor falla. El único ajuste de código compartido necesario fue el booleano estricto del proveedor.

### MVP de rol en cuentas (2026-10-14)

- Se añadieron `tests/contract/accounts-authorization.test.ts` y `tests/integration/role-scope-boundaries.test.ts`: matriz HTTP de cuentas sin sesión/TEACHER/ADMIN, rutas directas, ascenso y degradación con sesión abierta, denegación que no registra actividad, cuenta inactiva o discordante, JWT sin sesión, fallo de identidad y cierre. Las cinco pruebas nuevas pasaron con PostgreSQL de pruebas; la precedencia `requireActive`→`requireAdmin` y el contrato de 001 ya estaban correctamente implementados en `src/app.ts`/`src/modules/usuarios/accounts.routes.ts`, por lo que no hubo que alterar esas rutas.
- Verificación global posterior: `npm run typecheck` correcto y `npm test` **21 archivos, 88/88 pruebas aprobadas** (frente a 19 archivos y 82 pruebas de línea base). Se confirma SC-001 en operaciones existentes de cuentas y únicamente el cambio de rol de SC-004; SC-002/003 y el cambio de asignaciones de SC-004 siguen sin prueba integrada.

### Dependencias para continuar US2/US3

- T011/T012 esperan una decisión del responsable sobre operaciones específicas por rol y el diseño autoritativo de asignaciones docente↔grupo↔estudiante de Académico (vigencia, retiro/reasignación y protección de escrituras concurrentes). Aún no existe `src/modules/academico` ni `src/modules/seguimiento` y no se ha aprobado un contrato de consumidor. No se publicaron rutas de estudiantes ni se atribuye al test con dobles una comprobación real de ámbito.

## Recorrido verificable con rutas actuales (P1, cuentas)

1. Iniciar sesión como ADMIN activo y como TEACHER activo con credenciales de prueba según 001/003; `GET /api/auth/get-session` solo presenta identidad propia y no renueva inactividad.
2. Pedir `GET /api/v1/accounts`, `GET /api/v1/accounts/{id}` y `POST /api/v1/accounts` con sesión ADMIN, TEACHER, sin sesión y con una cuenta inactivada. Solo ADMIN puede entrar a la gestión definida en [contrato 001](../001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml). Las negativas no muestran cuentas ni modifican registros.
3. Cambiar rol ADMIN→TEACHER conforme al contrato existente con otra cuenta ADMIN; la primera solicitud protegida posterior ya no debe permitir gestión de cuentas. Una sesión que venció tras 30 minutos desde el último éxito protegido requiere ingreso nuevo; las denegaciones previas no prolongan su tiempo.
4. En `tests/unit/scope-authorization.test.ts`, simular proveedor que confirma ámbito propio, rechaza ajeno o falla; sin proveedor debe denegar. Este test no verifica asignaciones reales ni consultas de estudiantes.

## Recorrido integrado académico (P2/P3, superficie mínima)

**Precondiciones**: base de pruebas migrada, docentes activados y grupos/estudiantes ficticios persistidos por las pruebas. La aprobación del responsable cubre únicamente lectura docente y edición de nombre/apellidos de alumnos asignados; no hay API de alta ni activación de estudiantes. El panel de Seguimiento permanece fuera de esta superficie.

1. Crear dos docentes activos y dos grupos con al menos un estudiante ficticio cada uno, asignados mediante Académico; confirmar que el grupo del docente 1 es inaccesible para el docente 2 y viceversa, tanto en lectura individual como en modificación real autorizada por la operación del consumidor.
2. Intentar IDs ajenos y un ID de estudiante junto a un groupId propio que no le corresponde; denegar sin indicar si existe el objetivo. Intentar escritura mixta sobre objetivo propio y ajeno: rechazar íntegramente sin efectos parciales.
3. Consultar lista sin filtro, con filtro propio, ajeno y mixto, así como conteos, páginas, opciones de filtro y resúmenes. Solo se devuelve el ámbito propio; un conjunto autorizado vacío devuelve lista vacía, una falla al obtenerlo deniega la solicitud.
4. Retirar una asignación, cambiar el grupo del estudiante y cambiar el rol mientras hay sesiones abiertas. En la primera solicitud posterior, ningún permiso obsoleto debe mantenerse. Durante una escritura concurrente con reasignación, o se confirma íntegra bajo permiso vigente o se cancela íntegra.
5. Simular caída de la consulta de asignaciones y probar solicitudes directas sin pasar por la SPA; no aparecen registros ajenos ni errores con identificadores de menores. Repetir con cuenta inactiva, sesión cerrada/vencida, rol incongruente y proveedor ausente.
6. Registrar evidencia separada de SC-002 y de la parte académica de SC-003/004; no declarar cubierto el panel de Seguimiento por estas pruebas. [US3/SC-003 de 002](../002-validar-perfil-acceso/quickstart.md) ahora puede comprobarse para lectura/edición académica mínima, pero cualquier recorrido de seguimiento queda pendiente.

### Evidencia ejecutada de integración (2026-10-14)

- `src/db/schema/academic.ts` y migración `src/db/migrations/0008_fresh_wild_pack.sql`: grupo con `teacher_account_id` apuntando a la cuenta, estudiante con un grupo, `student_code` único y `is_active=false` por defecto. No se implementa activación ni consentimiento, y no se expone alta pública en esta iteración.
- `GET /api/v1/students/{id}`, `PATCH /api/v1/students/{id}` (solo `firstName`/`lastName`), `GET /api/v1/students` y `GET /api/v1/groups` comprueban cuenta, rol TEACHER y ámbito real; el segundo control de escritura comprueba asignación y rol dentro de la transacción. ADMIN no hereda acceso a menores. La creación de estudiantes/grupos en estas pruebas se realiza **dentro del entorno de prueba** y no constituye un flujo de registro implementado.
- `tests/integration/academic-scope.test.ts` y `tests/contract/academic-authorization.test.ts` cubren dos docentes/grupos, lectura/edición propia, ID ajeno, grupo manipulado, campos prohibidos, proveedor caído, cambio de grupo/docente y carrera de reasignación antes de escritura. `tests/integration/academic-lists-scope.test.ts` y `tests/contract/academic-lists-authorization.test.ts` prueban listados, grupo propio/ajeno/mixto, paginación, conteos, opciones, conjunto vacío frente a caída y primera solicitud tras revocación. Suites enfocadas **12/12 pruebas aprobadas** en 5 archivos, incluida prueba de carga.
- Verificación global: `npm run typecheck` correcto; `npm test` **26 archivos, 100/100 pruebas aprobadas** con PostgreSQL de pruebas migrado. No equivale a aprobación de RF-004 V3, despliegue escolar ni verificación de Seguimiento.

## Medición y aceptación pendiente

- Para SC-001/004 comparar matriz de casos contra HTTP real y cambio de rol; conservar respuesta y ausencia de efectos. Repetir las pruebas de contrato de 001/003 después de modificar los guardias.
- SC-005: con el consumidor integrado y 30 sesiones de prueba, medir latencia p95 de consultas propias, ajenas y listados, indicando entorno, volumen de registros y muestras. La referencia de <2 s procede de A §3.2 p. 17 y no equivale a aprobación institucional ni a prueba en producción.
- SC-006: con SPA y al menos cinco adultos del piloto, registrar por intento si identifican su grupo, entienden la denegación, necesitan ayuda y cuánto tardan; no atribuir este resultado a tests automatizados.
- Documentar matriz autorizada por operación, permisos del ADMIN sobre menores (si se aprueban expresamente), estados de asignación, consentimiento por consumidor y evidencia de pruebas antes de declarar implementada RF-004 V3. Su texto en la fuente original sigue «Propuesto - corregido para validación».

### Medición informativa local (2026-10-14)

`npm test -- tests/performance/academic-scope-load.test.ts --reporter verbose --silent=false` sobre PostgreSQL de pruebas con dos grupos y dos estudiantes ficticios: 30 sesiones TEACHER independientes y 30 peticiones concurrentes por escenario; p95 consulta propia **404,8 ms**, ajena **214,5 ms**, listado **549,3 ms**. El umbral propuesto <2 s se observa en este entorno local solamente; no se ha medido producción ni ejecutado SC-006 con adultos/SPA.

### Trazabilidad y límites de la evidencia

| Regla / resultado | Evidencia verificable | Estado |
| --- | --- | --- |
| FR-001/002/006/008 y SC-001 (cuentas y rol) | `tests/contract/accounts-authorization.test.ts`, `tests/integration/role-scope-boundaries.test.ts` y regresión de 001–003 | Comprobado para operaciones existentes de cuentas; excepciones de ascenso/invitación preservadas. |
| FR-003/005/006 y SC-002 | `tests/integration/academic-scope.test.ts` y `tests/contract/academic-authorization.test.ts` | Comprobado para lectura individual y edición **solo de nombres**, con dos grupos en BD. No hay operación pública de edición múltiple; un cuerpo que intenta incluir IDs/campos extra es rechazado íntegramente. |
| FR-004/005 y SC-003 | `tests/integration/academic-lists-scope.test.ts` y `tests/contract/academic-lists-authorization.test.ts` | Comprobado para listados, filtros, paginación y conteos de grupos **académicos**. Panel/filtros por período/indicadores de Seguimiento aún pendientes (T026); SC-003 global sigue parcial. |
| FR-007 y SC-004 | Pruebas de fallo de proveedor, cuenta, rol, primera consulta tras reasignación y escritura concurrente en suites anteriores | Comprobado en la superficie de cuentas/Académico; otros consumidores aún no existen. |
| SC-005 | `tests/performance/academic-scope-load.test.ts` | Medición local informativa de 30 sesiones, sin aprobación institucional ni afirmación sobre producción. |
| SC-006 | Requiere SPA y al menos cinco adultos; T031 | **No realizada**. |

**Revisión contractual T028**: `src/app.ts` restringe estudiantes y grupos a sesión vigente + TEACHER, `students.routes.ts` admite solo `firstName`/`lastName` y el servicio aplica un segundo control de cuenta/asignación antes de escribir. `GET /api/v1/groups` cuenta únicamente estudiantes del grupo propio; el proveedor entrega conjunto vacío distinto de indisponibilidad. La relación docente↔grupo↔estudiante se modeló en `src/db/schema/academic.ts`, no como claim de sesión. La verificación de consentimiento para activar estudiantes e iniciar tareas, las rutas de alta/inactivación, la auditoría de lecturas académicas y los indicadores/periodos son contratos de sus módulos: **no** están cubiertos por 004 ni se habilitan como parte de estas rutas. T026 y T031 siguen abiertas; no se declara RF-004 V3 aprobada ni la feature completa en el piloto.
