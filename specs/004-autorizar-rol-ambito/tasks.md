---

description: "Tareas de implementación para autorización por rol y responsabilidad"
---

# Tasks: Autorizar por rol y responsabilidad

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/) y [quickstart.md](quickstart.md).

**Prerequisites**: rama `004-autorizar-rol-ambito`; PostgreSQL de pruebas para integración. RF-004 V3 y D-08 siguen propuestos, no aprobados. La implementación de US2/US3 no se declara completada con dobles ni sin proveedor/consumidor real.

**Tests**: Requeridos por constitución V y por escenarios de [spec.md](spec.md): pruebas de autorización, fallo cerrado, contratos y cambios de rol/asignación. En cada historia escribir casos que fallen antes de modificar el comportamiento.

**Organization**: tareas por historia; [P] solo indica archivos distintos y ninguna dependencia entre tareas paralelas del mismo bloque. Todas las rutas `src/modules/academico/` y `src/modules/seguimiento/` son **previstas**; no existen todavía.

## Phase 1: Setup (inventario y línea base)

**Purpose**: Documentar estado inicial sin crear otro proyecto, dependencia ni tabla de permisos.

- [X] T001 En `specs/004-autorizar-rol-ambito/quickstart.md`, registrar rama, Node 24, PostgreSQL aislado, `npm ci`, `npm run db:migrate`, `npm run typecheck` y `npm test` con fecha, resultado y errores de entorno; no declarar pruebas nuevas superadas por la línea base.
- [X] T002 [P] En `specs/004-autorizar-rol-ambito/research.md`, contrastar `src/app.ts`, `src/auth/session-guard.ts`, `src/modules/usuarios/scope-authorization.ts` y las rutas de cuentas con los dos contratos de 004; anotar cuáles controles ya funcionan y cuáles necesitan integración real.

---

## Phase 2: Foundational (reglas comunes de frontera)

**Purpose**: Asegurar que toda operación futura sea explícita y que no se infiera ámbito desde una sesión o un filtro.

**⚠️ CRITICAL**: completar antes de activar cualquier consumidor nuevo de estudiantes/grupos.

- [X] T003 En `src/modules/usuarios/scope-authorization.ts`, definir el tipo de decisión denegada/permitida y una entrada de operación individual explícita; conservar la denegación por defecto cuando falta proveedor, rol TEACHER/estado ACTIVA, tipo `student|group`, ID no vacío u operación `read|write`, sin permitir un `true` por un ámbito declarado por el cliente.
- [X] T004 [P] En `tests/unit/scope-authorization.test.ts`, fijar casos de proveedor ausente/fallido, objetivo inválido, cuenta INACTIVA, rol ADMIN y objetivo ajeno: todos devuelven denegado; documentar que un doble no prueba asignaciones reales.
- [X] T005 En `src/auth/session-guard.ts`, conservar `requireActive`/`requireAdmin` y `authorizeProtectedScope` como frontera única de sesión opaca y cuenta ACTIVA/rol concordante; nunca usar JWT firmado sin sesión ni renovar `session_activity` por una solicitud denegada, y denegar si falla `resolveActiveIdentity` o el proveedor.

**Checkpoint**: Frontera segura y fallando cerrada; no hay todavía proveedor académico ni acceso estudiantil público.

---

## Phase 3: User Story 1 - Acceder solo a funciones del rol vigente (Priority: P1) 🎯 MVP

**Goal**: Un ADMIN vigente puede gestionar cuentas; TEACHER, una cuenta no activa o una sesión inválida no obtienen datos ni efectos, incluso al invocar la ruta directamente.

**Independent Test**: Con cuentas de prueba ADMIN/TEACHER y sesiones distintas, ejecutar GET/POST/PATCH y auditoría de cuentas; cambiar rol durante una sesión, intentar acceder con la sesión anterior y comprobar denegación desde la primera solicitud.

### Tests for User Story 1 (antes de cambios)

