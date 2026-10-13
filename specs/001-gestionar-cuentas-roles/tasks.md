---
description: "Tareas de implementación: gestionar cuentas y roles"
---

# Tasks: Gestionar cuentas y roles

**Input**: Diseño en `specs/001-gestionar-cuentas-roles/`.

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [accounts.openapi.yaml](contracts/accounts.openapi.yaml)
y [quickstart.md](quickstart.md).

**Tests**: Se incluyen pruebas de contrato, integración y seguridad porque la
especificación define recorridos verificables y la constitución exige comprobar
permisos, integridad y cambios de contrato.

**Organization**: Cada historia entrega un resultado comprobable por separado.
`[P]` indica tareas sobre archivos distintos que no dependen entre sí.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicializar el backend, sus herramientas y configuraciones de prueba.

- [x] T001 Crear `package.json` con Node.js 24, TypeScript, Hono, Better Auth 1.7.x, `@better-auth/drizzle-adapter` compatible, Drizzle/PostgreSQL, `jose`, Vitest y scripts `dev`, `test`, `db:generate`, `db:migrate`; generar `package-lock.json` fijando versiones compatibles.
- [x] T002 [P] Configurar TypeScript estricto, módulos y directorio `src/` en `tsconfig.json`.
- [x] T003 [P] Configurar Vitest con pruebas de `tests/unit/`, `tests/contract/` y `tests/integration/` en `vitest.config.ts`.
- [x] T004 [P] Configurar conexión de migraciones PostgreSQL desde variable de entorno en `drizzle.config.ts`, sin credenciales literales.
- [x] T005 [P] Documentar `DATABASE_URL`, secreto Better Auth, origen SPA, proveedor de correo y credenciales iniciales del ADMIN en `.env.example` sin secretos literales; indicar dominio `.edu.co`, contraseña de ocho con mayúscula/minúscula/número y TTL fijo de siete días.
- [x] T006 [P] Excluir `.env`, volcados y credenciales locales sin dejar de ignorar `docs/original/` en `.gitignore`.

**Checkpoint**: El proyecto puede instalar dependencias y ejecutar la configuración básica.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Autenticación, persistencia y control de acceso reutilizables por las tres historias.

**CRITICAL**: No iniciar historias hasta contar con una guardia que falle cerrado.

