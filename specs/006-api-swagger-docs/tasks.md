---
description: "Tareas ejecutables de documentación OpenAPI y Swagger UI, sin cambios de negocio"
---

# Tasks: Documentación verificable de la API

**Input**: Documentos de `specs/006-api-swagger-docs/`.

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/documentation.md](contracts/documentation.md), [inventory.md](inventory.md) y [quickstart.md](quickstart.md).

**Tests**: Solicitadas explícitamente por FR-013/014 y los escenarios de aceptación. Escribir primero las pruebas del incremento y comprobar que fallan por la ausencia o discrepancia esperada, no por configuración incorrecta. No alterar negocio para conseguir que un contrato nuevo pase.

**Organization**: Cuatro historias, dos P1 y dos P2. No se implementa nada al generar este archivo. Todas las tareas comienzan pendientes; la autorización para generar Tasks no se trata como aprobación automática para implementar una spec aún marcada Draft.

**Estado de ejecución**: aprobación explícita recibida; 32/32 tareas completadas. Ver [validation.md](validation.md), incluidas las limitaciones de captura PNG y el audit de dependencias no corregido en esta feature.

## Format: `[ID] [P?] [Story] Description`

- `[P]`: puede ejecutarse junto a otra tarea indicada de la misma fase, en archivos diferentes y tras sus prerrequisitos.
- `[US1]`–`[US4]`: historia correspondiente de spec.md. Setup, fundamentos y cierre no llevan historia.
- Los números definen orden por defecto; una marca paralela no permite saltarse prerrequisitos ni la comprobación inicial de aprobación.

## Path Conventions

Servicio único: `src/`, `tests/`, `docs/`, `package.json` y `package-lock.json` relativos a la raíz del worktree. Los comandos de implementación deben ejecutarse en el worktree dedicado, rama `feat/api-swagger-docs`; no cambiar ramas, otros worktrees ni copiar sus dependencias o archivos de entorno.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar autorización y herramientas sin modificar los endpoints actuales.

- [X] T001 Verificar aprobación explícita de `specs/006-api-swagger-docs/spec.md` y del diseño antes de implementar; si sigue pendiente, detenerse y solicitarla; registrar aprobación, commit base, rama, estado inicial y límites de trabajo en `specs/006-api-swagger-docs/validation.md`, sin sobrescribir cambios ajenos ni declarar aprobados RF históricos.
- [X] T002 Añadir versiones exactas `swagger-ui-dist@5.34.0` en dependencies y `@apidevtools/swagger-parser@13.1.0` más `openapi-types@12.1.3` en devDependencies de `package.json` y `package-lock.json`, conservando Node >=24 <25, Hono/Better Auth/YAML/Ajv/Vitest actuales; instalar con `SCARF_ANALYTICS=false`, sin generador, CDN, CLI de lint adicional ni framework E2E.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Base mínima para contrastar documentación sin alterar reglas ni utilizar infraestructura real.

**CRITICAL**: Completar Setup y esta fase antes de historias; no arrancar el servidor ni ejecutar fixtures con truncado antes de confirmar una BD exclusiva y desechable.

- [X] T003 [P] Preparar y documentar la configuración local de BD exclusiva de pruebas 006 en `specs/006-api-swagger-docs/quickstart.md` y registrar únicamente identificación no secreta/resultado en `specs/006-api-swagger-docs/validation.md`; comprobar que DATABASE_URL y MIGRATION_DATABASE_URL, cuando existan, apuntan a esa misma BD antes de migrar o usar `tests/helpers.ts`, que ejecuta TRUNCATE CASCADE; no versionar credenciales ni cambiar defaults compartidos de `tests/setup.ts`.
- [X] T004 [P] Crear un helper mínimo en `tests/openapi.helpers.ts` para leer YAML con rechazo de claves duplicadas, validar estructura OpenAPI 3.1 y referencias internas mediante Swagger Parser sobre copia con resolutores HTTP/archivo deshabilitados, y validar respuestas con Ajv2020/ajv-formats sin coerción, defaults o eliminación de propiedades; resolver refs sin duplicar lógica por dominio y sin importar `src/app.ts`, `tests/helpers.ts` ni bootstrap.

