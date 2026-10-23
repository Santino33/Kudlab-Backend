---
description: "Tareas ejecutables de operaciones del docente sobre estudiantes"
---

# Tasks: Operaciones del docente sobre estudiantes

**Input**: Documentos de `specs/005-gestionar-estudiantes/`.
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contrato](contracts/students-api.md) y [quickstart.md](quickstart.md).
**Tests**: Incluidas por los escenarios/criterios de la especificación y las obligaciones de verificación de la constitución. Escribir pruebas antes del comportamiento correspondiente y comprobar que fallan por la regla faltante, no por un entorno roto.
**Organization**: Prerrequisitos compartidos y una fase por historia; estado de ejecución indicado por los checkboxes y la evidencia de validación.

**Ejecución 2026-10-23**: implementación terminada y validada en bases de prueba aisladas. Typecheck y 113 pruebas aprobadas; migración desde cero y upgrade verificados. Ver [validation.md](validation.md). Checklists sin modificar; sin despliegue productivo.

## Format: `[ID] [P?] [Story] Description`

- `[P]`: trabajo sobre archivos diferentes que puede realizarse en paralelo una vez cumplidas sus dependencias explícitas. No significa ejecutar pruebas simultáneamente sobre una base compartida.
- `[US1]`–`[US4]`: historias de la especificación. Setup, fundamento y cierre no llevan etiqueta de historia.
- Rutas relativas a la raíz del repositorio; usar el estado real del journal al generar la migración, sin fijar de antemano su nombre generado.
- No ampliar alcance: sin cuentas infantiles, tareas, consentimiento, activación/reactivación, traslados, borrado definitivo ni API de administración de grupos.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar una ejecución segura en el backend existente, sin reinicializar el proyecto ni agregar dependencias.

- [X] T001 Verificar Node 24 y URL de PostgreSQL desechable, instalar con `npm ci` cuando sea necesario y registrar línea base de `npm run typecheck` y `npm test`, comandos/resultado/impedimentos y ausencia de uso de producción en `specs/005-gestionar-estudiantes/validation.md`; consultar `package.json`, `tests/setup.ts` y `tests/helpers.ts` antes de cualquier reset.
- [X] T002 Contrastar `specs/005-gestionar-estudiantes/spec.md`, `data-model.md` y `contracts/students-api.md` con el código actual; registrar en `specs/005-gestionar-estudiantes/validation.md` los supuestos aún revisables y la dependencia de grupos preexistentes, sin interpretarlos como aprobación de activación ni añadir gestión de grupos; escalar cualquier contradicción nueva antes de implementarla.
- [X] T003 Revisar bloqueos de cuentas/identidad/revocación en `src/modules/usuarios/accounts/`, `src/modules/usuarios/shared/account-lock.ts`, `src/auth/session-guard.ts` y `src/auth/session-activity.ts`; registrar orden compatible y pruebas de regresión seleccionadas en `specs/005-gestionar-estudiantes/validation.md` antes de la extracción transaccional.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Datos, autenticación y ámbito compartidos por las cuatro historias. Completar esta fase antes de implementar historias.

