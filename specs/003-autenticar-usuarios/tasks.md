---

description: "Tareas de implementación de autenticación del personal"
---

# Tasks: Autenticar usuarios

**Input**: Documentos de `specs/003-autenticar-usuarios/`: [plan](plan.md), [spec](spec.md), [investigación](research.md), [modelo](data-model.md), [contrato](contracts/auth.openapi.yaml) y [validación](quickstart.md).

**Prerequisites**: Backend existente Node.js 24/TypeScript, Hono, Better Auth 1.7.7, Drizzle/PostgreSQL. La invitación y administración de cuentas de `specs/001-gestionar-cuentas-roles/` son preexistentes. RF-003 V3 mantiene su estado de propuesta original; el responsable confirmó el 2026-10-13 las reglas de inactividad y recuperación de esta iteración (T014/T022).

**Tests**: Incluidos porque la constitución §V exige pruebas pertinentes de sesiones/autorización y el plan requiere verificar fallos, carreras y los escenarios SC-001–006. En cada historia crear y observar fallar las pruebas nuevas antes de modificar su comportamiento.

**Organization**: Cada fase de historia permite validar su propio recorrido. `[P]` indica archivos distintos sin dependencia de tareas incompletas; no indica que deban ejecutarse subagentes.

## Phase 1: Setup (infraestructura compartida ya presente)

**Purpose**: Preparar el trabajo sobre el backend existente, sin recrear la aplicación ni instalar un framework nuevo.

- [X] T001 Verificar Node >=24 <25, dependencias de `package.json`, migraciones y pruebas base con `npm ci`, `npm run db:migrate`, `npm run typecheck` y `npm test`; anotar resultado y prerrequisitos reproducibles en `specs/003-autenticar-usuarios/quickstart.md` usando solo base de pruebas.
- [X] T002 Añadir utilidades de pruebas para iniciar dos sesiones independientes, conservar credenciales cookie/Bearer y solicitar rutas protegidas en `tests/helpers.ts`, sin alterar el bootstrap ni los datos de pruebas ajenas.

**Checkpoint**: Base reproducible y fixtures de sesión independientes disponibles.

---

## Phase 2: Foundational (bloquea las tres historias)

**Purpose**: Centralizar la verificación autoritativa de identidad que comparten ingreso, validación de sesión y recuperación.

- [X] T003 Crear un resolvedor de identidad en `src/auth/active-identity.ts` que consulte `user_accounts.auth_user_id` único y `user.id`, exija `status='ACTIVA'`, `banned=false`, correo vigente de `user_accounts.email_normalized` igual al correo confirmado `user.email` y correspondencia de un solo rol `ADMIN/admin` o `TEACHER/teacher`; ante falta/discordancia/error denegar sin devolver datos de terceros.
- [X] T004 Integrar el resolvedor autoritativo en el control de creación de sesión `databaseHooks.session.create.before` de `src/auth/auth.ts`, conservando `disableSignUp: true`, contraseña mínima 8/máxima 128, y los plugins existentes; impedir que accesos directos al handler creen sesión para una identidad no activa.

**Checkpoint**: La identidad solo se considera utilizable si ambos registros concuerdan; las rutas públicas aún se completan en US1.

---

## Phase 3: User Story 1 - Iniciar sesión como personal autorizado (Priority: P1) 🎯 MVP

**Goal**: Permitir el ingreso de personal ADMIN/TEACHER activo y ofrecer su identidad/rol actual sin filtrar existencia de cuentas o datos de estudiantes.

**Independent Test**: Activar un docente por invitación, iniciar como docente y administrador, obtener identidad propia y acceder solo a una función autorizada; repetir con correo desconocido, contraseña incorrecta, cuenta PENDIENTE/INACTIVA, roles desincronizados y servicio no verificable: ningún caso inválido crea acceso.

### Tests for User Story 1

