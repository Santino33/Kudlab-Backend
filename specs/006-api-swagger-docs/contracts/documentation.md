# Contratos de publicación y mantenimiento documental

Estado: diseño de la feature 006, no recursos ya implementados. Consumidores: desarrolladores, Swagger UI local y pruebas del repositorio. No modifica el contrato de las 26 operaciones de negocio del [inventario](../inventory.md).

## 1. Fuente canónica

- Archivo futuro: `docs/api/openapi.yaml`, OpenAPI `3.1.0`, YAML UTF-8, catálogo actual de 26 operaciones.
- Las representaciones y restricciones se describen en [data-model.md](../data-model.md), contrastadas contra código; no copiar etiquetas históricas de propuesta como declaración de implementación actual.
- Todas las referencias `$ref` serán internas (`#/…`). No enlaces de resolución remota, archivos fuera del contrato ni múltiples copias operativas JSON/YAML.
- `servers: [{url: '/'}]`: mismo origen; sin hosts productivos o credenciales precargados.
- Los contratos `specs/001…005/contracts/` mantienen su condición histórica. Sus consumidores de prueba existentes siguen funcionando; se añade validación contra el catálogo canónico sin cambiar expectativas de negocio.
- Este documento es contrato de diseño, no el OpenAPI operativo completo. El YAML de 26 operaciones se redactará y validará durante implementación, siguiendo este diseño y el inventario; Plan no añade aún un archivo publicable que afirme estar verificado.

## 2. Interfaces documentales nuevas

| Método / recurso | `development` o `test` explícitos | Cualquier otro entorno |
| --- | --- | --- |
| GET `/docs` | 200, `text/html; charset=UTF-8`, interfaz Swagger UI con configuración local | 404 normal de Hono, sin HTML documental |
| GET `/openapi.yaml` | 200, `application/yaml; charset=UTF-8`, mismos bytes UTF-8 del archivo canónico | 404 sin contenido del contrato |
| GET `/docs/swagger-ui.css` | 200, `text/css`, asset empaquetado local | 404 sin asset |
| GET `/docs/swagger-ui-bundle.js` | 200, JavaScript, asset empaquetado local | 404 sin asset |

Las dos rutas de assets son dependencias de presentación de `/docs`, no operaciones de negocio ni un directorio estático abierto. Solo se sirven los dos archivos permitidos: no publicar todo `node_modules`, assets del proveedor no usados, source maps, `.env` ni rutas arbitrarias. El contenido productivo no depende de tener sesión, rol ADMIN o parámetros de query.

- Condición exacta evaluada al construir el router: `NODE_ENV` igual a `development` o `test`. Ausente, vacío, `production`, `staging` u otro valor no registran publicación. Cambiar entorno exige reconstruir router/reiniciar proceso; no usar query o cabeceras como interruptor.
- Sin sesión previa para consultar documentación habilitada. No tocar `/api/*`, CORS, `requireActive`, `requireAdmin`, `requireTeacher` ni la lista blanca de Better Auth.
- Rutas de fichero resueltas desde módulo/paquete, no a partir de entradas del cliente ni del directorio de ejecución. No leer YAML o assets en la rama deshabilitada. Fichero ausente es error de entrega, nunca fallback a Petstore o CDN.
- Archivos documentales y assets podrán responder HEAD si el servidor estático/Hono lo ofrece; HEAD no se incorpora al catálogo de negocio. Nada habilita métodos de escritura sobre recursos documentales.

## 3. Interfaz de consulta, no consola de ejecución

- Swagger UI autoalojado, versión fijada, sin CDN. Usa `url: '/openapi.yaml'`; no Petstore, `urls`, `configUrl` ni fuentes elegibles por query.
- `supportedSubmitMethods: []`: no “Try it out”. El usuario pidió consulta/presentación del contrato, no una herramienta que ejecute escrituras sobre datos del piloto. La ayuda conserva las instrucciones para consumidores sobre cookie o sesión opaca aunque esta interfaz sea de consulta.
- `persistAuthorization: false`, sin preautorización, sin credenciales embebidas, sin interceptores que inicien sesión o consulten negocio. No depender de localStorage para acceso.
- `queryConfigEnabled: false`; no permitir sustituir el documento desde la URL.
- Desactivar validador remoto mediante `validatorUrl: 'none'`; validación exclusivamente en herramientas locales, no enviar contrato o datos a servicios externos.
- La carga visual solo solicita HTML, CSS, bundle y YAML del mismo origen. Expandir esquemas/operaciones no solicita `/api/*`. No se añaden fuentes, favicons o scripts remotos.
- Ayuda visible: esta UI es de consulta; autenticación real de clientes con cookie/credencial opaca persistida; un JWT emitido por `/api/auth/token` no reemplaza sesión. JavaScript no puede fijar libremente `Cookie`/cookies HttpOnly; no se propone cambiar CORS o controles de origen del proveedor.