- [X] T006 [P] [US1] Añadir pruebas de contrato HTTP para GET/POST/PATCH/rol/auditoría de `/api/v1/accounts` en `tests/contract/accounts-authorization.test.ts`: 200/201 solo con ADMIN vigente conforme al contrato 001; 401 sin sesión, 403 sin permiso, respuesta genérica sin lista, detalle o conteos ajenos.
- [X] T007 [P] [US1] Añadir prueba de integración en `tests/integration/role-scope-boundaries.test.ts`: cambio de rol ADMIN→TEACHER con sesión abierta, cuenta inactiva, rol discordante, JWT sin sesión opaca y verificación no disponible; la primera solicitud posterior se deniega sin actualización de negocio ni actividad de sesión aceptada.

### Implementation for User Story 1

- [X] T008 [US1] Ajustar únicamente si los tests revelan brecha la precedencia `requireActive`→`requireAdmin` de GET/POST/PATCH/role/audit en `src/app.ts` y `src/auth/session-guard.ts`; preservar los flujos TEACHER de solicitud de ascenso y aceptación de invitación fuera de la política ADMIN de cuentas.
- [X] T009 [US1] Contrastar cuerpo, estado y errores de las rutas de `src/modules/usuarios/accounts.routes.ts` y `src/app.ts` con `specs/004-autorizar-rol-ambito/contracts/accounts-authorization.md` y `specs/001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml`; corregir cualquier exposición de cuenta ante 401/403 sin cambiar el contrato de entrada.
- [X] T010 [US1] Ejecutar `npm run typecheck` y `npm test` y consignar en `specs/004-autorizar-rol-ambito/quickstart.md` los resultados de T006–T009 y la evidencia real de SC-001/rol de SC-004; no reclamar SC-002/003 por este recorrido.

**Checkpoint**: US1 comprobable con rutas existentes; MVP válido sin acceso a menores.

---

## Phase 4: User Story 2 - Consultar y modificar solo estudiantes asignados (Priority: P2)

**Goal**: Dos docentes con asignaciones reales leen y modifican exclusivamente objetivos propios mediante operaciones académicas aprobadas; ajenos y escrituras mixtas se deniegan íntegramente.

**Independent Test**: Persistir dos grupos y estudiantes ficticios vinculados a cuentas docentes distintas, consultar/modificar por el consumidor real, probar IDs ajenos/mixtos y retirar la asignación durante una sesión. Ninguna prueba con proveedor doble cierra esta historia.

**Gate externo obligatorio (T011–T012)**: si la matriz de permisos, modelo académico o contrato de consumidor aún no están aprobados, detener US2 aquí; mantener las rutas no publicadas y dejar T013–T020 pendientes. No inventar permisos del ADMIN sobre menores.

- [X] T011 [US2] Obtener y registrar en `specs/004-autorizar-rol-ambito/contracts/authorization-boundary.md` con el responsable y Académico la matriz de operación por recurso/rol (qué lectura y qué modificación concreta puede realizar TEACHER), y tratamiento de ADMIN; dejar toda operación no acordada como denegada.
- [X] T012 [US2] Acordar con Académico, y registrar en `specs/004-autorizar-rol-ambito/data-model.md`, el esquema definitivo de grupo, estudiante y asignación vigente, incluida pertenencia real, revocación, transición entre grupos y mapeo de `groups.teacher_id` del DBML propuesto a `user_accounts.id` UUID del esquema actual; especificar mecanismo de consistencia ante reasignación concurrente antes de migrar.
- [X] T013 [US2] Publicar en `specs/004-autorizar-rol-ambito/contracts/academic-students.openapi.yaml` **solo tras T011–T012** el contrato HTTP del consumidor académico aprobado (operaciones, IDs, cuerpos, respuestas, 401/403 genéricos y reglas de consentimiento aplicables), indicando que la ruta se añade en implementación y no procede de V3 como endpoint existente.

### Tests for User Story 2 (antes de implementación de consumidor)