- [X] T005 [P] [US1] Crear pruebas de contrato para `POST /api/auth/sign-in/email` y `GET /api/auth/get-session` (JSON mínimo `user.id/email/name/role`, cookie o `set-auth-token` opaco, `401` uniforme y `503` sin secretos) en `tests/contract/authentication.test.ts`; comparar respuestas de inexistente, contraseña errónea, PENDIENTE e INACTIVA.
- [X] T006 [P] [US1] Crear pruebas de integración PostgreSQL/Better Auth de invitación→ACTIVA→login, rol `ADMIN/TEACHER`, identidad desincronizada, cuenta sin rol, error de BD, acceso directo con JWT sin sesión opaca y ausencia de datos ajenos en `tests/integration/authentication.test.ts`; comprobar inicialmente que los escenarios nuevos fallan.

### Implementation for User Story 1

- [X] T007 [US1] Proteger `POST /api/auth/sign-in/email` en `src/app.ts` con respuesta pública idéntica para correo desconocido, credencial errónea, PENDIENTE/INACTIVA y rol discordante (sin crear sesión); preservar cookie HttpOnly/`set-auth-token` tras login válido y devolver `503` genérico si no puede verificarse identidad.
- [X] T008 [US1] Adaptar `GET /api/auth/get-session` en `src/app.ts` para comprobar sesión persistida e identidad vigente antes de devolver solo `id`, `email`, `name`, rol de negocio `ADMIN|TEACHER` e identificador/vencimiento de sesión; ausente/inactiva→`401` y fallo de verificación→`503`, sin renovar actividad protegida.
- [X] T009 [US1] Reutilizar `src/auth/active-identity.ts` en `src/auth/session-guard.ts` para verificar sesión, cuenta, rol y correo vigentes en cada solicitud de `/api/v1/*`; conservar `authorizeProtectedScope` y su delegación al ámbito Académico; sin sesión→`401`, identidad discordante→`403`, fallo de BD→denegación sin datos.
- [X] T010 [US1] Comprobar contra `specs/003-autenticar-usuarios/contracts/auth.openapi.yaml` y ejecutar T005–T006 junto a `tests/integration/auth-boundaries.test.ts`, manteniendo bloqueados `/api/auth/sign-up/email`, `/api/auth/admin/*` y cualquier ruta no permitida en `src/app.ts`.

**Checkpoint**: US1 operativa y verificable sin depender del control nuevo de 30 minutos ni de recuperación. FR-001–004, FR-008 y fallos de FR-012; SC-001/004.

---

## Phase 4: User Story 2 - Mantener y finalizar un acceso seguro (Priority: P2)

**Goal**: Contar 30 minutos exactos desde la última solicitud protegida aceptada por sesión, cerrar solo la sesión presentada y revocar todos los accesos al inactivar sin restaurarlos al reactivar.

**Independent Test**: Dos sesiones para la misma cuenta: solicitud protegida a 29:59 aceptada; a 30:00 denegada sin revivir tras `get-session`, denegaciones o renovación interna; cerrar una sesión conserva la otra, inactivar revoca ambas y reactivar requiere login nuevo.

### Tests for User Story 2

- [X] T011 [P] [US2] Crear pruebas unitarias con reloj controlado del límite `now < lastAcceptedAt + 30 min`, exactamente 30:00, ausencia de marca inicial, y actualización monotónica solo tras respuesta protegida aceptada en `tests/unit/session-activity.test.ts`; comprobar fallo previo a la implementación.
- [X] T012 [P] [US2] Ampliar `tests/contract/authentication.test.ts` para `POST /api/auth/sign-out` y `GET /api/auth/get-session` vencido/cerrado (`200`/`401`/`503` según contrato, sin datos) y comprobar que ambos métodos no prolongan inactividad; ejecutar y observar fallo antes de corregir código.
- [X] T013 [US2] Ampliar `tests/integration/authentication.test.ts` con dos sesiones, actividad independiente, solicitud denegada o `get-session` antes del límite, JWT sin sesión, cambio de rol, cierre individual, inactivación/reactivación y concurrencia cierre/solicitud; controlar la hora sin esperar 30 minutos reales y verificar que una petición vencida no actualiza estado.

