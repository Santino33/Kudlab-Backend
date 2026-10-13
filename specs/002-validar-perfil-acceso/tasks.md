---
description: "Tareas de implementación para validar perfil y acceso"
---

# Tasks: Validar perfil y acceso

**Input**: `specs/002-validar-perfil-acceso/{spec,plan,research,data-model,quickstart}.md` y `contracts/`.

**Prerequisites**: Implementación de `specs/001-gestionar-cuentas-roles/` disponible en esta rama; Node.js 24, PostgreSQL de pruebas y variables de `.env.example`. Las reglas concretas de correo/contraseña son decisiones de 001; V3 RF-002/RF-004 siguen propuestos.

**Tests**: La especificación incluye recorridos independientes y SC-001…SC-004 con casos comprobables; constitución II/V exige pruebas de autorización y contrato. Las tareas de prueba preceden a las de código y deben detectar una regresión real, no repetir un validador. SC-005 requiere personas y SPA y no puede cerrarse con una suite automatizada.

**Organization**: Cada historia es un incremento verificable; US3 conserva una dependencia externa explícita con Académico para el recorrido de estudiantes. No crear cuentas, esquemas ni rutas de estudiantes alternativos a 001.

**Estado de US3**: **PENDIENTE / BLOQUEADA**. T026 y T027 son tareas de integración y verificación de US3, no funcionalidades independientes que puedan completarse al margen de ella. No existe todavía un proveedor autoritativo de asignaciones ni un consumidor real de estudiantes/grupos de Académico o Seguimiento. Permanecen pendientes hasta que ambos existan y pasen las pruebas de dos docentes y ámbitos distintos. T021–T025 pueden prepararse, pero ni siquiera su finalización acredita US3 o SC-003 como completadas.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo tras sus dependencias; distinto archivo y sin modificar el mismo punto compartido.
- **[US1] / [US2] / [US3]**: Historia correspondiente en `spec.md`.
- Todas las rutas son relativas a la raíz del repositorio.

## Phase 1: Setup (infraestructura existente)

**Purpose**: Preparar la línea base de 001 sin volver a instalar ni rediseñar servicios.

- [X] T001 Ejecutar `npm run typecheck` y `npm test` con el entorno PostgreSQL de `specs/002-validar-perfil-acceso/quickstart.md`; anotar comandos, resultados y fallos preexistentes en `specs/002-validar-perfil-acceso/quickstart.md` antes de cambiar `src/`.
- [X] T002 [P] Comparar campos de `src/db/schema/accounts.ts`, validadores de `src/modules/usuarios/accounts.validation.ts` y errores de `specs/001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml` con `specs/002-validar-perfil-acceso/contracts/validation.openapi.yaml`; registrar únicamente divergencias comprobadas y consumidores afectados en `specs/002-validar-perfil-acceso/research.md`, sin migración nueva si los índices existentes ya garantizan unicidad.

---

## Phase 2: Foundational (prerrequisitos compartidos)

**Purpose**: Mantener la identidad vigente y una única política de perfil/credenciales antes de ampliar los recorridos.

**⚠️ CRITICAL**: Completar esta fase antes de US1–US3.

- [X] T003 Consolidar reglas reutilizables en `src/modules/usuarios/accounts.validation.ts`: `name` no vacío tras `trim`, `email` válido con dominio terminado exactamente en `.edu.co` y normalizado sin distinción de mayúsculas, `role` de alta ordinaria exactamente `TEACHER`, contraseña con mínimo 8 caracteres y al menos una mayúscula, una minúscula y un número; cotejar el límite actual de 128 caracteres con `src/auth/auth.ts` sin reducir el requisito funcional.
- [X] T004 Comprobar en `src/auth/session-guard.ts` y `src/app.ts` que cada ruta de cuentas ejecuta sesión persistida, cuenta `ACTIVA`, rol actual coincidente con Better Auth y `ADMIN` antes de leer el cuerpo, consultar cuentas o emitir errores de validación; conservar denegación para `PENDIENTE`, `INACTIVA`, rol discordante y JWT aislado, sin habilitar rutas públicas/admin de Better Auth.
- [X] T005 Definir en `src/modules/usuarios/accounts.errors.ts` un mapeo seguro de error reutilizable: estructura `{code,message}` de 001 con `fields: [{field,reason}]` opcional solo para validación de perfil del ADMIN o política de contraseña del titular con invitación comprobada; nunca incluir valores, contraseñas, tokens, correo de terceros ni existencia de estudiantes, y mantener 401/403 genéricos.