- [x] T007 Registrar en `specs/001-gestionar-cuentas-roles/research.md` las decisiones del responsable: dominio `.edu.co`, contraseña mínima de ocho con mayúscula/minúscula/número, invitación siete días, ascenso solicitado/aprobado por otro ADMIN, bootstrap automático y registros indefinidos; distinguir de V3 propuesta.
- [x] T008 [P] Validar al iniciar origen confiable, secreto, proveedor de correo y credenciales iniciales del ADMIN; aplicar dominio `.edu.co`, contraseña de ocho con mayúscula/minúscula/número y TTL de siete días en `src/config/env.ts`, fallando cerrado si faltan credenciales al crear el primer ADMIN.
- [x] T009 [P] Generar y revisar esquema Better Auth (user, account, session, campos Admin y jwks si se habilita JWT) para la versión fijada en `src/db/schema/auth.ts`; el hash vive en `account`, no en otra tabla de usuarios.
- [x] T010 [P] Definir en `src/db/schema/accounts.ts` cuenta con `auth_user_id` único y nulo solo en PENDIENTE, `email_normalized` único y dominio `.edu.co` incluso INACTIVA, `role` exactamente ADMIN/TEACHER y `status` PENDIENTE/ACTIVA/INACTIVA; invitación `token_digest` único, `expires_at=created_at+7 días`, `consumed_at`/`invalidated_at` opcionales y `delivery_status` PENDIENTE/ENVIADA/ERROR; `admin_role_requests` con estados PENDIENTE/APROBADA/RECHAZADA, una pendiente por docente, y auditoría append-only sin caducidad.
- [x] T011 Crear conexión Drizzle reutilizable sobre PostgreSQL en `src/db/client.ts` usando configuración validada de `src/config/env.ts`.
- [x] T012 Generar migración de ambos esquemas con un solo flujo Drizzle Kit y restricciones de unicidad/integridad en `src/db/migrations/0001_accounts.sql`; no ejecutar `auth migrate` como migración paralela.
- [x] T013 Configurar Better Auth Admin (`admin` y rol `teacher` sin gestión), Bearer opaco, JWT/JWKS para interoperabilidad, registro público desactivado, contraseña mínima de ocho con mayúscula/minúscula/número también en cambios/restablecimientos y sesiones persistidas sin cookie cache en `src/auth/auth.ts`.
- [x] T014 Configurar Hono con CORS de origen explícito, `trustedOrigins`, handler de Better Auth `/api/auth/*` antes de rutas catch-all y denegación de administración directa `/api/auth/admin/*` y alta pública `/api/auth/sign-up/email` en `src/app.ts`.
- [x] T015 Implementar guardia que compruebe sesión real, cuenta ACTIVA, coincidencia de rol vigente en Better Auth/Kudlab y permiso ADMIN en cada solicitud; devolver 401/403 sin datos privados y no autorizar por JWT firmado solamente en `src/auth/session-guard.ts`.
- [x] T016 [P] Definir códigos de error consistentes con 400/401/403/404/409/410/503 de `contracts/accounts.openapi.yaml`, sin revelar identidad ajena, en `src/modules/usuarios/accounts.errors.ts`.
- [x] T017 Implementar inserción/consulta de eventos auditables sin contraseñas ni tokens, con actor, objetivo, fecha y antes/después mínimos, en `src/modules/usuarios/audit.service.ts`.
- [x] T018 [P] Proveer envío de correo real configurable y captura simulada para pruebas, sin afirmar ENVIADA antes de confirmación de entrega, en `src/modules/usuarios/invitations.mailer.ts`.
- [x] T019 Implementar bootstrap automático al primer arranque usando correo `.edu.co` y contraseña válida recibidos por configuración segura, creando exactamente un ADMIN ACTIVA asociado a Better Auth y auditado; reinicios no duplican/restablecen ni reactivan cuentas, en `src/scripts/bootstrap-admin.ts` y su invocación desde `src/index.ts`.
- [x] T020 Probar en `tests/integration/auth-boundaries.test.ts` que docente, sesión inválida, cuenta PENDIENTE/INACTIVA y rol discordante son rechazados, y que el registro público y endpoints Admin no eluden reglas; incluir tres arranques con el mismo ADMIN y fallo sin credenciales en base vacía.

**Checkpoint**: Seguridad y almacenamiento básicos funcionan y las restricciones institucionales están documentadas; ningún acceso sin estado y rol vigentes.

---

## Phase 3: User Story 1 - Crear y consultar cuentas (Priority: P1) 🎯 MVP

**Goal**: ADMIN crea cuenta PENDIENTE, envía invitación y puede consultarla; el titular la activa sin registro público.

**Independent Test**: Crear TEACHER, consultar listado/detalle y auditoría, aceptar invitación una vez y confirmar acceso; duplicado o actor no autorizado no alteran datos.

### Tests for User Story 1

- [x] T021 [P] [US1] Escribir antes de implementar pruebas del contrato POST/GET `/api/v1/accounts`, GET `/{id}`, GET `/{id}/audit` y POST `/api/v1/account-invitations/accept`, incluidos 201/400/401/403/409/410/503, en `tests/contract/accounts-create-list.test.ts`; comprobar que fallan primero.
- [x] T022 [P] [US1] Escribir pruebas de integración para alta PENDIENTE solo TEACHER, enlace de uso único válido menos de siete días, vencido desde el séptimo día, contraseña <8/sin mayúscula/minúscula/número, dominio distinto de `.edu.co`, dos altas simultáneas, entrega fallida y auditoría sin token en `tests/integration/account-invitation.test.ts`; comprobar que fallan primero.

### Implementation for User Story 1