### Implementation for User Story 2

- [X] T014 [US2] Confirmar con el responsable la semántica de actividad de `specs/003-autenticar-usuarios/spec.md` antes de implementar el plazo (si cambia, actualizar spec/plan/contrato); después definir `session_activity` en `src/db/schema/authentication.ts` con `session_id` texto PK/FK `session.id` `ON DELETE CASCADE` y `last_accepted_at` `timestamptz NOT NULL`, registrar el esquema en `src/db/client.ts` y crear migración en `src/db/migrations/0006_authentication.sql` (sin editar el esquema generado de Better Auth).
- [X] T015 [US2] Incorporar `session_activity` al truncado de pruebas (o usar `CASCADE` confirmado tras la migración), sin borrar datos fuera de la base aislada, en `tests/helpers.ts`.
- [X] T016 [US2] Implementar acceso serializado y actualización condicional por `session_id` en `src/auth/session-activity.ts`: si falta fila usar `session.created_at`, rechazar `now >= referencia + 30 min`, insertar/actualizar con instante monotónico solo después de respuesta protegida aceptada, comprobar que la sesión persiste y no admitir resurrección por `getSession`/JWT.
- [X] T017 [US2] Integrar comprobación previa y marca posterior de éxito en `src/auth/session-guard.ts`, distinguiendo denegaciones `401/403`, excepciones y respuestas protegidas no aceptadas; conservar la comprobación de estado/rol actual y fallar cerrado si no se puede consultar/escribir actividad.
- [X] T018 [US2] Adaptar `GET /api/auth/get-session` y `POST /api/auth/sign-out` en `src/app.ts` para aplicar expiración propia a consulta, invalidar solo la sesión actual (cookie o Bearer) y descartar su marca por cascada; preservar `/api/auth/token`/`jwks` solo como compatibilidad, no como acceso a negocio.
- [X] T019 [US2] Confirmar en `src/modules/usuarios/lifecycle.service.ts` que inactivar elimina todas las `session` y sus marcas `session_activity` en la transacción existente, y que reactivar no las recrea; correr T011–T013 y pruebas de cuentas ya existentes.

**Checkpoint**: US2 funciona usando la identidad ya disponible, sin recuperación. FR-005–008/012; SC-002/003/004.

---

## Phase 5: User Story 3 - Recuperar acceso a una cuenta activa (Priority: P3)

**Goal**: Ofrecer recuperación neutra por correo vigente, verificación de un solo uso y cambio transaccional de contraseña con revocación de todas las sesiones.

**Independent Test**: Solicitar enlace como titular ACTIVO, verificar correo recibido, cambiar a contraseña válida y entrar de nuevo; contraseña anterior y sesiones anteriores no sirven. Probar inexistente, PENDIENTE/INACTIVA, enlace vencido/usado, cambio de correo, contraseña inválida y dos canjes simultáneos sin efectos parciales.

### Tests for User Story 3

- [X] T020 [P] [US3] Crear pruebas de contrato para `POST /api/v1/auth/password-recovery/request` (`202` neutro con mismo cuerpo para cuenta activa/inexistente/pendiente/inactiva) y `/confirm` (`200`, `400`, `410`, `503` sin secreto ni detalle de cuenta) en `tests/contract/password-recovery.test.ts`; comprobar que fallan antes de implementar.
- [X] T021 [P] [US3] Crear pruebas de integración en `tests/integration/password-recovery.test.ts` para entrega al correo vigente, token aleatorio de un uso, frontera 29:59/30:00, contraseña 8–128 con mayúscula/minúscula/dígito, repetición, doble canje concurrente, cambio de correo/estado y fallo de transacción tras revocación sin cambio parcial; observar fallo inicial.

### Implementation for User Story 3