- [X] T004 Definir `groups` en `src/db/schema/academic.ts` preservando literalmente las restricciones de `data-model.md`: `id UUID` «PK, generado por servidor, estable.»; `teacher_id UUID` «NOT NULL, FK a `user_accounts.id`, sin cascada de borrado. Un responsable por grupo.»; `name VARCHAR(50)` «NOT NULL, no vacío tras trim. Nombre del grupo.»; `grade VARCHAR(20)` «NOT NULL, no vacío tras trim. Grado académico, sin inventar catálogo.»; `school_year INT` «NOT NULL. Año escolar; no se introduce rango institucional no aprobado.»; agregar índice no único en `teacher_id`, sin unicidad nueva de nombre/grado/año ni campos adicionales.
- [X] T005 Añadir `students` en `src/db/schema/academic.ts` después de T004, preservando literalmente: `id UUID` «PK, generado por servidor; no editable.»; `group_id UUID` «NOT NULL, FK a `groups.id`, sin cascada de borrado; no editable en esta feature.»; `student_code VARCHAR(50), collation C` «NOT NULL, único globalmente; 1–50 caracteres tras trim; comparación sensible a mayúsculas.»; `first_name VARCHAR(100)` y `last_name VARCHAR(100)` «NOT NULL, 1–100 caracteres tras trim; editable.»; `is_active BOOLEAN` «NOT NULL, DEFAULT false. Solo transición hacia false en estos endpoints.»; aplicar «CHECK de datos no vacíos y sin espacios externos comunes en persistencia», índice en `group_id` y unicidad también para inactivos, sin CHECK permanente que impida almacenar activos legítimos futuros.
- [X] T006 Generar con `npm run db:generate` la siguiente migración aditiva en `src/db/migrations/` y sus metadatos en `src/db/migrations/meta/` desde el journal vigente, después de T005; revisar que solo agregue las dos tablas, FK, CHECK e índices previstos, mantenga collation `C` y no altere autenticación ni renumere migraciones existentes; incluir ajustes SQL/metadatos coherentes si la collation requiere tratamiento explícito.
- [X] T007 Registrar las exportaciones académicas en `src/db/client.ts` tras T005; comprobar integración con el glob de `drizzle.config.ts` y tipado de consultas/transacciones sin modificar esquemas de cuentas o Better Auth.
- [X] T008 Extender `tests/helpers.ts` tras T006–T007 con preparación aislada de dos docentes y dos grupos por docente, estudiantes activos/inactivos solo por fixture y reset explícito seguro de tablas académicas; reutilizar invitación/login actuales y `user_accounts.id`, sin endpoint de grupos ni datos productivos.
- [X] T009 Añadir pruebas de regresión de preparación de sesión y aceptación dentro de una transacción en `tests/integration/students-session-atomicity.test.ts`, usando fixtures T008 y barreras/reloj controlado: false de aceptación revierte una escritura de prueba, ausencia/cierre/vencimiento absoluto o por inactividad deniega, rechazos no renuevan actividad y el orden de commits determina qué operación precede a la revocación; comprobar el fallo inicial antes de T010–T011.
- [X] T010 Extraer preparación reutilizable de identidad/sesión en `src/auth/session-guard.ts` sin efecto posterior al handler; conservar firma, respuestas, verificación de sesión persistida y comportamiento post-handler del wrapper `requireActive` existente, exponiendo solo al consumidor académico los IDs de cuenta, identidad y sesión, nunca credenciales nuevas.
- [X] T011 Extraer en `src/auth/session-activity.ts` una variante interna de aceptación que reciba la transacción del consumidor; mantener el wrapper existente con su propia transacción y contrato previo; permitir al consumidor académico validar vencimiento absoluto/inactividad y consistencia de identidad y registrar actividad aceptada antes de commit, lanzando rollback al fallar, sin reiniciar actividad por solicitudes rechazadas ni cambiar la regla de 30 minutos.
- [X] T012 [P] Crear errores y mapper de Académico en `src/modules/academico/shared/academic.errors.ts` conforme a `contracts/students-api.md`: `{code,message,fields?}`, mensajes neutrales, allowlist de campos/motivos sin eco de valores, 404 idéntico para ausente/ajeno y mapeo de la restricción única de código a 409 `CONFLICT`; mantener `STUDENT_CODE_CONFLICT` solo como clasificación interna si se usa y no depender del `fail` de cuentas para reconocer una clase nueva.
- [X] T013 Implementar `src/modules/academico/shared/academic-auth.ts` y `src/modules/academico/shared/scope-provider.ts` después de T007, T010–T012: guard docente anterior a diagnósticos de cuerpo, proveedor `AssignmentProvider` que consulta propiedad con IDs de negocio y deniega ausente/fallo, sin permisos implícitos de Administrador; admitir consultas dentro de la transacción académica para no separar autorización y uso, sin sustituir la colección por un target ficticio.
- [X] T014 Verificar T009 y regresión de autenticación/cuentas tras T010–T013, y probar migración de `src/db/migrations/` en bases desechables vacía y con cuentas/sesiones del estado previo; registrar resultados y preservación de datos en `specs/005-gestionar-estudiantes/validation.md`; resolver cualquier inversión de bloqueos o cambio de contrato antes de abrir historias.