**Checkpoint**: Base compartida alineada con los contratos; ninguna ruta adicional de estudiantes o recuperación de credenciales se ha abierto.

---

## Phase 3: User Story 1 - Registrar un perfil válido (Priority: P1) 🎯 MVP

**Goal**: ADMIN registra solo perfil TEACHER completo, institucional y único como PENDIENTE; errores útiles solo para actor autorizado y contraseña inválida sin activar cuenta.

**Independent Test**: Alta válida, ausencia por separado de `name/email/role`, nombre solo espacios, correos mal formados u ocupados en cualquier estado y contraseñas inválidas al aceptar invitación; ningún rechazo crea otra cuenta ni consume invitación.

### Tests for User Story 1

- [X] T006 [P] [US1] Añadir pruebas HTTP de 201 PENDIENTE y 400 con campo `name`, `email` o `role` faltante/incorrecto y sin secretos en `tests/contract/accounts-create-list.test.ts`, cotejando `specs/002-validar-perfil-acceso/contracts/validation.openapi.yaml` y el contrato de 001; confirmar fallo de los casos nuevos antes de corregir código.
- [X] T007 [P] [US1] Ampliar `tests/integration/account-invitation.test.ts` para probar invitación válida, contraseña de menos de 8 caracteres o sin mayúscula/minúscula/número, rechazo sin consumir invitación y respuesta que no revela validez de token ajeno; confirmar fallo previo donde corresponda.
- [X] T008 [P] [US1] Ampliar `tests/integration/accounts-convergence.test.ts` con correos iguales salvo mayúsculas/minúsculas, cuentas PENDIENTE/ACTIVA/INACTIVA, correos reservados y 10 pares de altas simultáneas (SC-004); exigir un solo propietario efectivo y ausencia de cambios parciales para el perdedor.

### Implementation for User Story 1

- [X] T009 [US1] Aplicar `createAccountSchema` de `src/modules/usuarios/accounts.validation.ts` a `src/modules/usuarios/accounts.service.ts`: exigir `name` no vacío después de `trim`, `email` institucional y único tras normalizar, `role=TEACHER`; conservar estado PENDIENTE, invitación y auditoría de 001 sin duplicar flujos.
- [X] T010 [US1] Ajustar `src/modules/usuarios/accounts.service.ts` para convertir conflictos de correo vigente o reservado (incluida concurrencia y cuenta INACTIVA) en 409 con mensaje genérico para ADMIN, sin devolver la dirección ni permitir dos cuentas con el mismo correo; mantener la transacción alta/invitación/auditoría existente.
- [X] T011 [US1] Conectar detalle de campos autorizado a `POST /api/v1/accounts` en `src/modules/usuarios/accounts.routes.ts` y `src/modules/usuarios/accounts.errors.ts` sin cambiar el 401/403 del guardia, sin añadir valores rechazados y respetando `{code,message}` más `fields` opcional.
- [X] T012 [US1] En `src/modules/usuarios/invitations.service.ts`, aplicar la misma política de contraseña de `accounts.validation.ts` antes de activar o consumir invitación; comprobar titularidad/vigencia de token antes de emitir detalles sobre `password`, mantener 410 genérico para token no válido y el estado PENDIENTE ante fallo.
- [X] T013 [US1] Verificar el contrato de alta y aceptación en `tests/contract/accounts-openapi.test.ts` frente a `specs/002-validar-perfil-acceso/contracts/validation.openapi.yaml`, incluyendo campos opcionales, 409 sin correo ajeno, token de un solo uso y sin cambio incompatible en 001.

**Checkpoint**: P1 es demostrable con el backend de cuentas; SC-001 (alta/contraseña) y SC-004 se evalúan sin esperar a Académico.

---

## Phase 4: User Story 2 - Corregir un perfil sin alterar otros datos (Priority: P2)

