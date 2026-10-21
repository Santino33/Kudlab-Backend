---

description: "Tareas de refactor de servicios y organización del módulo Usuarios"
---

# Tasks: Refactorizar servicios de usuarios

**Input**: `specs/004-refactor-servicios-usuarios/{spec.md,plan.md,research.md,data-model.md,contracts/current-interfaces.md,quickstart.md}`

**Tests**: Comparar una línea base previa y ejecutar regresión completa **al final**. No duplicar pruebas existentes; agregar casos solo para garantías afectadas sin cobertura.

**Organization**: US1 aclara servicios en las rutas actuales; US2 agrupa archivos y actualiza consumidores. La fase final valida ambas historias.

## Phase 1: Setup (línea base)

**Purpose**: Asegurar un punto de comparación antes de cambiar servicios o rutas internas.

- [X] T001 Verificar Node.js 24, dependencias y `DATABASE_URL` de PostgreSQL aislado; aplicar `npm run db:migrate` según `specs/004-refactor-servicios-usuarios/quickstart.md` y registrar cualquier impedimento en `specs/004-refactor-servicios-usuarios/validation-results.md`.
- [X] T002 Ejecutar `npm run typecheck` y `npm test` antes de editar `src/modules/usuarios/`, y registrar en `specs/004-refactor-servicios-usuarios/validation-results.md` éxitos/fallos previos y ambiente utilizado, sin volcar credenciales.

---

## Phase 2: Foundational (alcance y garantías compartidas)

**Purpose**: Fijar qué se mueve y qué no puede cambiar antes de las historias.

**⚠️ CRITICAL**: Completar antes de empezar US1 o US2.

- [X] T003 Inventariar los 19 archivos y sus importaciones desde `src/app.ts`, `src/auth/`, `src/scripts/bootstrap-admin.ts` y `tests/`; contrastar rutas/errores/permisos con `specs/004-refactor-servicios-usuarios/contracts/current-interfaces.md` y registrar inconsistencias de línea base en `specs/004-refactor-servicios-usuarios/validation-results.md`.

**Checkpoint**: Línea base y consumidores conocidos; ninguna política nueva ni migración.

---

## Phase 3: User Story 1 - Comprender las operaciones de usuarios (Priority: P1) 🎯 MVP

**Goal**: Hacer visible el flujo y los rechazos de los servicios sin cambiar resultados, orden relevante, transacciones, auditoría ni permisos.

**Independent Test**: Una persona nueva identifica comprobaciones y acción principal en cuentas y recuperación; los recorridos existentes válidos e inválidos siguen produciendo las mismas respuestas y efectos (ver `specs/004-refactor-servicios-usuarios/spec.md`, US1).

### Implementation for User Story 1

- [X] T004 [P] [US1] Aclarar la secuencia de validación, cambio y presentación en `src/modules/usuarios/accounts.service.ts`; preservar errores, envío de invitación, transacciones y resultado de cada ruta.
  1. Revisar `present`, `getAccount` y `listAccounts`: separar visualmente la búsqueda, la invitación más reciente y la presentación; conservar campos opcionales, orden, filtros, paginación y total.
  2. En `createAccount`, hacer visible el orden validación → creación pendiente/invitación/auditoría en una transacción → entrega del correo → consulta de la cuenta; no trasladar la entrega a la transacción ni ocultar su fallo.
  3. En `updateAccount`, distinguir el desvío por cambio de correo de la edición de nombre; mantener `lockAccount`, la comprobación de identidad sincronizada y el registro `UPDATE` solo cuando cambia el nombre.
  4. Comparar salidas y errores con `tests/contract/accounts-create-list.test.ts`, `tests/integration/accounts-pagination.test.ts` y `tests/integration/accounts-convergence.test.ts`; extraer código solo si realmente simplifica la lectura.
- [X] T005 [P] [US1] Aclarar las condiciones de estado, último administrador, rol y revocación en `src/modules/usuarios/lifecycle.service.ts` y `src/modules/usuarios/roles.service.ts`; conservar el orden de bloqueo, cambios y auditoría.
  1. En `changeAccountStatus`, separar selección de estados esperados, elegibilidad de la cuenta y excepción de último ADMIN; conservar bloqueo consultivo antes de las consultas, mismo error para cada rechazo y eliminación de sesiones tanto al inactivar como al reactivar.
  2. En `demote`, mostrar por separado existencia, elegibilidad, último ADMIN y sincronización del rol de la identidad; conservar el `LAST_ADMIN` y la actualización condicional de identidad antes de cambiar la cuenta.
  3. Mantener actualizaciones de identidad/cuenta/sesión y `recordAudit` dentro de cada transacción; contrastar `tests/integration/accounts-lifecycle.test.ts` y `tests/integration/account-update-role.test.ts`.