**Checkpoint**: Infraestructura segura y helper disponibles. No nuevas tablas, esquemas persistidos, guardas ni migraciones de esta feature.

## Phase 3: User Story 1 - Descubrir el contrato realmente disponible (Priority: P1) — MVP

**Goal**: Un catálogo canónico completo y verificable de las 26 operaciones, incluso sin Swagger UI.

**Independent Test**: Validar el YAML y comparar exhaustivamente método/ruta contra inventory.md, montajes reales y lista blanca auth; comprobar éxitos y errores representativos sin UI.

### Tests for User Story 1

- [X] T005 [P] [US1] Crear `tests/unit/openapi-document.test.ts` usando el helper para exigir OpenAPI `3.1.0`, versión documental `0.1.0`, `servers` relativo `/`, referencias internas, exactamente las 26 operaciones de `specs/006-api-swagger-docs/contracts/documentation.md`, siete tags acordados, IDs únicos y las reglas «`summary`, `description`, `tags`: Obligatorios»; comprobar fallo inicial por catálogo inexistente sin importar app/fixtures ni conectar a BD.
- [X] T006 [P] [US1] Crear `tests/contract/api-openapi.test.ts` con contraste del conjunto de rutas explícitas de `src/app.ts` y sus routers frente al catálogo, normalizando solo barra final y `:id`→`{id}`, excluyendo infraestructura/documentación y verificando las cinco operaciones permitidas del wildcard auth; reutilizar fixtures/recorridos existentes para comprobar éxito nominal de las 26 operaciones y errores aplicables contra el helper, sin considerar todo ALL como disponible ni duplicar suites históricas.

### Implementation for User Story 1

- [X] T007 [US1] Crear `docs/api/openapi.yaml` como única fuente canónica con metadatos, tags e identificadores de `specs/006-api-swagger-docs/contracts/documentation.md`; definir componentes reutilizables y errores separados respetando «`fields` es array de `{field,reason}` si existe. No obligarlo en todos los 400» en Usuarios y «`fields` es objeto de campos permitidos a motivos seguros; no fusionarlo con el array de Usuarios» en Académico; no imponer `additionalProperties:false`, `required` o límites que el código no exige, ni promover propuestas históricas.
- [X] T008 [US1] Documentar en `docs/api/openapi.yaml` las ocho operaciones de cuentas y cuatro de solicitudes de rol con inputs, seguridad vigente, salidas, cabeceras y errores del código; conservar Account `id,name,email,role,status,createdAt` y «opcionales `pendingEmail,deliveryStatus,invitationExpiresAt`», AccountPage «limit 1–100 default20; offset≥0 default0; filtro status solo donde existe», RoleRequest `id,requesterAccountId,status,requestedAt` y «opcionales `decidedByAccountId,decidedAt`», «Array en listado; ADMIN ve pendientes, TEACHER propias», auditoría `actorId,targetId,action,occurredAt` como «Array sin envoltorio; snapshots solo campos realmente expuestos» con `before/after` opcionales; citar y reflejar «nombre recortado 1–200, correo `.edu.co` normalizado, rol literal TEACHER en creación; actualización con al menos nombre o correo», enums actuales de `src/modules/usuarios/shared/accounts.types.ts` y ejemplos ficticios válidos.
- [X] T009 [US1] Documentar en `docs/api/openapi.yaml` las cinco operaciones de autenticación, aceptación de invitación, confirmación de correo y dos de recuperación, distinguiendo vistas locales y proveedor 1.7.7; conservar «Login: email válido, password no vacío y `rememberMe` boolean opcional; no trasladar reglas de alta al parser de login», «Password al fijarla: 8–128 y mayúscula/minúscula/número», `Identity` filtrada `id,email,name,role`, `SessionView` con `user` y `session:{id,expiresAt}`, JWKS `{keys:[…]}` con `kid,kty,alg` sin campos RSA obligatorios y token `{token:string}`; explicitar cuerpos ausentes/ignorados/prohibidos y ejemplos sintéticos, sin publicar otras rutas del proveedor.
- [X] T010 [US1] Documentar en `docs/api/openapi.yaml` las cinco operaciones existentes sobre estudiantes realizadas por TEACHER y ámbito propio, con Student «Seis propiedades; sin datos de consentimiento, credenciales ni identidad del profesor» (`id,groupId,studentCode,firstName,lastName,isActive`) y StudentList «Incluye activos e inactivos de grupos propios; sin total, paginación o filtros»; reflejar «UUID de grupo en alta; código recortado de 1–50 puntos de código Unicode y nombres de 1–100, sin NUL», «PATCH no vacío solo con código/nombres; grupo/ID/estado no editables», «Alta fija inactivo; inactivación exige cuerpo de longitud cero», «estudiantes rechaza cualquier query» e «ID estudiantil inválido, ajeno o ausente produce 404 equivalente»; preservar «inactivación fija false y es idempotente; no hay activación pública», sin añadir login, grupos o tareas como operaciones disponibles.
- [X] T011 [US1] Ejecutar `npx vitest run tests/unit/openapi-document.test.ts` y, únicamente con la BD confirmada por T003, `npx vitest run tests/contract/api-openapi.test.ts`; revisar las 26 operaciones de `docs/api/openapi.yaml` con el código actual, registrar cobertura método/ruta/éxitos/fallos y discrepancias documentales en `specs/006-api-swagger-docs/validation.md`, corrigiendo el catálogo y nunca el negocio para ajustarlo a pruebas nuevas.