- [X] T022 [US3] Obtener confirmación del responsable sobre recuperación por correo vigente y plazo de 30 minutos propuestos; registrar decisión, fuente y estado en `specs/003-autenticar-usuarios/spec.md` y ajustar `specs/003-autenticar-usuarios/contracts/auth.openapi.yaml`/`data-model.md` si difieren, antes de implementar T023–T027.
- [X] T023 [P] [US3] Añadir `password_recovery_verifications` a `src/db/schema/authentication.ts` y migración `src/db/migrations/0007_password_recovery.sql`: `id UUID PK`, `account_id UUID NOT NULL FK user_accounts.id`, `email_normalized TEXT NOT NULL`, `token_digest TEXT NOT NULL UNIQUE`, `created_at`/`expires_at` `timestamptz NOT NULL` con diferencia de 30 min, `consumed_at`/`invalidated_at timestamptz NULL`, índice `(account_id, created_at)`; no almacenar token claro.
- [X] T024 [P] [US3] Añadir `RESET_BASE_URL` validada hacia el origen SPA aprobado en `src/config/env.ts` y ejemplo sin secreto en `.env.example`; compartir SMTP de `src/modules/usuarios/invitations.mailer.ts` con un mensaje de recuperación distinto y modo captura solo en `NODE_ENV=test`.
- [X] T025 [US3] Implementar emisión en `src/modules/usuarios/recovery.service.ts`: solo `user_accounts.status='ACTIVA'` con `auth_user_id` y correo confirmado/rol concordantes, generar token aleatorio, persistir digest y vencimiento de 30 min, invalidar verificaciones anteriores, enviar únicamente al correo vigente; siempre responder neutralmente si no existe/no está activa y no filtrar existencia por fallo de entrega.
- [X] T026 [US3] Implementar canje en `src/modules/usuarios/recovery.service.ts`: bloquear cuenta y verificación en orden estable, exigir vigencia estricta/uso único/correo igual al confirmado y rol activo; validar contraseña con `src/modules/usuarios/accounts.validation.ts`, hashearla con `src/auth/credential-identity.ts`, actualizar solo `account.providerId='credential'` del titular, eliminar **todas** sus `session`, consumir token y registrar evento sin secretos en una transacción; error/reintento preserva hash y token válidos sin cambios parciales.
- [X] T027 [US3] Exponer solo `/request` y `/confirm` públicos en `src/modules/usuarios/recovery.routes.ts` y montarlos en `src/app.ts`; no exponer `/api/auth/request-password-reset` ni `/api/auth/reset-password`, mantener respuesta neutra `202` para solicitud y no crear sesión tras canje.
- [X] T028 [US3] Añadir truncado aislado de `password_recovery_verifications` y limpieza del correo capturado a `tests/helpers.ts`; correr T020–T021 y revalidar que cambios de correo e inactivación de cuentas en pruebas existentes no reabren una verificación anterior.

**Checkpoint**: US3 ofrece recuperación completa sin restaurar sesiones. FR-009–012; SC-006 y revocación de SC-003.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Confirmar integración transversal sin añadir flujos ajenos al módulo.

- [X] T029 Revisar cumplimiento de las cinco operaciones y errores de `specs/003-autenticar-usuarios/contracts/auth.openapi.yaml` con pruebas contractuales `tests/contract/authentication.test.ts` y `tests/contract/password-recovery.test.ts`, incluidos cookie/Bearer opaco y ninguna filtración de contraseña, token o datos escolares.
- [X] T030 Ejecutar `npm run typecheck`, `npm test` y recorridos de `specs/003-autenticar-usuarios/quickstart.md` sobre base aislada; registrar SC-001–004 y SC-006, casos de DB/SMTP indisponible y eventuales divergencias en `specs/003-autenticar-usuarios/quickstart.md`.
- [ ] T031 Realizar medición manual de SC-005 con al menos cinco miembros adultos y, separadamente, medir referencias no aprobadas p95/30 concurrentes; documentar resultados y su estado en `specs/003-autenticar-usuarios/quickstart.md`, sin inferir aprobación institucional de cifras de A/D.

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → US1 (MVP). Reutilizar el backend y cuentas existentes; no recrear proyectos.
- US2 depende del resolvedor fundacional y del ingreso de US1 para su prueba de extremo a extremo; las pruebas de tiempo y modelo de actividad se pueden preparar en paralelo con US1 tras Phase 2.
- US3 comparte resolvedor e identidad, pero el servicio de recuperación se puede desarrollar independientemente de la lógica nueva de inactividad; sus pruebas de revocación se ejecutan contra sesiones de US1. T022 bloquea **solo la implementación de recuperación** T023–T027 hasta resolver la propuesta funcional.
- Phase 6 se aplica a las historias efectivamente completadas; antes de declarar completa toda la feature deben pasar US1–US3 y la revisión constitucional.