**Checkpoint**: Fundamento tipado, migrado y probado; helper transaccional evita el rechazo posterior a commit en los consumidores nuevos. No se habilita activación.

---

## Phase 3: User Story 1 — Registrar un estudiante de un grupo propio (Priority: P1) — MVP

**Goal**: Alta inactiva en grupo propio, sin crear una cuenta del menor.
**Independent Test**: Con grupo propio preparado, POST válido devuelve 201 y un registro inactivo verificable directamente en PostgreSQL bajo el mismo ID; no requiere implementar GET de US2. Cuentas/credenciales/sesiones no aumentan. Grupo ajeno y duplicado se rechazan sin cambios.

### Tests for User Story 1

- [X] T015 [P] [US1] Crear casos de alta en `tests/unit/students-validation.test.ts` para código «1–50 caracteres tras trim» y nombres/apellidos «1–100 caracteres tras trim», conteo Unicode en puntos de código, vacío/null/tipos incorrectos, espacios externos, acentos, ceros iniciales y caso preservados; exigir claves estrictas y rechazar `id`, `teacherId`, credenciales e `isActive` incluso false.
- [X] T016 [P] [US1] Crear casos POST en `tests/contract/students-api.test.ts` para 201 con solo las seis propiedades DTO, 400 con campos/motivos seguros, 401/403 antes de diagnósticos, grupo ajeno/inexistente con el mismo 404, código ocupado con 409 neutral y query desconocida rechazada según `contracts/students-api.md`.
- [X] T017 [P] [US1] Crear casos de alta en `tests/integration/students-scope.test.ts` con grupo propio/ajeno, proveedor ausente/fallido, cuenta/rol cambiados tras login y código ocupado por inactivo de otro docente; comprobar rollback, alta inactiva y cero nuevas cuentas/credenciales/sesiones de estudiante.
- [X] T018 [P] [US1] Crear carrera alta/alta en `tests/integration/students-concurrency.test.ts` con sesiones independientes y PostgreSQL real: un solo registro con código final, un 201 y un 409 sin campos parciales; verificar además que códigos con diferente caso son distintos y que un reintento con código idéntico no duplica.

### Implementation for User Story 1

- [X] T019 [US1] Implementar validación de alta en `src/modules/academico/students/students.validation.ts` y alta/DTO común en `src/modules/academico/students/students.service.ts` tras T015–T018: aplicar límites/trim sin truncar, aceptar solo grupo/código/nombres/apellidos, generar ID y estado false, autorizar y escribir en la misma transacción con bloqueos cuenta → identidad auth → sesión → grupo; preparar DTO y aceptar actividad dentro de esa transacción, lanzando rollback si falla, y traducir solo la restricción de código a conflicto.
- [X] T020 [US1] Crear POST en `src/modules/academico/students/students.routes.ts` y montar router/guard académico tanto en colección como subrutas de `src/app.ts`, después de T019; autenticar/validar rol antes de diagnósticos, verificar formato mínimo de `groupId` antes de ámbito y luego validar resto, responder 201 según contrato y usar mapper académico sin alterar rutas de Usuarios ni envolver estas rutas con el post-handler de `requireActive`.
- [X] T021 [US1] Ejecutar pruebas T015–T018 y ampliar `tests/integration/students-session-atomicity.test.ts` al POST real con expiración/cierre/fallo final antes de commit; registrar en `specs/005-gestionar-estudiantes/validation.md` resultados, cero cuentas nuevas y conservación de datos ante rechazo, sin depender de lecturas HTTP de US2.

**Checkpoint**: Alta MVP utilizable por un docente con grupo preexistente; aislamiento y atomicidad demostrados.

---

## Phase 4: User Story 2 — Consultar estudiantes del ámbito propio (Priority: P1)