- [X] T014 [P] [US2] Añadir en `tests/integration/academic-scope.test.ts` casos con PostgreSQL, dos cuentas TEACHER, dos grupos y estudiantes reales: lectura/escritura propia, ID ajeno, grupo propio con estudiante ajeno, cambio de pertenencia y revocación; verificar que el error no confirma existencia de otro estudiante.
- [X] T015 [P] [US2] Añadir en `tests/contract/academic-authorization.test.ts` casos HTTP del contrato de T013: sesión ausente/vencida, cuenta inactiva/rol discordante, operación no aprobada, proveedor caído y escritura mixta; comprobar respuesta genérica y ningún cambio parcial.

### Implementation for User Story 2

- [X] T016 [US2] Implementar **solo el esquema aprobado en T012** en `src/db/schema/academic.ts` y `src/db/migrations/0008_academic_scope.sql` (o nombre generado por Drizzle equivalente registrado en el journal), con IDs estables, FK cuenta-docente/estudiante-grupo y restricciones de asignación/vigencia; no crear una copia de permisos en `src/db/schema/accounts.ts`.
- [X] T017 [US2] Implementar en `src/modules/academico/assignment-provider.ts` la fuente real que para `(accountId, read|write, student|group, id)` consulta asignación vigente y pertenencia efectiva; denegar en blanco, ausencia, error o revocación; el ID del actor viene de `src/auth/session-guard.ts`, no del cliente.
- [X] T018 [US2] Integrar proveedor real y operación explícita en `src/modules/usuarios/scope-authorization.ts` y `src/auth/session-guard.ts` sin habilitar ADMIN sobre estudiantes ni una ruta global de comprobación; validar nuevamente cuenta/rol/ámbito para cada solicitud.
- [X] T019 [US2] Implementar el consumidor exacto acordado en T013 en `src/modules/academico/students.service.ts` y `src/modules/academico/students.routes.ts` y montarlo en `src/app.ts` detrás de sesión/permiso; para escrituras de uno o varios objetivos, comprobar todos y confirmar el cambio en unidad transaccional coherente con reasignaciones según T012, sin efectos parciales.
- [X] T020 [US2] Ejecutar `npm run db:migrate`, `npm run typecheck`, `npm test` con PostgreSQL aislado y registrar en `specs/004-autorizar-rol-ambito/quickstart.md` pruebas cruzadas reales para SC-002/004 y US3 de 002; si no hay proveedor/consumidor real, registrar explícitamente bloqueo y dejar T020 pendiente.

**Checkpoint**: US2 solo se completa con fuente autoritativa y consumidor real, más permisos aprobados; no con T004 ni con IDs fijados en memoria.

---

## Phase 5: User Story 3 - Ver únicamente resultados del ámbito autorizado (Priority: P3)

**Goal**: Listados, filtros, opciones, paginación, totales y agregados nunca contienen datos de otros grupos, incluso con filtros vacíos o mixtos.

**Independent Test**: Con los dos docentes y grupos reales de US2, solicitar listas y resultados con filtro propio/ajeno/mixto y sin filtro; cambiar asignación y repetir. Contar solo los registros del ámbito efectivo.

**Gate**: T011–T020 y contrato de consulta del consumidor aprobados. Si Seguimiento no existe, una consulta académica real aprobada puede verificar listas de estudiantes, pero los resúmenes del panel de Seguimiento permanecen pendientes hasta que ese consumidor esté disponible: no presentar SC-003 íntegra como superada sin probarlos.

- [X] T021 [US3] Acordar operaciones de listado y agregación con el módulo dueño y registrar entradas, respuestas, filtros por estudiante/grupo/período, totales y errores del consumidor real en `specs/004-autorizar-rol-ambito/contracts/academic-students.openapi.yaml`; si el panel se implementa en Seguimiento, publicar allí el contrato antes de exponerlo.

### Tests for User Story 3 (antes de implementación del listado)