**Goal**: Editar nombre y solicitar cambio de correo sin duplicados ni guardado parcial; preservar la verificación del titular de 001.

**Independent Test**: PATCH solo nombre, solo correo y ambos; en PENDIENTE se reemplaza invitación y en ACTIVA se conserva correo vigente hasta confirmar el nuevo; un correo duplicado o un nombre inválido revierte ambos cambios.

### Tests for User Story 2

- [X] T014 [P] [US2] Añadir a `tests/contract/accounts-update-role.test.ts` casos de PATCH con `name` válido, nombre solo espacios, correo sin `.edu.co`, campos desconocidos y `fields` permitido solo al ADMIN; comprobar rol/estado inalterados y respuestas acordes con `specs/002-validar-perfil-acceso/contracts/validation.openapi.yaml`.
- [X] T015 [P] [US2] Añadir a `tests/integration/account-update-role.test.ts` edición compuesta `name+email` inválida/duplicada y rollback: comprobar que nombre, correo vigente, reserva, invitación y auditoría quedan como antes; para ACTIVA confirmar que solo tras verificación del titular cambia el correo y no reviven sesiones previas.
- [X] T016 [P] [US2] Extender `tests/integration/accounts-convergence.test.ts` con 10 pares de ediciones concurrentes sobre un mismo correo y combinación alta/reserva, incluyendo nombre del perdedor y cuenta inactiva; comprobar exactamente un ganador y cero efectos parciales.

### Implementation for User Story 2

- [X] T017 [US2] Validar juntos `name` y `email` al principio de `updateAccount()` en `src/modules/usuarios/accounts.service.ts` mediante `updateAccountSchema` de `src/modules/usuarios/accounts.validation.ts`; preservar `id`, `role`, `status`, historial y campos no solicitados, con una transición atómica antes de enviar invitación/verificación.
- [X] T018 [US2] Mantener en `src/modules/usuarios/email-changes.service.ts` el correo activo anterior hasta confirmación y el correo PENDIENTE con nueva invitación; detectar correo propio sin tratarlo como duplicado de otra cuenta (ACTIVA informa sin cambio; PENDIENTE puede reemitir), impedir reclamar correo ajeno vigente o reservado y no dejar nombre parcial tras un conflicto.
- [X] T019 [US2] Exponer 400 con campo preciso y 409 sin correo de terceros en `src/modules/usuarios/accounts.routes.ts` y `src/modules/usuarios/accounts.errors.ts` para PATCH, conservando 401/403/404 y la semántica existente de 001.
- [X] T020 [US2] Ejecutar una muestra de 20 altas y 20 ediciones válidas del recorrido SC-002 con verificaciones cuando corresponda en `tests/integration/account-update-role.test.ts`; comprobar nombre/correo finales, estado PENDIENTE de altas y ninguna modificación de rol/historial.

**Checkpoint**: P2 pasa de forma independiente con una cuenta de 001, sin datos académicos.

---

## Phase 5: User Story 3 - Proteger operaciones sin depender de la interfaz (Priority: P3)

**Estado**: **PENDIENTE / BLOQUEADA** por la integración con Académico (T026–T027). Estas dos tareas forman parte de US3 y no pueden implementarse como cierre independiente; no marcar la historia como completada al implementar solo el límite de autorización.

**Goal**: Rechazar solicitudes directas sin permiso y establecer comprobación de responsabilidad docente que falla cerrada; integración con estudiantes depende de Académico.

**Independent Test**: Como anónimo, cuenta inactiva, docente o antiguo ADMIN denegar gestión de cuentas; con dos docentes/grupos y consumidor académico real denegar ID/filtro de ámbito ajeno, también si no se puede verificar la asignación.

### Tests for User Story 3

- [X] T021 [P] [US3] Extender `tests/integration/auth-boundaries.test.ts` con POST/PATCH/GET de cuentas sin sesión, como TEACHER, INACTIVA y ADMIN recién degradado durante sesión; comprobar primera solicitud posterior denegada sin datos ajenos ni cambios, incluso usando rutas directas de `/api/auth/*`.
- [X] T022 [P] [US3] Crear `tests/unit/scope-authorization.test.ts` con dos identidades docentes activas y un proveedor de asignaciones simulado que devuelve propio/ajeno/desconocido o falla; comprobar denegación por defecto ante error/ausencia y que rol/objetivo/filtro del cliente no suplantan al actor verificado. Esta prueba de límite no acredita SC-003 integrado.