- [x] T023 [P] [US1] Validar nombre, correo cuyo dominio tras `@` termina en `.edu.co` sin distinguir mayúsculas/minúsculas, unicidad normalizada y rol TEACHER exclusivo en altas ordinarias en `src/modules/usuarios/accounts.validation.ts`.
- [x] T024 [US1] Generar secreto de invitación de uso único y guardar solo `token_digest` único con `expires_at=created_at+7 días` y entrega PENDIENTE/ENVIADA/ERROR; rechazar desde ese instante, titular ajeno y consumo concurrente en `src/modules/usuarios/invitations.service.ts`.
- [x] T025 [US1] Implementar alta de `user_accounts` PENDIENTE con `auth_user_id` nulo, correo único incluso INACTIVA y auditoría INVITE consistente; listar y consultar por ADMIN paginado en `src/modules/usuarios/accounts.service.ts`.
- [x] T026 [US1] Publicar POST/GET `/api/v1/accounts`, GET `/{id}` y GET `/{id}/audit` con guardia ADMIN y esquemas de `contracts/accounts.openapi.yaml` en `src/modules/usuarios/accounts.routes.ts`.
- [x] T027 [US1] Completar aceptación idempotente con contraseña del titular de mínimo ocho caracteres, mayúscula, minúscula y número usando Better Auth; no consumir enlace si falla validación, auditar ACTIVATE y cambiar PENDIENTE→ACTIVA solo al confirmar, reconciliando fallos, en `src/modules/usuarios/invitations.service.ts`.
- [x] T028 [US1] Publicar POST público `/api/v1/account-invitations/accept` sin revelar el secreto en respuestas/logs y sin iniciar sesión por defecto en `src/modules/usuarios/invitations.routes.ts`.
- [x] T029 [US1] Montar rutas de cuentas e invitación en Hono y repetir pruebas de T021/T022 y la guardia de T020 con una cuenta activada en `src/app.ts`.

**Checkpoint**: US1 demostrable por sí sola; invitado no accede antes de activar, no reutiliza invitación y no puede crear ADMIN por alta ordinaria.

---

## Phase 4: User Story 2 - Actualizar datos y cambiar rol (Priority: P2)

**Goal**: ADMIN corrige nombre/correo; TEACHER solicita ascenso y otro ADMIN decide antes de sustituir el rol.

**Independent Test**: Con cuenta existente, actualizar datos; TEACHER solicita ADMIN sin ganar permisos, otro ADMIN aprueba o rechaza; autoaprobación, duplicado y ascenso directo no cambian el rol.

### Tests for User Story 2

- [x] T030 [P] [US2] Escribir pruebas de contrato PATCH cuenta, PUT rol (sin ascenso directo), POST/GET `/api/v1/admin-role-requests`, POST `/{id}/approve` y `/{id}/reject` y POST confirmación de correo según `contracts/accounts.openapi.yaml` en `tests/contract/accounts-update-role.test.ts`; comprobar que fallan primero.
- [x] T031 [P] [US2] Escribir pruebas de integración de cambio de nombre/correo, solicitud TEACHER, aprobación por otro ADMIN, rechazo, solicitud duplicada, cuenta inactiva, autoaprobación, ascenso directo o degradación del último ADMIN prohibidos, permiso vigente desde primera solicitud y fallo de auditoría en `tests/integration/account-update-role.test.ts`; comprobar que fallan primero.

### Implementation for User Story 2

- [x] T032 [US2] Añadir `pending_email_normalized` y cambio de correo con nuevo correo único reservado, digest del token, caducidad y consumo a `src/db/schema/accounts.ts`; generar `src/db/migrations/0002_email_changes.sql`, conservando correo anterior hasta confirmación (la solicitud de ascenso ya está modelada en T010).
- [x] T033 [US2] Implementar solicitud y confirmación de cambio de correo con token de uso único; al editar cuenta PENDIENTE invalidar invitación antigua y emitir nueva, y en ACTIVA no cambiar correo hasta verificación del nuevo, en `src/modules/usuarios/email-changes.service.ts`.
- [x] T034 [US2] Aplicar validaciones de nombre/correo y persistir edición con auditoría UPDATE y actualización coherente de Better Auth sin reescribir historial en `src/modules/usuarios/accounts.service.ts`.
- [x] T035 [US2] Implementar petición TEACHER→ADMIN solo por titular activo, una PENDIENTE por cuenta, aprobación o rechazo por ADMIN distinto con estado/rol y auditoría REQUEST_ADMIN/APPROVE_ADMIN/REJECT_ADMIN/ROLE_CHANGE coherentes; impedir degradar al último ADMIN, restringir PUT directo y denegar discrepancia Better Auth/Kudlab en `src/modules/usuarios/promotion-requests.service.ts` y `src/modules/usuarios/roles.service.ts`.
- [x] T036 [US2] Exponer PATCH cuenta, PUT rol sin ascenso directo y POST/GET solicitudes + POST aprobar/rechazar conforme a respuestas 400/401/403/404/409 en `src/modules/usuarios/accounts.routes.ts` y `src/modules/usuarios/promotion-requests.routes.ts`.
- [x] T037 [US2] Exponer POST de confirmación de correo con token consumible una sola vez y 410 al vencer en `src/modules/usuarios/email-changes.routes.ts`.
- [x] T038 [US2] Montar rutas de confirmación de correo y solicitudes/decisiones de ascenso en Hono y ejecutar T030/T031, incluida prueba de sesión con rol obsoleto, en `src/app.ts`.