- [X] T006 [P] [US1] Aclarar emisión, entrega y aceptación en `src/modules/usuarios/invitations.service.ts`, sin variar errores, estado de entrega, vigencia, consumo ni vinculación con identidad.
  1. En `issueInvitation` y `deliverInvitation`, separar generación/registro del token de envío y anotación de entrega; preservar la distinción `DELIVERY_FAILED`/`DELIVERY_STATUS_UNKNOWN` y el estado pendiente cuando el resultado del SMTP es incierto.
  2. En `acceptInvitation`, ordenar a la vista búsqueda del token → bloqueo de cuenta e invitación → comprobación de vencimiento/estado/correo/rol → contraseña → identidad existente o nueva → activación, consumo y auditoría.
  3. Conservar el orden actual de llamadas a `db` y `tx`, las comparaciones del token y los errores de conflicto; no asumir que llamadas directas a `db` participan de `tx`. Contrastar `tests/integration/account-invitation.test.ts` y `tests/contract/accounts-create-list.test.ts`.
- [X] T007 [P] [US1] Aclarar solicitud y confirmación en `src/modules/usuarios/email-changes.service.ts`, sin mover efectos fuera de su transacción ni variar reserva del correo, rechazo, entrega, revocación o auditoría.
  1. En `changeEmail`, separar normalización/bloqueo y reserva del correo; distinguir rama PENDIENTE (invalida invitación y emite otra) de ACTIVA (invalida solicitudes previas y registra verificación), manteniendo `CONFLICT` y las acciones de auditoría de cada caso.
  2. Dejar explícito que el correo se envía después de confirmar la transacción y que el fallo de entrega conserva el resultado/estado actuales.
  3. En `confirmEmailChange`, mostrar búsqueda del token → bloqueos/comprobaciones → actualización sincronizada de identidad y cuenta → consumo/revocación/auditoría en la misma transacción; mantener el error y actor de cada registro.
  4. Contrastar casos de correo duplicado, token vencido y sesión antigua con `tests/integration/accounts-convergence.test.ts` y `tests/integration/account-update-role.test.ts`.
- [X] T008 [P] [US1] Aclarar elegibilidad, aprobación y rechazo en `src/modules/usuarios/promotion-requests.service.ts`, preservando bloqueo, autorización del decisor, errores, transición de rol y auditoría.
  1. En `submitRequest` y `listRequests`, hacer visibles la elegibilidad TEACHER activo y la diferencia entre listado ADMIN y listado propio, sin cambiar filtros ni presentación.
  2. En `decideRequest`, separar verificación del decisor → bloqueo/estado de la solicitud → prohibición de autoaprobación → elegibilidad vigente del solicitante → rama de aprobación o rechazo.
  3. Mantener actualización condicional de identidad, rol de cuenta, estado de solicitud y auditoría dentro de la transacción: dos registros al aprobar y uno al rechazar; contrastar `tests/integration/account-update-role.test.ts` y `tests/contract/accounts-update-role.test.ts`.
- [X] T009 [P] [US1] Aclarar solicitud y confirmación en `src/modules/usuarios/recovery.service.ts`, preservando respuesta neutra, token de un solo uso, orden de validaciones, cambio de credencial y revocación.
  1. En `requestRecovery`, separar normalización → elegibilidad de cuenta/identidad → invalidación de verificaciones previas/emisión → correo posterior; mantener resultado neutro para cuenta ausente, pendiente o inactiva y fallo de envío.
  2. En `confirmRecovery`, distinguir búsqueda del token → bloqueo de cuenta/verificación → vigencia y coherencia de identidad → validación de contraseña → unicidad de credencial → actualización y revocación.
  3. Conservar `VERIFICATION_EXPIRED` frente a `INVALID_INPUT`, los bloqueos y la transacción que cambia credencial, elimina sesiones, consume token y audita; contrastar `tests/integration/password-recovery.test.ts` y `tests/contract/password-recovery.test.ts`.

**Checkpoint**: US1 puede revisarse y contrastarse con la línea base sin reorganizar todavía los archivos. Registrar cualquier divergencia observada en `specs/004-refactor-servicios-usuarios/validation-results.md` para la regresión final.

---