## 4. Identificadores y cobertura de las operaciones actuales

Identificadores estables propuestos para el YAML canónico. Seguridad `sessionCookie` (apiKey en cookie `better-auth.session_token` en HTTP), `secureSessionCookie` (apiKey en cookie `__Secure-better-auth.session_token` cuando el baseURL configurado usa HTTPS) o `sessionBearer` (HTTP Bearer de sesión opaca, sin `bearerFormat: JWT`) son alternativas; no se exigen conjuntamente. Explicar qué variante aplica por entorno. La seguridad por rol y ámbito se documenta en descripción; OpenAPI no verifica esos roles por sí solo.

| `operationId` | Método / ruta | Permiso |
| --- | --- | --- |
| `signInEmail` | POST `/api/auth/sign-in/email` | Público |
| `signOut` | POST `/api/auth/sign-out` | Sesión vigente |
| `getSession` | GET `/api/auth/get-session` | Sesión/cuenta activa |
| `getJwks` | GET `/api/auth/jwks` | Público |
| `issueInteropToken` | GET `/api/auth/token` | Sesión/cuenta activa |
| `listAccounts` | GET `/api/v1/accounts` | ADMIN activo |
| `createAccount` | POST `/api/v1/accounts` | ADMIN activo |
| `getAccount` | GET `/api/v1/accounts/{id}` | ADMIN activo |
| `updateAccount` | PATCH `/api/v1/accounts/{id}` | ADMIN activo |
| `listAccountAudit` | GET `/api/v1/accounts/{id}/audit` | ADMIN activo |
| `demoteAccount` | PUT `/api/v1/accounts/{id}/role` | ADMIN activo |
| `deactivateAccount` | POST `/api/v1/accounts/{id}/deactivate` | ADMIN activo |
| `reactivateAccount` | POST `/api/v1/accounts/{id}/reactivate` | ADMIN activo |
| `acceptInvitation` | POST `/api/v1/account-invitations/accept` | Público, token de un uso |
| `confirmEmailChange` | POST `/api/v1/account-email-changes/confirm` | Público, token de un uso |
| `listRoleRequests` | GET `/api/v1/admin-role-requests` | Sesión; visibilidad según rol |
| `submitRoleRequest` | POST `/api/v1/admin-role-requests` | TEACHER activo |
| `approveRoleRequest` | POST `/api/v1/admin-role-requests/{id}/approve` | ADMIN activo elegible |
| `rejectRoleRequest` | POST `/api/v1/admin-role-requests/{id}/reject` | ADMIN activo elegible |
| `requestPasswordRecovery` | POST `/api/v1/auth/password-recovery/request` | Público |
| `confirmPasswordRecovery` | POST `/api/v1/auth/password-recovery/confirm` | Público, token de un uso |
| `createStudent` | POST `/api/v1/students` | TEACHER activo y grupo propio |
| `listStudents` | GET `/api/v1/students` | TEACHER activo; solo grupos propios |
| `getStudent` | GET `/api/v1/students/{id}` | TEACHER activo y estudiante propio |
| `updateStudent` | PATCH `/api/v1/students/{id}` | TEACHER activo y estudiante propio |
| `deactivateStudent` | POST `/api/v1/students/{id}/deactivate` | TEACHER activo y estudiante propio |
| `listTasks` | GET `/api/v1/tasks` | TEACHER o ADMIN activo |
| `getTask` | GET `/api/v1/tasks/{taskId}` | TEACHER o ADMIN activo |
| `listGroups` | GET `/api/v1/groups` | ADMIN todos, TEACHER propios |
| `createGroup` | POST `/api/v1/groups` | ADMIN activo |
| `getGroup` | GET `/api/v1/groups/{id}` | ADMIN o TEACHER responsable |
| `updateGroup` | PATCH `/api/v1/groups/{id}` | ADMIN; transferencia confirmada |
| `deleteGroup` | DELETE `/api/v1/groups/{id}` | ADMIN; solo curso vacío |
| `listGroupTeachers` | GET `/api/v1/groups/teachers` | ADMIN activo |
| `listGroupStudents` | GET `/api/v1/groups/{id}/students` | TEACHER responsable; ADMIN denegado |
| `createTaskAssignment` | POST `/api/v1/task-assignments` | TEACHER responsable; participación autorizada |
| `listTaskAssignments` | GET `/api/v1/task-assignments` | TEACHER responsable |
| `getTaskAssignment` | GET `/api/v1/task-assignments/{id}` | TEACHER responsable |
| `cancelTaskAssignment` | POST `/api/v1/task-assignments/{id}/cancel` | TEACHER responsable |
| `createLaunchGrant` | POST `/api/v1/task-assignment-recipients/{id}/launch-grants` | TEACHER responsable |
| `listStudentTaskSessions` | GET `/api/v1/students/{id}/task-sessions` | TEACHER responsable |
| `getTaskSession` | GET `/api/v1/task-sessions/{id}` | TEACHER responsable |
| `listTaskEvidence` | GET `/api/v1/task-sessions/{id}/evidence` | TEACHER responsable |
| `createRecoveryGrant` | POST `/api/v1/task-sessions/{id}/recovery-grants` | TEACHER responsable; misma sesión/envío |
| `retryTaskProcessing` | POST `/api/v1/task-sessions/{id}/processing-retries` | TEACHER responsable; cálculo fallido |
| `claimGameLaunch` | POST `/api/v1/game-runtime/launches/claim` | Grant supervisado, no cookie docente |
| `getRuntimeContext` | GET `/api/v1/game-runtime/sessions/{id}` | Capacidad de la sesión |
| `startGameSession` | POST `/api/v1/game-runtime/sessions/{id}/start` | Capacidad de inicio |
| `submitGameEvidence` | POST `/api/v1/game-runtime/sessions/{id}/results` | Capacidad de entrega |
| `getEvidenceReceipt` | GET `/api/v1/game-runtime/sessions/{id}/receipt` | Capacidad de acuse |