- [X] T022 [P] [US3] Añadir en `tests/integration/academic-lists-scope.test.ts` pruebas con dos grupos reales para filtro vacío, propio, ajeno y mixto, opciones/total/páginas limitados, conjunto autorizado vacío frente a proveedor caído, y primera solicitud tras revocación.
- [X] T023 [P] [US3] Añadir en `tests/contract/academic-lists-authorization.test.ts` casos HTTP de lista/resumen bajo el contrato T021: ningún ID o conteo ajeno en cuerpo/error, parámetros manipulados no amplían ámbito y una solicitud individual ajena sigue denegada.

### Implementation for User Story 3

- [X] T024 [US3] Ampliar `src/modules/academico/assignment-provider.ts` para devolver un conjunto verificable de IDs autorizados (vacío conocido distinto de fallo), sin reutilizar el `boolean` de objetivo individual como permiso global; reducir por filtros normalizados del consumidor.
- [X] T025 [US3] Aplicar ámbito actual antes de paginar, contar o agregar en `src/modules/academico/students.service.ts` y `src/modules/academico/students.routes.ts`; listas mixtas excluyen ajenos sin confirmar su existencia, y una falla al resolver ámbito deniega toda la solicitud.
- [ ] T026 [US3] Cuando exista panel real, aplicar el mismo ámbito a filtros, resultados y totales de `src/modules/seguimiento/results.routes.ts` y registrar sus pruebas de integración en `tests/integration/tracking-scope.test.ts`; mantener esta tarea pendiente si el módulo no existe y no afirmar que el panel ya está cubierto.
- [X] T027 [US3] Ejecutar `npm run typecheck` y `npm test` con base aislada, registrar en `specs/004-autorizar-rol-ambito/quickstart.md` qué subconjunto de SC-003 está probado con consumidores reales y qué parte del panel sigue pendiente.

**Checkpoint**: US3 cerrada únicamente después de probar todos los tipos de resultado prometidos en la especificación con su consumidor real.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Contratos coherentes, regresión y evidencias verificables sin confundir objetivos propuestos con aprobados.

- [X] T028 [P] Revisar `specs/004-autorizar-rol-ambito/contracts/authorization-boundary.md` y el contrato público de T013/T021 contra `src/app.ts`, `src/auth/session-guard.ts` y consumidores reales; anotar faltantes de permisos/consentimiento, parámetros, respuestas y actores antes de declarar completada RF-004.
- [X] T029 Ejecutar `npm run typecheck` y `npm test` (incluidas suites de contrato de 001/003 y nuevas pruebas de permisos) y consignar comandos, entorno, resultados, fallos y FR/SC cubiertos en `specs/004-autorizar-rol-ambito/quickstart.md`.
- [X] T030 Implementar y ejecutar solo tras T020–T027 `tests/performance/academic-scope-load.test.ts` con 30 sesiones y p95 de lecturas propias, ajenas y listados; registrar muestras, volumen y entorno en `specs/004-autorizar-rol-ambito/quickstart.md`, comparar con SC-005 como meta propuesta y no declarar aprobación institucional.
- [ ] T031 Coordinar prueba guiada con al menos cinco adultos y SPA con datos ficticios; registrar ayuda, tiempos y comprensión de límites por intento en `specs/004-autorizar-rol-ambito/quickstart.md` para SC-006; mantener pendiente si faltan participantes/SPA.
- [X] T032 En `specs/004-autorizar-rol-ambito/quickstart.md`, cerrar trazabilidad FR-001–008 y SC-001–006 con evidencia por consumidor, dejando expresamente pendientes US2/US3, SC-002/003 o prueba humana si faltan dependencias; vincular US3/SC-003 bloqueadas de `specs/002-validar-perfil-acceso/quickstart.md` sin marcarlas completas por pruebas con dobles.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → **US1 (Phase 3, MVP)**. T001 registra línea base; T002 puede hacerse en paralelo.
- **US2 (Phase 4)**: depende de frontera y guardia base T003–T005; **T011 y T012 son gates** de decisiones de dominio/operación y deben preceder a contrato T013 y cualquier esquema/ruta académica T016–T019. T014/T015 se escriben contra T013 y deben fallar antes de implementar.
- **US3 (Phase 5)**: depende del proveedor y consumidor reales de US2, así como del contrato T021 antes de las pruebas T022/T023; T024–T026 implementan el ámbito de listas después de esas pruebas. Si aún no hay Seguimiento, T026 y validación completa SC-003 permanecen pendientes.
- **Polish (Phase 6)**: T028/T029 dependen de los recorridos implementados; T030 depende de P2/P3 integradas; T031 requiere SPA y adultos, independiente del trabajo de código; T032 se realiza tras comprobar evidencia efectiva, no basada en intención.