**Checkpoint**: MVP documental de 26 operaciones disponible como archivo versionado, con autenticación básica correcta y contratos contrastados, sin necesitar rutas documentales. US2 profundiza comprobaciones y explicación de seguridad/efectos; no permite que el MVP tenga permisos falsos u omitidos.

## Phase 4: User Story 2 - Entender el acceso y las consecuencias (Priority: P1)

**Goal**: Explicar y demostrar credenciales, roles, ámbito, fallos y consecuencias reales sin cambiar controles.

**Independent Test**: Contrastar seguridad declarada con escenarios sintéticos de sesión ausente/vencida/revocada, JWT aislado, rol incorrecto, recurso ajeno y tokens consumidos; validar respuestas y cabeceras frente al YAML, sin UI.

### Tests for User Story 2

- [X] T012 [US2] Ampliar `tests/contract/api-openapi.test.ts` reutilizando pruebas existentes de cuentas/autenticación/recuperación/estudiantes para verificar seguridad por operación, cookie HTTP/HTTPS, Bearer opaco, rechazo de JWT aislado, sesión inactiva, ADMIN denegado en estudiantes, ámbito propio y neutralidad de recurso ajeno; cubrir tokens vencidos/consumidos, recuperación neutra, revocaciones y efectos de correo persistido antes de fallo; añadir casos de proveedor JWKS/rememberMe/CSRF/429 solo donde sean realmente aplicables según `specs/006-api-swagger-docs/research.md`, sin cambiar la configuración productiva para simular cobertura.

### Implementation for User Story 2