**Goal**: Listado y detalle mínimos que incluyen inactivos pero nunca estudiantes ajenos.
**Independent Test**: Preparar datos por fixture sin usar POST; dos docentes con dos grupos cada uno reciben exclusivamente su ámbito. Consultar un ID ajeno/inexistente/malformado produce el mismo 404; ámbito vacío devuelve `{items:[]}`.

### Tests for User Story 2

- [X] T022 [P] [US2] Añadir casos GET colección/detalle en `tests/contract/students-api.test.ts`: `{items:Student[]}` sin totales/paginación, orden por ID ascendente, seis campos DTO, activos/inactivos incluidos, query desconocida rechazada, 404 idéntico ajeno/inexistente/UUID de ruta malformado y 401/403 seguros antes de validación.
- [X] T023 [P] [US2] Añadir casos de lectura en `tests/integration/students-scope.test.ts` con matriz dos docentes × dos grupos, ámbito vacío, cambios actuales de rol/estado/responsabilidad y fallo de verificación; comprobar cero filas ajenas y ausencia de filtración incluso por llamadas directas/IDs manipulados.

### Implementation for User Story 2

- [X] T024 [US2] Implementar listado/detalle y validación de parámetros en `src/modules/academico/students/students.service.ts` y `src/modules/academico/students/students.validation.ts`: join restringido por cuenta docente vigente para colección sin filtrar en memoria ni target comodín, detalle por estudiante y ámbito, selección explícita del DTO, orden ID ascendente y actividad aceptada en la misma transacción de lectura.
- [X] T025 [US2] Añadir GET colección y GET `:id` en `src/modules/academico/students/students.routes.ts`, después de T024, usando guard/errores existentes, queries estrictas y tratamiento neutral de UUID de ruta; no aceptar `teacherId`, filtros, expansiones ni paginación no definidos.
- [X] T026 [US2] Ampliar `tests/integration/students-session-atomicity.test.ts` con lecturas exitosas que renuevan actividad, rechazos que no la renuevan y vencimiento/cierre previo a aceptación final que no expone DTO; comprobar sesiones independientes sin ampliar el ámbito.
- [X] T027 [US2] Ejecutar la suite de lectura y registrar en `specs/005-gestionar-estudiantes/validation.md` aislamiento de los cuatro grupos, neutralidad de errores y recorrido POST→GET si US1 ya está disponible; para prueba independiente usar solo fixtures y GET.

**Checkpoint**: Consulta usable independientemente del alta, con datos preparados y ámbito validado.

---

## Phase 5: User Story 3 — Corregir información de un estudiante (Priority: P2)

**Goal**: Corregir código/nombres/apellidos conservando identidad, grupo y estado.
**Independent Test**: Con un estudiante propio por fixture, PATCH válido persiste campos permitidos bajo el mismo ID; duplicado, estado/grupo/ID inmutable o docente ajeno no cambian nada. Verificar por PostgreSQL si US2 no está implementada.

### Tests for User Story 3

- [X] T028 [P] [US3] Añadir casos PATCH en `tests/unit/students-validation.test.ts`: uno o más de código/nombres/apellidos, límites «1–50 caracteres tras trim» y «1–100 caracteres tras trim», rechazo de cuerpo vacío/null/unknown y de ID/grupo/estado incluso si coincide con el valor actual; conservar normalización Unicode/caso/ceros del alta.
- [X] T029 [P] [US3] Añadir casos PATCH en `tests/contract/students-api.test.ts` para 200 con DTO, 400/401/403/404/409/503 según contrato, autorización de recurso anterior a diagnósticos detallados, código actual no duplicado y ausencia de filtración por errores de campos o conflictos ajenos.
- [X] T030 [P] [US3] Añadir casos de corrección en `tests/integration/students-scope.test.ts` para estudiantes propios activos e inactivos, invariantes ID/grupo/estado, docente ajeno, código ocupado por inactivo y fallo de persistencia con rollback íntegro de nombres y código.
- [X] T031 [P] [US3] Ampliar `tests/integration/students-concurrency.test.ts` con carreras alta/corrección y corrección/corrección sobre el mismo código final, usando sesiones independientes, barreras y PostgreSQL real; exigir un solo titular, conflicto del perdedor y ninguna modificación parcial de sus otros campos.