### User Story Dependencies

- **US1 (P1)**: verificable de forma independiente con cuentas existentes sin Académico.
- **US2 (P2)**: verificable de forma independiente con fuente de asignación real y consumidor académico autorizado; reutiliza guardias compartidos de US1 sin esperar el panel.
- **US3 (P3)**: verificable por tipo de consumidor, pero requiere asignaciones reales de US2; panel de Seguimiento se cierra solo cuando exista y se pruebe.

### Parallel Opportunities

- T001/T002 (archivos distintos); T004 con el diseño de T003 (test y código, respetando test rojo antes de implementar).
- T006/T007 pueden escribirse simultáneamente (contrato HTTP e integración en archivos distintos).
- Tras gates T011–T013, T014/T015 en archivos independientes. El esquema T016 precede al proveedor T017, y T017 a la integración T018/T019.
- Tras T021, T022/T023 son independientes; T024 precede a T025, y T026 depende de un Seguimiento real, no de mocks.
- T028 y la preparación de T031 pueden avanzar en paralelo tras existir consumidor; para editar `quickstart.md`, coordinar T029–T032 secuencialmente.

### Parallel Example: User Story 1

```text
T006: contrato GET/POST/PATCH/role/audit en tests/contract/accounts-authorization.test.ts
T007: cambio de rol/sesión en tests/integration/role-scope-boundaries.test.ts
→ T008/T009: aplicar ajustes observados en src/app.ts / src/modules/usuarios/accounts.routes.ts
```

### Parallel Example: User Story 2

```text
T011 y T012: decisiones funcional y académica documentadas en archivos distintos
→ T013: contrato público aprobado
→ T014 y T015: integración y contrato en archivos de pruebas distintos
→ T016 → T017 → T018 → T019: modelo, proveedor, guardia, consumidor
```

### Parallel Example: User Story 3

```text
T021: contrato de lista del consumidor real
→ T022 y T023: pruebas independientes de consulta de datos y respuesta HTTP
→ T024 → T025: ámbito efectivo antes de contar/paginar
→ T026: Seguimiento si existe con contrato y pruebas propias
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar T001–T005; mantener denegación de ámbito en ausencia de proveedor.
2. Completar T006–T010 y verificar solo SC-001 y la parte de rol de SC-004 sobre rutas existentes.
3. Detener y validar MVP; ninguna ruta de menores queda abierta por esta entrega.

### Incremental Delivery

1. US1 reutiliza cuentas/roles actuales sin añadir esquema académico.
2. Con decisiones T011–T012, US2 integra una fuente Académico **real** y una operación consumidora aprobada; sin ellas no se marca completada.
3. US3 amplía ese ámbito a listas y, cuando exista, al panel; SC-003 no se cierra por listas solamente si también se prometen resúmenes de Seguimiento.
4. Ejecutar T028–T032 para evidencias, métricas y revisión humana; conservar pendientes visibles si un gate externo no se resuelve.

## Notes

- Cada tarea sin ejecutar permanece `- [ ]`; no marcar checks por existir un plan, doble o especificación previa.
- No crear rutas demostrativas de estudiantes ni migraciones con asignaciones supuestas para acelerar US2/US3.
- [P] significa archivos distintos y sin dependencia pendiente; no indica delegación automática ni trabajos simultáneos sobre el mismo archivo.