### Implementation for User Story 3

- [X] T023 [US3] Exponer un punto de decisión sin rutas públicas en `src/modules/usuarios/scope-authorization.ts` conforme a `specs/002-validar-perfil-acceso/contracts/scope-authorization.md`: entrada con identidad activa obtenida de servidor, operación y tipo/ID objetivo; proveedor de asignaciones de Académico inyectable; salida permiso + ámbito verificado o denegación, sin permisos por defecto ni IDs provenientes de sesión de cliente.
- [X] T024 [US3] Integrar el punto de decisión con `requireActive` de `src/auth/session-guard.ts`, sin saltar cuenta/rol/estado actuales; ante falta de proveedor, rol discordante o asignación imposible, denegar antes de que un consumidor lea o modifique datos; no introducir rutas o tablas ficticias en `src/app.ts`.
- [X] T025 [US3] Comprobar que `src/app.ts` mantiene cerradas las rutas públicas de registro/administración de Better Auth y que `src/modules/usuarios/accounts.errors.ts` no revela cuentas ni datos de estudiante ante 401/403; comparar resultados con `tests/integration/auth-boundaries.test.ts`.
- [ ] T026 [US3] **Bloqueada hasta existir proveedor autoritativo de Académico y consumidor real de estudiantes/grupos**: acordar contratos concretos de entrada/salida/error/autorización con `specs/002-validar-perfil-acceso/contracts/scope-authorization.md`, integrar el guardia de `src/modules/usuarios/scope-authorization.ts` en la ruta real definida por Académico y documentar ruta/archivo consumidor allí; no marcar completa mediante un mock ni publicar consultas de estudiantes sin verificación.
- [ ] T027 [US3] **Bloqueada por T026**: ejecutar casos de dos docentes/grupos, lectura, modificación, ID/filtro manipulado y fallo de proveedor en el test de integración del consumidor real de Académico/Seguimiento; registrar prueba y dependencia en `specs/002-validar-perfil-acceso/quickstart.md` para SC-003/FR-007, sin datos del grupo ajeno.

**Checkpoint**: Gestión de cuentas protegida; la historia US3/SC-003 solo está completa después de T026 y T027 sobre asignaciones reales. No declarar completada por las pruebas unitarias de la interfaz.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Cerrar evidencia y contratos sin confundir dependencias externas con funciones entregadas.

- [X] T028 [P] Verificar que bootstrap, invitación y hash de Better Auth reutilizan la política de `src/modules/usuarios/accounts.validation.ts` en `tests/integration/auth-boundaries.test.ts` y `tests/integration/account-invitation.test.ts`; registrar en `specs/002-validar-perfil-acceso/quickstart.md` que cambio/restablecimiento de contraseña de FR-005 requerirán flujos de autenticación y prueba de titularidad, no habilitar endpoints públicos sin contrato.
- [X] T029 [P] Registrar en `specs/002-validar-perfil-acceso/contracts/scope-authorization.md` qué consumidores futuros (Académico, Seguimiento y Tareas) deben verificar estado/rol/ámbito/consentimiento y cuáles aún no existen; cotejar con constitución II/IV y no declarar concluida la integración de US3 sin T026/T027.
- [X] T030 Ejecutar `npm run typecheck` y `npm test` (incluidas pruebas de contrato/concurrencia) y documentar evidencia, entorno y limitaciones en `specs/002-validar-perfil-acceso/quickstart.md`; medir p95 con 30 sesiones solo como referencia documental sin presentarlo como meta aprobada.
- [ ] T031 **Depende de SPA y de al menos cinco administradores del piloto**: realizar prueba guiada SC-005 de corrección tras rechazo, registrar número de intentos, porcentaje sin ayuda y tiempos (<3 minutos en ≥90 %) en `specs/002-validar-perfil-acceso/quickstart.md`; no marcarla superada con pruebas automatizadas.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
001 implementada → Setup (T001–T002) → Foundation (T003–T005)
                                      ├→ US1 (T006–T013) → MVP verificable
                                      ├→ US2 (T014–T020) → edición verificable
                                      └→ US3 (T021–T025) → límite falla cerrado
                                                               ↓
                       proveedor + consumidor Académico → T026 → T027 → US3 completa