### Implementation for User Story 3

- [X] T032 [US3] Implementar esquema PATCH y actualización de campos permitidos en `src/modules/academico/students/students.validation.ts` y `src/modules/academico/students/students.service.ts` tras T028–T031: bloquear cuenta → identidad auth → sesión → grupo → estudiante, verificar propiedad vigente, modificar solo código/nombres/apellidos y aceptar actividad antes de commit; dejar ID/grupo/estado intactos y revertir todo ante conflicto o sesión inválida.
- [X] T033 [US3] Añadir PATCH `:id` en `src/modules/academico/students/students.routes.ts`, después de T032, manteniendo consulta/validación de ámbito previa a diagnóstico detallado y respuesta 200/errores del contrato; no exponer edición genérica, traslados o activación.
- [X] T034 [US3] Ejecutar pruebas de corrección y ampliar `tests/integration/students-session-atomicity.test.ts` al PATCH real que pierde vigencia antes de aceptación final; registrar en `specs/005-gestionar-estudiantes/validation.md` rollback de nombres/código y permanencia de ID/grupo/estado, comprobando directamente persistencia si GET no está disponible.

**Checkpoint**: Corrección independently verificable en registros preparados, sin activación ni traslado accidental.

---

## Phase 6: User Story 4 — Inactivar conservando el registro (Priority: P2)

**Goal**: Inactivar sin borrar, manteniendo datos académicos y acceso docente.
**Independent Test**: Insertar un estudiante activo por fixture aislado, inactivarlo dos veces y comprobar estado false y mismos datos/ID; sesión docente sigue usable, sin nueva cuenta/sesión del estudiante.

### Tests for User Story 4

- [X] T035 [P] [US4] Añadir casos POST `:id/deactivate` en `tests/contract/students-api.test.ts` para 200 y mismo DTO tras repetición, rechazo de cuerpo no vacío/query desconocida, 404 idéntico para UUID malformado/ajeno/inexistente y denegación segura 401/403 sin diagnósticos previos.
- [X] T036 [P] [US4] Añadir casos de inactivación en `tests/integration/students-scope.test.ts` sobre activos/inactivos propios y ajenos: preservar código/nombres/apellidos/grupo/ID, no borrar, reservar código del inactivo y conservar sesión/cuenta del docente; usar fixture, sin inventar endpoint de activación.

### Implementation for User Story 4

- [X] T037 [US4] Implementar inactivación idempotente en `src/modules/academico/students/students.service.ts` tras T035–T036, bajo los mismos bloqueos y aceptación transaccional que la corrección: solo escribir `is_active=false`, conservar datos, permitir repetición y no revocar cuentas/sesiones ni liberar código.
- [X] T038 [US4] Añadir POST `:id/deactivate` sin cuerpo en `src/modules/academico/students/students.routes.ts`, después de T037, con autorización por estudiante y mapper académico, sin endpoint de activación/reactivación ni DELETE.
- [X] T039 [US4] Ejecutar pruebas de inactivación y ampliar `tests/integration/students-session-atomicity.test.ts` al endpoint real: fallo antes de aceptación final conserva estado activo inicial, repetición exitosa permanece inactiva y la sesión docente sigue usable; registrar resultado en `specs/005-gestionar-estudiantes/validation.md`.

**Checkpoint**: Las cuatro historias funcionan y se prueban individualmente con fixtures, sin requerir flujos del estudiante.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cerrar seguridad, regresión, cobertura y guía reproducible sin ampliar el producto.