- [X] T013 [US2] Precisar seguridad por cada operación en `docs/api/openapi.yaml`: públicas explícitas `security: []`; alternativas `sessionCookie` en `better-auth.session_token`, `secureSessionCookie` en `__Secure-better-auth.session_token` según baseURL HTTPS y `sessionBearer` opaco sin `bearerFormat: JWT`, nunca exigidas juntas; describir rol/ámbito y conservar «ID interno de sesión no equivale a su credencial ni al token de interoperabilidad», sin confundir tokens de un uso con sesiones.
- [X] T014 [US2] Explicar las transiciones existentes en `docs/api/openapi.yaml`: invitación «PENDIENTE→ACTIVA al aceptar invitación válida; token de siete días, un uso», cuenta «ACTIVA→INACTIVA y revocación de sesiones; reactivar no las restaura; se protege último ADMIN activo», correo «Correo nuevo pendiente→confirmado mediante token de siete días; revoca sesiones al confirmar», ascenso «PENDIENTE→APROBADA/RECHAZADA; solo decisión ADMIN elegible, sin auto-decisión; aprobación cambia rol», descenso «ADMIN activo→TEACHER mediante operación específica; protección de último administrador» y recuperación «Token de 30 minutos disponible→consumido; petición posterior invalida anteriores; confirmar cambia password y revoca sesiones, sin login automático»; preservar respuesta neutra y no prometer rollback/entrega que el servicio no garantiza.
- [X] T015 [US2] Afinar en `docs/api/openapi.yaml` ejemplos y respuestas delegadas 1.7.7: recordar inactividad local de 30 min incluso con rememberMe, cookie persistente o de sesión y cierre sin cuerpo; separar 401 local de `UNAUTHORIZED` delegado, 403 de origen y 429 sin `code` con `X-Retry-After` cuando rate limit aplica, sin imponer UserError a todos los fallos; documentar Set-Cookie/set-auth-token solo donde se transmiten, no prometer set-auth-jwt en get-session ni no-store inexistente, y no usar un JWT activo como ejemplo.
- [X] T016 [US2] Ejecutar los escenarios de `tests/contract/api-openapi.test.ts` y regresiones de seguridad relacionadas sobre BD exclusiva; registrar evidencia y revisión de las declaraciones de `docs/api/openapi.yaml` en `specs/006-api-swagger-docs/validation.md`, identificando condiciones de entorno del proveedor y cualquier limitación sin declarar pruebas no ejecutadas.

**Checkpoint**: Seguridad y efectos comprendidos y contrastados; no cambios en `src/auth/` ni en los servicios/guardas de negocio.

## Phase 5: User Story 3 - Consultar la documentación visual de forma segura (Priority: P2)

**Goal**: Publicar UI/contrato y assets locales solo en desarrollo/pruebas, sin consola de escrituras ni exposición productiva.

**Independent Test**: Construir router documental aislado para development/test/production/staging/vacío/ausente; verificar HTML/YAML/assets y luego comprobar render real en navegador, sin ejecutar operaciones de negocio.

### Tests for User Story 3

- [X] T017 [P] [US3] Crear `tests/unit/documentation-routes.test.ts` sin importar app/auth/fixtures para comprobar GET `/docs`, `/openapi.yaml`, `/docs/swagger-ui.css` y `/docs/swagger-ui-bundle.js`, medios correctos y YAML idéntico al canónico, 200 solo development/test y 404 en production/staging/vacío/ausente; comprobar que no se resuelven/leen archivos en rama deshabilitada, no se publican otros archivos ni traversal, no depende de cwd y la configuración UI no contiene CDN/Petstore/credenciales/validador externo ni Try it out.
- [X] T018 [P] [US3] Crear `tests/integration/documentation.test.ts` para verificar montaje real desde `src/app.ts`, 200 sin sesión cuando procede y 404 fuera de entornos habilitados incluso con sesión ADMIN sintética, sin cambios en CORS ni rutas de negocio; construir/importar app después de fijar entorno y restaurar variables/caché al terminar porque `tests/setup.ts` fuerza NODE_ENV=test, usando BD exclusiva para fixtures.

### Implementation for User Story 3