## Phase 4: User Story 2 - Encontrar cada responsabilidad del módulo (Priority: P2)

**Goal**: Agrupar los 19 archivos existentes por flujo, sin crear fachadas ni cambiar interfaces observables.

**Independent Test**: Una persona nueva localiza cuentas, invitaciones, cambio de correo y recuperación sin ayuda; `npm run typecheck` y los contratos/rutas existentes siguen funcionando (ver `specs/004-refactor-servicios-usuarios/spec.md`, US2).

### Implementation for User Story 2

- [X] T010 [US2] Mover `src/modules/usuarios/{account-lock.ts,accounts.errors.ts,accounts.types.ts,accounts.validation.ts,audit.service.ts,scope-authorization.ts}` a `src/modules/usuarios/shared/`; corregir consumidores en `src/modules/usuarios/`, `src/auth/{active-identity.ts,session-activity.ts,credential-identity.ts,session-guard.ts}`, `src/scripts/bootstrap-admin.ts` y `tests/unit/{identity-policy.test.ts,scope-authorization.test.ts}`, y comprobar `npm run typecheck`.
  1. Trasladar sin reescribir validaciones, errores ni bloqueos; ajustar rutas relativas a `src/db/` y referencias entre archivos compartidos.
  2. Actualizar importaciones de todos los servicios/rutas del módulo y de los consumidores indicados; comprobar que `src/app.ts` sigue usando el mismo manejador de errores y que `npm run typecheck` pasa antes de T011.
- [X] T011 [US2] Mover `accounts.routes.ts`, `accounts.service.ts`, `lifecycle.service.ts` y `roles.service.ts` a `src/modules/usuarios/accounts/`; corregir imports en `src/app.ts`, los demás flujos de `src/modules/usuarios/` y `tests/integration/accounts-pagination.test.ts`, y comprobar `npm run typecheck`.
  1. Trasladar los cuatro archivos y actualizar sus referencias a `shared/`, `src/db/`, autenticación e invitaciones/cambio de correo, manteniendo las mismas exportaciones.
  2. Corregir `src/app.ts`, importaciones de otros servicios y `tests/integration/accounts-pagination.test.ts`; verificar con `npm run typecheck` que rutas, `present` y servicios siguen enlazados.
- [X] T012 [US2] Mover `src/modules/usuarios/{invitations.routes.ts,invitations.service.ts,invitations.mailer.ts}` a `src/modules/usuarios/invitations/`; actualizar imports en `src/app.ts`, `src/modules/usuarios/`, `tests/helpers.ts` y los `*.test.ts` de `tests/contract/` y `tests/integration/` que importan `invitations.mailer.js` o `invitations.service.js`, y comprobar `npm run typecheck`.
  1. Trasladar ruta, servicio y correo; actualizar dentro del servicio referencias a `shared/`, `src/auth/`, `src/db/` y configuración sin cambiar emisión/entrega.
  2. Corregir `src/app.ts`, cuentas, cambio de correo, recuperación, `tests/helpers.ts` y pruebas importadoras; confirmar `npm run typecheck` antes del siguiente grupo.
- [X] T013 [US2] Mover `email-changes.routes.ts` y `email-changes.service.ts` a `src/modules/usuarios/email-changes/`; actualizar imports en `src/app.ts` y `src/modules/usuarios/`, y comprobar `npm run typecheck`.
  1. Ajustar rutas relativas del servicio hacia `shared/`, `invitations/`, `src/auth/` y `src/db/`; conservar su importación por `accounts.service.ts` y por su ruta.
  2. Actualizar `src/app.ts` y comprobar `npm run typecheck` sin cambiar el montaje de confirmación.
- [X] T014 [US2] Mover `promotion-requests.routes.ts` y `promotion-requests.service.ts` a `src/modules/usuarios/promotion-requests/`; actualizar imports en `src/app.ts` y `src/modules/usuarios/`, y comprobar `npm run typecheck`.
  1. Ajustar referencias del servicio/ruta a `shared/` y `src/db/`, conservando exportaciones y decisiones approve/reject.
  2. Actualizar `src/app.ts` y comprobar `npm run typecheck` antes de mover recuperación.
- [X] T015 [US2] Mover `recovery.routes.ts` y `recovery.service.ts` a `src/modules/usuarios/recovery/`; actualizar imports en `src/app.ts` y `src/modules/usuarios/`, y comprobar `npm run typecheck`.
  1. Ajustar referencias a `shared/`, `invitations/`, `src/auth/`, `src/config/` y `src/db/` en ambos archivos, conservando respuesta neutra y exportaciones.
  2. Actualizar `src/app.ts` y comprobar `npm run typecheck`; dejar la ejecución de la suite completa para la fase final.