US1 + US2 + US3 integrada → Polish (T028–T031; SC-005 requiere SPA/personas)
```

- **Setup**: no cambia código de 001; T001 y T002 pueden iniciar en paralelo.
- **Foundation**: se completa antes de historias; T003 provee política compartida, T004 preserva el guardia de estado/rol y T005 el error seguro.
- **US1**: T006/T007/T008 independientes; T009 → T010 → T011, T012 depende de T003 y T007; T013 después de respuestas finales.
- **US2**: puede comenzar tras Foundation con cuentas de 001, aunque para integrar US1 y US2 sin conflicto sobre `accounts.service.ts`, `accounts.errors.ts` y `accounts-convergence.test.ts` conviene terminar primero US1. T014/T015/T016 paralelas, luego T017 → T018 → T019 → T020.
- **US3**: T021/T022 paralelas; T023 → T024 → T025; T026 necesita proveedor y consumidor reales, T027 necesita T026. US1/US2 y US3 pueden avanzar en archivos distintos hasta integración.
- **Polish**: T028/T029 tras historias respectivas; T030 tras cambios implementados; T031 tras disponibilidad de SPA y participantes. T030 no sustituye T027 ni T031.

### User Story Independence

- **US1 (P1)**: usa cuenta/invitación de 001 y puede demostrar alta validada con Foundation, sin US2/US3.
- **US2 (P2)**: usa cuenta existente de 001, independiente de alta nueva; compartir validadores/errores requiere coordinación de archivos, no dependencia funcional de US1.
- **US3 (P3)**: la denegación de cuentas funciona sin US1/US2; la historia completa depende de asignaciones y consumidor reales de Académico, aún no disponibles.

### Parallel Examples

```text
US1: T006 (tests/contract/accounts-create-list.test.ts)
     + T007 (tests/integration/account-invitation.test.ts)
     + T008 (tests/integration/accounts-convergence.test.ts)

US2: T014 (tests/contract/accounts-update-role.test.ts)
     + T015 (tests/integration/account-update-role.test.ts)
     + T016 (tests/integration/accounts-convergence.test.ts)

US3: T021 (tests/integration/auth-boundaries.test.ts)
     + T022 (tests/unit/scope-authorization.test.ts)
```

No ejecutar a la vez T008 y T016 sobre el mismo archivo. Las tareas compartidas T011/T019/T025 también requieren coordinación sobre `accounts.errors.ts`.

---

## Implementation Strategy

### MVP First (US1)

1. T001–T005: línea base y validación compartida sin repetir implementación de 001.
2. T006–T013: alta, unicidad y contraseña con pruebas, seguida de verificación independiente.
3. Demostrar P1 antes de planificar el cliente SPA; no confundir P1 con cierre de toda la feature.

### Incremental Delivery

1. Añadir US2 (T014–T020) sobre PATCH y confirmación ya existentes; demostrar corrección de perfil sin efectos parciales.
2. Añadir US3 (T021–T025) para negar accesos directos y exponer límite de autorización que falla cerrado.
3. Una vez que Académico provea asignaciones y consumidor, ejecutar T026–T027. Solo entonces puede darse por cubierta la parte de menores de US3.
4. Ejecutar T028–T030; realizar T031 presencialmente cuando exista la SPA. Los flujos futuros de cambio/restablecimiento de contraseña quedan vinculados al contrato de autenticación, sin atajos públicos.

## Notes

- [P] significa archivos separados y ninguna dependencia incompleta; los IDs son estables T001–T031.
- Cada tarea incluye archivo de código, prueba o documento de destino. No añadir un segundo esquema de cuentas ni un proveedor ficticio de asignaciones.
- Los hallazgos de pruebas de identidad, permisos y contrato se registran con resultado real; V3 propuesto no se describe como aprobado.