- [X] T040 Revisar integración de `src/app.ts`, `src/modules/academico/students/students.routes.ts` y `src/modules/academico/shared/academic.errors.ts` contra `specs/005-gestionar-estudiantes/contracts/students-api.md`: colección/subrutas protegidas, cinco operaciones exactas, DTO mínimo, errores neutrales, queries/cuerpos estrictos, sin trazas sensibles ni decisiones de autenticación posteriores al commit; corregir desviaciones.
- [X] T041 Completar `tests/integration/students-session-atomicity.test.ts` con carreras de revocación/inactividad/cambio de rol y responsabilidad, ambos órdenes de commit y fallos técnicos; comprobar orden compatible de bloqueos, rollback/no actividad en rechazos, ausencia de deadlocks reproducibles y regresión de las reglas originales de Usuarios, sin sleeps frágiles ni cambios a plazos de sesión.
- [X] T042 Ejecutar `npm run typecheck` y `npm test` completos contra PostgreSQL aislado, incluyendo pruebas nuevas y de Usuarios; comparar con línea base y registrar comandos, fallos/resoluciones y resultados reales en `specs/005-gestionar-estudiantes/validation.md`; no declarar éxito si alguna suite o entorno queda pendiente.
- [X] T043 [P] Reconciliar `specs/005-gestionar-estudiantes/data-model.md`, `contracts/students-api.md` y `quickstart.md` con nombres/contratos implementados, manteniendo fidelidad al ERD y documentando FK adaptada, defaults, grupos preexistentes, limitación de red tras commit y exclusión de activación/tareas; no convertir la guía en una carga automática de grupos productivos.
- [X] T044 Ejecutar el recorrido de `specs/005-gestionar-estudiantes/quickstart.md` y documentar en `specs/005-gestionar-estudiantes/validation.md` POST→GET→PATCH→inactivar→GET y rechazos cruzados, repetición, límites, códigos y cero cuentas infantiles; registrar evidencia FR-001–FR-012 y SC-001–SC-006 y cualquier limitación de aceptación o despliegue.
- [X] T045 Revisar el diff de `src/db/schema/academic.ts`, `src/db/migrations/`, `src/auth/` y `src/modules/academico/` frente a `.specify/memory/constitution.md` y `specs/005-gestionar-estudiantes/source-context.md`; registrar cierre constitucional, preservación de datos/contratos existentes y prerrequisito de grupos reales en `specs/005-gestionar-estudiantes/validation.md`, sin promover defaults a políticas aprobadas ni marcar tareas incompletas como hechas.

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Setup T001–T003
    ↓
Fundamento T004–T014
    ├── US1: T015–T021 (alta, P1, MVP)
    ├── US2: T022–T027 (lectura, P1)
    ├── US3: T028–T034 (corrección, P2)
    └── US4: T035–T039 (inactivación, P2)
                  ↓