- [X] T016 [US2] Buscar imports antiguos hacia `src/modules/usuarios/` en `src/app.ts`, `src/auth/{active-identity.ts,session-activity.ts,credential-identity.ts,session-guard.ts}`, `src/scripts/bootstrap-admin.ts` y `tests/**/*.ts`; cotejar montaje y guardias con `specs/004-refactor-servicios-usuarios/contracts/current-interfaces.md` sin cambiar rutas ni errores.

**Checkpoint**: US2 deja cada archivo en su responsabilidad y actualiza todos los consumidores. La comprobación completa de comportamiento se realiza en la fase final.

---

## Phase 5: Pruebas de regresión y cierre (final)

**Purpose**: Verificar ambas historias, incluidos errores y controles de acceso, después de todos los cambios.

- [X] T017 Revisar cobertura de `tests/unit/scope-authorization.test.ts`, `tests/contract/*.test.ts`, `tests/integration/*.test.ts` y `tests/performance/accounts-load.test.ts` para rutas, roles/ámbito, fallo cerrado, expiración, auditoría, entregas, revocación y concurrencia contra `specs/004-refactor-servicios-usuarios/contracts/current-interfaces.md`; si una garantía afectada carece de caso, agregar solo el escenario faltante al archivo de prueba pertinente antes de la ejecución final.
- [X] T018 Ejecutar `npm run typecheck` y `npm test` completos con PostgreSQL aislado y migrado según `specs/004-refactor-servicios-usuarios/quickstart.md`; comparar contra T002 incluidos `tests/performance/`, corregir diferencias y repetir ambos comandos si hubo correcciones; anotar salida y límites en `specs/004-refactor-servicios-usuarios/validation-results.md`.
- [ ] T019 Solicitar a una persona ajena al refactor la evaluación de los cuatro recorridos de lectura (<5 min cada uno) y localización (≥90 % en <2 min), registrar mediciones o indisponibilidad en `specs/004-refactor-servicios-usuarios/validation-results.md` y revisar FR-001…FR-007 y SC-001…SC-004 de `specs/004-refactor-servicios-usuarios/spec.md` frente a los resultados.

---

## Dependencies & Execution Order

- Setup T001 → T002 → Foundational T003 → US1 T004–T009 → US2 T010–T016 → regresión T017 → T018 → T019.
- **US1** depende solo de la línea base e inventario; US2 se valida independientemente con archivos agrupados e imports resueltos, pero en este refactor se ejecuta después de US1 para separar cambios de lógica de movimientos.
- **US2**: T010–T015 van en orden porque los servicios se importan entre flujos; cada traslado incluye sus consumidores y comprobación de tipos antes del siguiente. T016 confirma que no quedan rutas antiguas.
- **Regresión**: solo se declara completa si T018 compara sin diferencias no justificadas con T002 y se registra cualquier impedimento de T019.

### Parallel Opportunities

- Tras T003, T004–T009 pueden trabajarse en paralelo: editan servicios distintos y no mueven archivos ni cambian interfaces; integrar/revisar antes de iniciar T010.
- T010–T016 son secuenciales por las importaciones cruzadas. T017–T019 no son paralelas: la suite final debe incorporar los casos faltantes y la revisión ocurre sobre el resultado integrado.

### Parallel Example: User Story 1

```text
T004: Aclarar src/modules/usuarios/accounts.service.ts
T008: Aclarar src/modules/usuarios/promotion-requests.service.ts
T009: Aclarar src/modules/usuarios/recovery.service.ts
```

### Parallel Example: User Story 2

```text
Sin tareas [P]: primero shared/ (T010), luego cada grupo y sus consumidores (T011–T015).
T016 verifica las importaciones y rutas tras los movimientos.
```

## Implementation Strategy

1. **MVP**: T001–T009 hacen legibles los servicios sin cambiar la organización; contrastar US1 con la línea base antes de mover archivos.
2. **Incremento organizativo**: T010–T016 agrupan los archivos y corrigen consumidores grupo a grupo, con typecheck entre grupos; no agregar modelos, dependencias o rutas de compatibilidad.
3. **Cierre obligatorio**: T017–T019 ejecutan la regresión completa *después* del refactor y documentan resultados. No marcar la iteración terminada con pruebas bloqueadas o regresiones sin resolver.