### User Story Dependencies

- **US1 (P1)**: Phase 2 → T005–T010. Independiente de US2/US3; ofrece MVP funcional.
- **US2 (P2)**: Phase 2 + sesión utilizable de US1 → T011–T019. No depende de recuperación.
- **US3 (P3)**: Phase 2 + cuentas existentes → T020–T022; T022 antes de T023–T028. No depende del cálculo de actividad de US2; verifica revocación de sesiones persistidas.

### Within Each User Story

Escribir y comprobar fallo de pruebas nuevas primero; luego esquema/migración si aplica, servicio, endpoint y prueba de integración. Evitar editar a la vez `src/app.ts`, `src/auth/session-guard.ts`, `src/db/schema/authentication.ts` o `tests/helpers.ts` desde dos historias distintas. Las modificaciones a archivos compartidos se integran en orden de prioridad.

### Parallel Opportunities

- T001 precede T002: no editar `tests/helpers.ts` mientras corre la suite base.
- T005/T006, T011/T012 y T020/T021 pueden prepararse en paralelo **entre archivos distintos** tras el fundamento; las historias no comparten archivos de esas parejas.
- En US3, T023 (`src/db/schema/authentication.ts`, migración) puede avanzar en paralelo con T024 (`src/config/env.ts`, `.env.example`, `invitations.mailer.ts`) después de la decisión humana T022.
- T029 precede a T030 porque esta ejecuta los contratos; T031 sucede a T030 porque ambos registran resultados en `quickstart.md`.

## Parallel Example: User Story 1

```text
T005  tests/contract/authentication.test.ts           contrato ingreso/consulta
T006  tests/integration/authentication.test.ts        cuenta activa/denegaciones
```

## Parallel Example: User Story 2

```text
T011  tests/unit/session-activity.test.ts             borde 30 min
T012  tests/contract/authentication.test.ts           cierre/consulta vencida
```

## Parallel Example: User Story 3

```text
T020  tests/contract/password-recovery.test.ts       respuesta neutra/canje
T021  tests/integration/password-recovery.test.ts    correo/carreras/atomicidad
T023  src/db/schema/authentication.ts                 modelo (si T014 terminado)
T024  src/config/env.ts                              configuración de correo
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. T001–T004 establecen base y verificación única de identidad.
2. T005–T010 habilitan ingreso/consulta seguros; ejecutar el test independiente de US1 y validar SC-001/004.
3. Se puede demostrar ingreso ADMIN/TEACHER sin esperar la recuperación, dejando explícito que la regla de inactividad exacta forma parte de US2 y debe completarse antes de declarar toda la feature terminada.

### Incremental Delivery

1. US1 → acceso y mensajes uniformes verificados.
2. US2 → expiración exacta, cierre y revocación desde primera solicitud posterior.
3. US3 → recuperación tras confirmar canal y plazo; canje transaccional y sesiones anteriores inválidas.
4. Phase 6 → contrato, suite, quickstart y medición institucional diferenciada.

## Notes

- Marcar `[x]` solo al completar/verificar la tarea en implementación; este artefacto documenta trabajo pendiente.
- Referencias de calidad p95/30 concurrentes son mediciones propuestas, no condiciones institucionales aprobadas.
- US2 no convierte un `get-session` ni una petición denegada en actividad. US3 no confunde enlace de invitación de cuenta PENDIENTE con recuperación de cuenta ACTIVA.