- [X] T019 [US3] Crear factoría en `src/docs/documentation.routes.ts` con entorno explícito y default process.env.NODE_ENV: «Disponibles solo con entorno explícito development/test; resto 404. No estado por usuario ni transición persistida»; servir el archivo canónico sin copia y solo los dos assets locales de swagger-ui-dist mediante adaptador Node/Hono con rutas absolutas de módulo/paquete, evitando lecturas en rama deshabilitada y directorios abiertos; HTML con url `/openapi.yaml`, `supportedSubmitMethods: []`, `persistAuthorization: false`, `queryConfigEnabled: false`, `validatorUrl: 'none'`, ayuda de cookies/JWT y sin preautorización ni tráfico de negocio.
- [X] T020 [US3] Montar el router documental en `src/app.ts` sin modificar lista blanca, guardas, parsers, CORS, handlers, efectos u orden de rutas existentes; mantener solo `/docs`, `/openapi.yaml` y sus dos assets como recursos nuevos, fuera del catálogo de 26 operaciones de negocio.
- [X] T021 [US3] Ejecutar `tests/unit/documentation-routes.test.ts` sin BD y `tests/integration/documentation.test.ts` con BD exclusiva, comprobando códigos/cuerpos/tipos de medios y matriz completa de entornos; registrar resultados y ausencia de cambios de negocio en `specs/006-api-swagger-docs/validation.md`.
- [X] T022 [US3] Seguir el recorrido de navegador de `specs/006-api-swagger-docs/quickstart.md` sobre infraestructura sintética: abrir `/docs`, confirmar 26 operaciones/siete tags y expandir una por dominio, revisar parámetros/cuerpos/esquemas/respuestas/seguridad, Network/Console sin refs rotas/requests externos o `/api/*`, sin Try it out ni credenciales persistidas; registrar navegador/versión/fecha y captura saneada en `specs/006-api-swagger-docs/validation.md`, sin sustituir render visual por una prueba de HTML.

**Checkpoint**: La UI presenta el catálogo completo en entornos permitidos y los cuatro recursos permanecen inaccesibles en los demás, sin efectos de negocio al navegar.

## Phase 6: User Story 4 - Mantener y verificar el catálogo (Priority: P2)

**Goal**: Un comando reproducible sin BD detecta errores documentales y la guía permite actualizar el catálogo sin confundir diseños futuros con capacidades disponibles.

**Independent Test**: Ejecutar docs:check sin PostgreSQL y comprobar rechazo de mutaciones del documento; seguir guía de mantenimiento y localizar contrato, URLs/entornos, pruebas contractuales y evidencia visual.

### Tests for User Story 4

- [X] T023 [P] [US4] Ampliar `tests/unit/openapi-document.test.ts` con casos negativos sobre copias para YAML malformado/claves duplicadas, `$ref` roto o externo, operationId duplicado, parámetro de ruta/seguridad inexistente y operación extra/faltante; exigir ejemplos contextuales válidos de esquemas, medios, parámetros, cabeceras y ejemplos reutilizados, incluida detección de un ejemplo incompatible que Ajv no evaluaría automáticamente como anotación.

### Implementation for User Story 4

- [X] T024 [P] [US4] Actualizar `README.md` con contrato canónico `docs/api/openapi.yaml`, recursos/entornos, `NODE_ENV=development` explícito, instalación sin analítica, UI de consulta y límites de cookies, pasos de actualización/contraste y validaciones separadas documental/BD/visual; advertir fixtures destructivas y no anunciar Swagger UI en producción ni funcionalidades futuras.
- [X] T025 [US4] Extender `tests/openapi.helpers.ts` solo con las comprobaciones semánticas/recorrido contextual que exijan T023 y el contrato: refs internos resueltos, ejemplos de esquemas y usos concretos validados con Ajv2020, sin coerción/defaults/eliminación, sin acceso remoto y sin un framework genérico de validación innecesario; reutilizar el helper desde pruebas canónicas existentes sin duplicar lógica ni endurecer la API real.
- [X] T026 [US4] Añadir `docs:check` en `package.json` como ejecución explícita de `tests/unit/openapi-document.test.ts` y `tests/unit/documentation-routes.test.ts`, sin app/bootstrap/fixtures ni BD; ejecutar el comando y las mutaciones negativas, registrar resultados en `specs/006-api-swagger-docs/validation.md`, sin añadir otra configuración Vitest si no es necesaria.
- [X] T027 [US4] Corregir las afirmaciones de estudiantes no implementados en `docs/agent-context/modules/usuarios/features/documentacion-api-swagger.md` y `docs/agent-context/architecture-summary.md`, y ajustar referencias afectadas en `docs/agent-context/INDEX.md` y `docs/agent-context/modules/usuarios/module-summary.md` solo si lo necesitan; señalar cinco operaciones existentes gestionadas por profesores, estudiantes sin acceso, resto de Académico aún fuera del catálogo, conservando estado histórico de contratos propuestos.
- [X] T028 [US4] Recorrer las instrucciones actualizadas de `README.md` y `specs/006-api-swagger-docs/quickstart.md`, corregir nombres/comandos reales y registrar en `specs/006-api-swagger-docs/validation.md` que un mantenedor localiza contrato/UI, verifica cambios simulados método/ruta y reproduce verificación documental sin instrucciones adicionales; no presentar la guía prevista de Plan como prueba ya ejecutada.