**Checkpoint**: US2 comprobable sobre cualquier cuenta habilitada tras Foundation; no requiere haber ejecutado el alta de US1 en la misma prueba (fixture de cuenta existente).

---

## Phase 5: User Story 3 - Inactivar y reactivar cuentas (Priority: P3)

**Goal**: Bloquear acceso vigente tras confirmación, conservar historia y reactivar sin revivir sesiones anteriores.

**Independent Test**: Con cuenta ACTIVA y sesión abierta, cancelar inactivación sin cambio; confirmarla y comprobar denegación en primera solicitud; reactivar y comprobar que exige sesión nueva.

### Tests for User Story 3

- [x] T039 [P] [US3] Escribir pruebas de contrato POST `/api/v1/accounts/{id}/deactivate` y `/reactivate` para confirmación verdadera, estados repetidos y errores en `tests/contract/accounts-lifecycle.test.ts`; comprobar que fallan primero.
- [x] T040 [P] [US3] Escribir pruebas de integración de cancelación, último ADMIN no inactivable, sesión antigua tras inactivar/reactivar, reautenticación, cuenta ya inactiva y fallo de revocación/auditoría en `tests/integration/accounts-lifecycle.test.ts`; comprobar que fallan primero.

### Implementation for User Story 3

- [x] T041 [US3] Implementar transiciones ACTIVA→INACTIVA e INACTIVA→ACTIVA auditadas con confirmación, impedir inactivar al último ADMIN aun bajo concurrencia, denegación inmediata por guardia e invalidación de sesiones anteriores en `src/modules/usuarios/lifecycle.service.ts`.
- [x] T042 [US3] Bloquear además la creación de sesiones de Better Auth para cuenta PENDIENTE/INACTIVA con hook compatible con versión instalada, sin permitir que ban/unban o JWT reabran acceso; documentar la comprobación de versión en `src/auth/auth.ts`.
- [x] T043 [US3] Exponer POST `/deactivate` y `/reactivate` con `confirm: true` obligatorio, 409 en estado repetido, sin borrado de cuenta ni auditoría, en `src/modules/usuarios/accounts.routes.ts`.
- [x] T044 [US3] Ejecutar T039/T040 y verificar que una sesión revocada nunca vuelve a ser válida tras reactivar en `tests/integration/accounts-lifecycle.test.ts`.

**Checkpoint**: US3 comprobable con cuenta y sesión preparadas como fixture, aunque no se hayan ejecutado manualmente flujos US1/US2.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificación final de seguridad, contratos y documentación de ejecución.