Ampliación J-02: **50 operaciones/11 tags**. Contratos 1.0 y 1.1; sin J-03.
La composición normal no concede participación: solo las pruebas aisladas inyectan
autorizaciones sintéticas. Ver `docs/integracion-play.md`.

Ampliación autorizada Cursos: 35 operaciones/9 tags. Ver `docs/feature-specs/academico/02-cursos.md`. Las exclusiones históricas de grupos HTTP que siguen no describen esta extensión.

Actualización vertical 01 (2026-10-26): 28 operaciones/8 tags con consulta de
catálogo y ficha. Las menciones de 26 operaciones anteriores describen la base 006;
no se añade CRUD, ejecución, recursos ni asignaciones de Tareas.

No documentar como disponibles registro público, operaciones administrativas del plugin, Google, login de estudiante, CRUD de grupos o tareas. El rechazo de otras rutas `/api/auth/*` es una limitación explicada, no una operación positiva del contrato.

## 5. Contrato de verificación

Se añadirá el comando `npm run docs:check`, sin BD, para las pruebas documentales y del router aislado. No inicia servidor, no importa bootstrap, no requiere secretos reales, no envía correo ni ejecuta las pruebas con truncado.

| Capa | Debe detectar |
| --- | --- |
| YAML | Sintaxis inválida y claves duplicadas. |
| Documento OpenAPI completo | Versión, estructura y referencias rotas; sin resolutores externos. |
| Reglas del catálogo | Duplicados de ID, metadatos ausentes, parámetros de ruta inconsistentes, seguridad inexistente, operación extra/faltante frente al inventario. |
| Esquemas/ejemplos | Ejemplos incompatibles de esquemas, parámetros, cabeceras y medios; no limitarse a parsear anotaciones `examples`. |
| Montaje real | Igualdad con rutas explícitas de `/api/v1/*` más las cinco permitidas de autenticación, excluyendo ALL/infraestructura/documentación; sin confiar solo en el número 26. |
| Respuestas reales | Éxito nominal de las 26 operaciones y fallos representativos aplicables; cabeceras/cookies relevantes; ningún cambio de comportamiento para ajustarlo al YAML. |
| Publicación | Mismo YAML, HTML/asset local, matriz de entorno, 404 con o sin sesión y assets bloqueados fuera de desarrollo/pruebas. |
| Navegador | Render de 26 operaciones y siete tags, expansión por dominio, cero errores de carga, referencias rotas, requests externos o ejecuciones de negocio. |

El comparador de catálogo debe probar casos negativos (añadir/quitar operación, duplicar ID), no solo que el documento de entrega pase. Las pruebas existentes de contratos históricos se mantienen como regresión; nueva evidencia canónica no cambia sus expectativas funcionales.

## 6. Cambios y errores documentales

Consumidores de mantenimiento: README, feature fuente y contexto que hoy dice erróneamente que Académico no tiene código. Actualizar esas referencias con el alcance preciso; no “aprobar” automáticamente diseños restantes.

Si se detecta contradicción de una representación, se corrige el contrato nuevo según el código/pruebas actuales y se registra el contraste. Si resolverla exigiera cambiar el negocio, detener esa parte y pedir autorización fuera de esta feature. Una prueba en rojo no autoriza a cambiar guardas o rutas para satisfacer el documento.