Cierre T040–T045
```

Dependencias internas de fundamento: T004 → T005 → T006; T005 → T007; T006+T007 → T008 → T009 → T010 → T011; T012 puede adelantarse después de Setup; T007+T010+T011+T012 → T013 → T014. La extracción de autenticación no necesita lógica de estudiantes, pero se verifica con una escritura de prueba tras preparar tablas/fixtures.

### User Story Dependencies

- **US1 (P1)**: depende solo del fundamento. Verificar persistencia mediante fixture/consulta directa antes de US2; no agregar GET implícitamente para declararla completa.
- **US2 (P1)**: depende solo del fundamento y datos preparados; si se implementa antes de US1, crear DTO/router comunes mínimos siguiendo el mismo contrato, sin implementar alta no solicitada por esa fase.
- **US3 (P2)** y **US4 (P2)**: dependen solo del fundamento y registros de prueba; pueden verificar persistencia directamente sin requerir GET/alta. Si se implementan primero, introducir solo el código común necesario en las rutas/servicio previstos.
- **Orden recomendado de entrega**: fundamento → US1 → US2 → US3 → US4 → cierre. Las historias no dependen funcionalmente unas de otras, pero comparten archivos de servicio, rutas, validación y pruebas: serializar sus cambios sobre esos archivos. No ejecutar historias completas en paralelo sin partición acordada de archivos.
- Dentro de cada historia: redactar y verificar pruebas fallidas → validación/servicio → endpoint → ejecutar y registrar checkpoint. Los tests de helper compartido van antes de su implementación y los de endpoint se amplían cuando ese endpoint existe.

### Parallel Opportunities

- T012 puede desarrollarse mientras avanza el esquema, porque usa un archivo independiente y el contrato existente.
- Tests de una misma historia marcados `[P]` pueden escribirse a la vez tras fundamento: archivos unitarios, contractuales, ámbito y concurrencia diferentes. Su ejecución contra la misma base sigue siendo secuencial.
- T043 puede realizarse junto a T040–T042, una vez integradas las cuatro historias: toca documentación distinta del informe de validación. T044 espera T042 y T043; T045 espera todo el cierre.
- No paralelizar T004/T005, historias que editan los mismos archivos ni las ampliaciones de `students-session-atomicity.test.ts`. Los escenarios concurrentes se ejecutan dentro de su prueba controlada, no habilitando paralelismo global de Vitest.

## Parallel Examples per User Story

### US1

```text
Tras T014, redactar en paralelo:
T015 — tests/unit/students-validation.test.ts (alta)
T016 — tests/contract/students-api.test.ts (POST)
T017 — tests/integration/students-scope.test.ts (alta/ámbito)
T018 — tests/integration/students-concurrency.test.ts (alta/alta)
Después: T019 → T020 → T021.
```

### US2

```text
Tras T014 y sin escritores competidores sobre esos archivos:
T022 — tests/contract/students-api.test.ts (GET)
T023 — tests/integration/students-scope.test.ts (lectura)
Después: T024 → T025 → T026 → T027.
```

### US3

```text
Tras T014 y sin escritores competidores sobre esos archivos:
T028 — tests/unit/students-validation.test.ts (PATCH)
T029 — tests/contract/students-api.test.ts (PATCH)
T030 — tests/integration/students-scope.test.ts (corrección)
T031 — tests/integration/students-concurrency.test.ts (alta/corrección y corrección/corrección)
Después: T032 → T033 → T034.
```

### US4

```text
Tras T014 y sin escritores competidores sobre esos archivos:
T035 — tests/contract/students-api.test.ts (inactivación)
T036 — tests/integration/students-scope.test.ts (inactivación)
Después: T037 → T038 → T039.
```

## Implementation Strategy

### MVP First (User Story 1 Only)

Completar T001–T014 y T015–T021: un docente con grupo ya preparado registra un estudiante inactivo. Demostrar creación, unicidad, aislamiento y cero identidades nuevas con pruebas/consultas directas. Este MVP no incluye todavía consulta HTTP ni habilitación de participantes y no está listo para despliegue real sin la provisión operativa de grupos acordada. Aplicar los controles de regresión/cierre pertinentes aunque se entregue solo ese incremento.

### Incremental Delivery

Agregar US2 para consulta independiente, US3 para corrección y US4 para inactivación, ejecutando el checkpoint de cada fase y regresión de lo anterior. Cerrar con T040–T045, verificación completa del quickstart y evidencia constitucional. No agregar activación para facilitar pruebas de inactivación: usar exclusivamente fixtures aislados.

## Coverage & Task Counts

| Grupo | Tareas | Cantidad | Requisitos/criterios principales |
| --- | --- | --- | --- |
| Setup | T001–T003 | 3 | Seguridad de ejecución y línea base. |
| Fundamento | T004–T014 | 11 | FR-002/004/009/010; sesión y modelo compartidos. |
| US1 | T015–T021 | 7 | FR-001/003/004/008/009/011; SC-002/004/005. |
| US2 | T022–T027 | 6 | FR-002/005/008/010; SC-001/005. |
| US3 | T028–T034 | 7 | FR-004/006/008/009; SC-002/003/005. |
| US4 | T035–T039 | 5 | FR-007/008/009/011; SC-003/005. |
| Cierre | T040–T045 | 6 | FR-012 y cobertura transversal FR-001–012, SC-001–006. |
| **Total** | **T001–T045** | **45** | Cuatro historias, siete fases. |

## Notes

La generación original de este archivo no ejecutó cambios; la implementación posterior está respaldada por `validation.md`. No agregar tablas de auditoría académica ni reutilizar `account_audit_events` para estudiantes por iniciativa propia. Si el entorno contiene datos/esquemas ajenos al historial, aislar o reconciliar explícitamente en lugar de resetearlos.