- [x] T045 [P] Verificar en PostgreSQL que el rol de aplicación no puede UPDATE/DELETE de auditoría y que cuentas inactivas, historial de invitaciones, solicitudes y decisiones de ascenso se conservan sin purga, en `tests/integration/audit-integrity.test.ts`.
- [x] T046 [P] Añadir prueba de carga de 30 sesiones y medir p95 contra la referencia de ≤2 s sin declararla aprobada antes de validación institucional en `tests/performance/accounts-load.test.ts`.
- [x] T047 [P] Validar todos los paths (incluidas tres rutas de ascenso) y respuestas de `specs/001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml` mediante `tests/contract/accounts-openapi.test.ts`.
- [x] T048 Registrar comandos npm reales, setup del correo simulado y resultados de las rutas de validación en `specs/001-gestionar-cuentas-roles/quickstart.md`, sin presentar ejemplos aún no ejecutados como éxito.
- [ ] T049 Ejecutar los recorridos de `specs/001-gestionar-cuentas-roles/quickstart.md` y cerrar los criterios SC-001…SC-009 con evidencia en `specs/001-gestionar-cuentas-roles/checklists/requirements.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 antes de instalar o generar esquema; T002–T006
  pueden avanzar en paralelo si no modifican los mismos archivos.
- **Foundational (Phase 2)**: depende de Setup; T007 ya documenta las
  reglas decididas por el usuario. T009/T010/T008 pueden avanzar a la vez; T011→T012→T013→T014/T015;
  T020 verifica base antes de historias. T016/T018 pueden avanzar en paralelo.
- **US1, US2, US3**: cada una depende de Foundation completa; pruebas de contrato
  y de integración se escriben antes del código de su historia. Las historias
  pueden desarrollarse paralelamente con fixtures de cuenta y coordinación en
  archivos compartidos `src/app.ts` y `src/modules/usuarios/accounts.routes.ts`.
- **Polish**: después de completar las historias elegidas para entrega; la
  validación final requiere que las tres estén integradas.

### User Story Dependencies

- **US1 (P1)**: Sin dependencia funcional en otras historias; constituye el
  MVP de crear, invitar, activar y consultar cuentas.
- **US2 (P2)**: Requiere TEACHER activo y otro ADMIN como decisor, preparables
  con fixtures tras Foundation; no depende del recorrido US1 para probarse.
- **US3 (P3)**: Requiere cuenta activa y sesión, preparables con fixture tras
  Foundation; no depende del código de US1/US2 para probarse individualmente.

### Within Each User Story

- Pruebas primero: escribir T021/T022, T030/T031 o T039/T040 y comprobar fallo
  antes de servicios/rutas; comprobar resultados positivos después.
- Migraciones/modelos antes de servicios; servicios antes de endpoints; rutas
  antes de comprobación end-to-end. Cambios en `src/app.ts` y
  `src/modules/usuarios/accounts.routes.ts` se secuencian para evitar choques.
- Un cambio de rol/estado se acepta solo si la auditoría y el estado quedan
  coherentes; un fallo debe conservar acceso previo o denegarlo sin afirmar éxito.

### Parallel Opportunities

- Setup: T002, T003, T004, T005, T006 tocan archivos diferentes.
- Foundation: T008, T009, T010; T016 y T018 no dependen entre sí.
- US1: T021 y T022; luego T023 puede escribirse mientras se prepara T024.
- US2: T030 y T031 pueden redactarse en paralelo; T033 depende de T032.
- US3: T039 y T040; T041 y T042 cambian archivos distintos pero ambos se
  verifican juntos antes de exponer T043.
- Polish: T045, T046 y T047 son comprobaciones en archivos distintos.

### Parallel Example: User Story 1

```text
T021 [P] [US1] → tests/contract/accounts-create-list.test.ts
T022 [P] [US1] → tests/integration/account-invitation.test.ts
```

### Parallel Example: User Story 2

```text
T030 [P] [US2] → tests/contract/accounts-update-role.test.ts
T031 [P] [US2] → tests/integration/account-update-role.test.ts
```

### Parallel Example: User Story 3

```text
T039 [P] [US3] → tests/contract/accounts-lifecycle.test.ts
T040 [P] [US3] → tests/integration/accounts-lifecycle.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Setup T001–T006.
2. Completar Foundation T007–T020 y verificar control de acceso.
3. Implementar US1 T021–T029, empezando por pruebas fallidas.
4. Detenerse y validar alta pendiente, correo duplicado, invitación y
   activación de un único rol con el contrato antes de ampliar alcance.

### Incremental Delivery

1. Foundation → seguridad básica y esquema común.
2. US1 → alta/invitación/consulta (MVP) demostrable.
3. US2 → edición y solicitud/aprobación de ascenso verificables por separado.
4. US3 → inactivar/reactivar con revocación inmediata y conservación histórica.
5. Polish → auditoría, carga, contrato y quickstart ejecutado.

## Notes

- `docs/original/` permanece fuera de Git; citas en `research.md` y
  `spec.md` identifican la fuente y versión. V3 RF-001 aún es propuesta.
- T007 está resuelta con la respuesta del usuario; las credenciales concretas
  del ADMIN inicial y el proveedor de correo son secretos de configuración,
  no valores fijos que deban añadirse a los documentos.
- En tareas de acceso o revocación, verificar conjuntamente rutas propias y
  endpoints de Better Auth; no autorizar mediante JWT firmado por sí solo.