**Checkpoint**: Comando documental sin BD y guía de mantenimiento completos; deriva del catálogo detectable y condiciones de publicación comprensibles.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Evidencia final y revisión de límites, sin ampliar alcance ni añadir refactors.

- [X] T029 Ejecutar `npm run docs:check`, `npm run typecheck` y, sobre BD exclusiva 006 migrada, `npm test`; registrar comandos/resultados en `specs/006-api-swagger-docs/validation.md` y corregir defectos exclusivamente documentales/de publicación, sin cambiar expectativas de las pruebas de negocio o afirmar éxito si falta infraestructura.
- [X] T030 Revisar íntegramente `docs/api/openapi.yaml`, ejemplos/capturas de `specs/006-api-swagger-docs/validation.md` y respuestas publicadas para confirmar cero secretos, tokens activos o datos reales de personas; revisar diff de `src/app.ts`, `src/docs/documentation.routes.ts` y contexto para confirmar únicamente publicación/contrato de 26 operaciones, sin cambios de negocio, nuevos permisos, login estudiantil o anuncios futuros.
- [X] T031 Reconciliar cobertura FR-001–016 y SC-001–006 con tareas y resultados en `specs/006-api-swagger-docs/validation.md`, manteniendo tres resultados separados (documento/ejemplos, HTTP/regresión, navegador), revisión constitucional y discrepancias pendientes; incluir fallos/limitaciones reales y no marcar como completado lo que no se verificó.
- [X] T032 Revisar `specs/006-api-swagger-docs/tasks.md` contra evidencia, marcar solo tareas terminadas y enlazar informe final desde `specs/006-api-swagger-docs/quickstart.md`; entregar resumen de archivos, alcance y verificaciones al responsable, sin commit automático, despliegue ni ejecución de otras features.

## Dependencies & Execution Order

### Phase Dependencies

```text
T001 aprobación → T002 dependencias
                       ↓
             T003 BD/guía ║ T004 helper
                       ↓
             US1: T005–T011 (P1, MVP)
                       ↓
             US2: T012–T016 (P1)
                       ↓
             US3: T017–T022 (P2)
                       ↓
             US4: T023–T028 (P2)
                       ↓
             Cierre: T029–T032
```

- Setup bloquea fundamentos; fundamentos bloquean las historias. Preparación de BD T003 puede hacerse en paralelo con helper T004, pero ninguna suite con fixtures puede saltarse T003.
- US1 no depende de UI: entrega catálogo completo con permisos básicos correctos. Las tareas T007–T010 editan el mismo YAML y son secuenciales.
- US2 amplía profundidad de contrato/pruebas de US1 y requiere su catálogo. Sus tareas de YAML son secuenciales. No fingir independencia de escritura cuando se comparte archivo.
- US3 usa el catálogo terminado en US1/US2 para una presentación real. Sus tests aislados y de integración son independientes entre sí y preceden implementación del router. El estado productivo se fija antes de construir app, no después.
- US4 reutiliza tests/helpers previos; T023 y T024 pueden avanzar juntos. T025 sigue al test rojo T023; T026 requiere T025 y las pruebas de router de US3. T027 y T028 siguen la secuencia indicada para no editar guías/contexto a la vez que otra tarea usa sus resultados.
- Cierre depende de las cuatro historias. Ninguna historia modifica servicios de negocio para hacer coincidir código y documento.

### Within Each User Story

Pruebas del incremento → cambios documentales/publicación → ejecución independiente → checkpoint con evidencia. No crear modelos de BD, servicios de dominio o endpoints nuevos siguiendo literalmente categorías de un template genérico. Los permisos del sistema son objeto de documentación/regresión, no de implementación nueva.

### Parallel Opportunities

Marcadas `[P]` únicamente: T003/T004 (tras Setup), T005/T006 (tras fundamentos), T017/T018 (tras US2), T023/T024 (tras US3). Cada pareja edita archivos diferentes y no depende del resultado de su compañera. Los tests compartidos y el YAML canónico tienen un solo escritor por vez; la evidencia se actualiza secuencialmente.

## Parallel Example: User Story 1

```text
Tras T003/T004:
T005 → tests/unit/openapi-document.test.ts (sin BD)
T006 → tests/contract/api-openapi.test.ts (BD exclusiva)
Después de comprobar fallo esperado: T007 → T008 → T009 → T010 → T011.
```

## Parallel Example: User Story 2

```text
No hay paralelismo interno seguro necesario: tests y un único YAML compartido.
T012 → T013 → T014 → T015 → T016.
No delegar ediciones simultáneas de docs/api/openapi.yaml.
```

## Parallel Example: User Story 3

```text
Tras US2:
T017 → tests/unit/documentation-routes.test.ts
T018 → tests/integration/documentation.test.ts
Después de comprobar fallo esperado: T019 → T020 → T021 → T022.
```

## Parallel Example: User Story 4

```text
Tras US3:
T023 → tests/unit/openapi-document.test.ts
T024 → README.md
Después de T023: T025 → T026; completar T024 antes de T027/T028.
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Confirmar aprobación T001, completar Setup y fundamentos.
2. Implementar US1 con catálogo de 26 operaciones, seguridad básica real y pruebas positivas/contraste; detenerse y revisar T011.
3. El MVP es documentación versionada verificable, **no** Swagger UI ni autorización para desplegar; no reducirlo a un listado sin parámetros, errores o permisos.

### Incremental Delivery

US1 catálogo → US2 profundidad de seguridad/efectos → US3 publicación y revisión visual → US4 mantenimiento → revisión final. Cada checkpoint tiene una prueba independiente del incremento, aunque exista dependencia de artefactos previos. No declarar completa la feature hasta finalizar las cuatro historias y sus verificaciones.

### Parallel Team Strategy

Usar solo las parejas `[P]` detalladas; no se requiere delegación para ejecutar este plan. Si intervienen varios agentes, respetar aislamiento y no escribir simultáneamente YAML, package.json, app.ts o evidencia. Mantener dependencias congeladas tras T002 salvo corrección mínima justificada.

## Traceability & Counts

| Grupo | Tareas | Cantidad | Requisitos / criterios |
| --- | --- | --- | --- |
| Setup | T001–T002 | 2 | Aprobación, herramientas mínimas y trazabilidad |
| Fundamentos | T003–T004 | 2 | Infraestructura segura y validador compartido |
| US1 (P1) | T005–T011 | 7 | FR-001–005, base de FR-006/009/010/013; SC-001–003/005 |
| US2 (P1) | T012–T016 | 5 | FR-006–010/016; SC-002/003/005 |
| US3 (P2) | T017–T022 | 6 | FR-011/012/014/016; SC-004/005 |
| US4 (P2) | T023–T028 | 6 | FR-002/003/004/010/013/015; SC-001–003/006 |
| Cierre | T029–T032 | 4 | Todos FR-001–016 y SC-001–006; evidencia final |
| Total | T001–T032 | 32 | Cuatro historias y siete fases |

## Notes

- Todos los paths de tareas son concretos y relativos al repositorio; `validation.md` será evidencia de implementación, no un informe de tests ficticio creado ahora.
- No generar ni alterar credenciales reales. Correo `.edu.co` de ejemplo es sintético/no operativo y nunca destinatario de pruebas de envío reales; usar captura/SMTP de pruebas según entorno permitido.
- Ante discrepancia que exija cambiar comportamiento, detener esa parte y consultar fuera de esta feature. No resolverla ampliando permisos o rutas.
- Los contratos históricos y documentos originales no prueban disponibilidad actual; mantener inventario contrastado y contexto preciso.
- Al generar Tasks no se ejecutan estas tareas, no se instala nada ni se toca BD. Los checks de este comando comprueban formato, trazabilidad, dependencias y cobertura documental.
