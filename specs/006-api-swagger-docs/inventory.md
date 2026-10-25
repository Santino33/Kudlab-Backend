# Inventario contrastado y decisiones de alcance

Fecha: 2026-10-25. Base de código: `096a8fa` (`origin/main` al crear el worktree). Estado: evidencia por lectura de código y pruebas, no certificación de ejecución ni despliegue. Las operaciones descritas ya existen; el catálogo OpenAPI consolidado y la UI aún no están implementados.

## Fuentes y precedencia

- Requisito directo: `docs/agent-context/modules/usuarios/features/documentacion-api-swagger.md`, copiado con autorización desde el worktree original; propuesta de feature, no prueba de implementación.
- Aclaraciones del responsable en esta conversación: incluir Usuarios y las cinco operaciones de estudiantes realizadas por profesores; habilitar `/docs` y `/openapi.yaml` solo en desarrollo/pruebas. Decisiones de alcance confirmadas; aprobación global de la spec pendiente.
- Montaje y lista blanca: `src/app.ts`, líneas 24–94. Routers, servicios y validadores de `src/modules/usuarios/` y `src/modules/academico/students/` determinan contratos observables. Guardas en `src/auth/` y `src/modules/academico/shared/academic-auth.ts` determinan seguridad.
- Referencias auxiliares: `specs/001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml`, `specs/002-validar-perfil-acceso/contracts/validation.openapi.yaml`, `specs/003-autenticar-usuarios/contracts/auth.openapi.yaml`, `specs/004-refactor-servicios-usuarios/contracts/current-interfaces.md`, `specs/005-gestionar-estudiantes/contracts/students-api.md`. Los tres YAML declaran OpenAPI 3.1.0 y condición propuesta/planificada: no prueban por sí solos disponibilidad.
- Contexto consultado: `docs/agent-context/{INDEX,project-context,architecture-summary,decisions,unresolved-issues}.md`, resumen de Usuarios y constitución 1.1.0. No se incorporan nuevas reglas derivadas de fuentes originales históricas; el requisito procede del usuario y la evidencia de funcionamiento del código.

## Inventario cerrado de operaciones (26)

Rutas normalizadas sin barra final; parámetros `{id}` equivalen a `:id`. Éxito indicado es el nominal, no una promesa de éxito ante sesión revocada o fallo técnico. Los errores aplicables se completarán por operación desde validadores, servicios, guardas y respuestas del proveedor, sin distribuir indiscriminadamente todos los códigos a todas las rutas.

| # | Método y ruta | Seguridad / entrada principal | Éxito y observaciones contrastadas |
| --- | --- | --- | --- |
| 1 | POST `/api/auth/sign-in/email` | Pública; JSON estricto `email`, `password`, `rememberMe?` | 200 identidad filtrada; cookie y/o `set-auth-token`; 400 entrada, 401 credenciales uniforme, 503 fallo. |
| 2 | POST `/api/auth/sign-out` | Sesión vigente; cliente puede omitir cuerpo | 200 `{success:true}` del proveedor; invalida la sesión presentada; 401/503 en envoltorio. |
| 3 | GET `/api/auth/get-session` | Sesión y cuenta activas | 200 `{user,session}`; no renueva actividad protegida; 401/503. |
| 4 | GET `/api/auth/jwks` | Pública, delegada al plugin JWT | Claves públicas de verificación, no credenciales privadas; forma exacta y fallos se contrastarán con Better Auth 1.7.7. |
| 5 | GET `/api/auth/token` | Sesión persistida activa, no JWT aislado | JWT de interoperabilidad delegado al plugin; 401/503 del control previo; confirmar forma/cabeceras/errores del proveedor instalado. |
| 6 | GET `/api/v1/accounts` | ADMIN activo; `limit`, `offset`, `status?` | 200 `{items,total,limit,offset}`; limit 1–100 default 20, offset ≥0 default 0. |
| 7 | POST `/api/v1/accounts` | ADMIN; `name`, `email`, `role:TEACHER` | 201 cuenta PENDIENTE y estado de invitación; no contraseña administrativa. Fallo de entrega puede seguir a creación persistida. |
| 8 | GET `/api/v1/accounts/{id}` | ADMIN; ID de cuenta de negocio | 200 cuenta; 404 ausencia/ID inválido según mapper. |
| 9 | PATCH `/api/v1/accounts/{id}` | ADMIN; `name?`, `email?`, al menos uno | 200 cuenta; correo pendiente puede emitir nueva invitación, correo activo requiere confirmación. |
| 10 | GET `/api/v1/accounts/{id}/audit` | ADMIN | 200 array de eventos; comprueba existencia de cuenta primero. |
| 11 | PUT `/api/v1/accounts/{id}/role` | ADMIN; `{role:TEACHER}` | 200 cuenta; solo descenso de ADMIN activo; protege último administrador con 409 `LAST_ADMIN`. |
| 12 | POST `/api/v1/accounts/{id}/deactivate` | ADMIN; `{confirm:true}` | 200 cuenta; transición ACTIVA→INACTIVA; revoca sesiones; último ADMIN protegido. |
| 13 | POST `/api/v1/accounts/{id}/reactivate` | ADMIN; `{confirm:true}` | 200 cuenta; transición INACTIVA→ACTIVA; no restaura sesiones previas. |
| 14 | POST `/api/v1/account-invitations/accept` | Sin sesión; `token`, `password` | 200 `{status:ACTIVA}`; token de un uso, siete días; 410 `INVITATION_EXPIRED`, 409 `ACCOUNT_CONFLICT`, validación/fallos aplicables. |
| 15 | POST `/api/v1/account-email-changes/confirm` | Sin sesión; `token` | 200 `{verified:true}`; consume token de siete días y revoca sesiones; 410 `TOKEN_EXPIRED`, 409 conflicto, validación/fallos aplicables. |
| 16 | GET `/api/v1/admin-role-requests` | Sesión activa | 200 array; ADMIN ve pendientes, TEACHER ve solicitudes propias. |
| 17 | POST `/api/v1/admin-role-requests` | TEACHER activo; no cuerpo consumido por router | 201 solicitud; ADMIN no puede solicitar ascenso; conflicto si restricción impide duplicación. |
| 18 | POST `/api/v1/admin-role-requests/{id}/approve` | ADMIN; no cuerpo consumido por router | 200 solicitud; prohíbe autoaprobación, exige elegibilidad actual; 404/409 según estado. |
| 19 | POST `/api/v1/admin-role-requests/{id}/reject` | ADMIN; no cuerpo consumido por router | 200 solicitud; exige elegibilidad actual y no decidir solicitud propia; 404/409 según estado. |
| 20 | POST `/api/v1/auth/password-recovery/request` | Pública; `email` institucional | 202 mensaje neutro; enlace de 30 min solo si corresponde; fallo de envío no revela cuenta ni garantiza entrega. |
| 21 | POST `/api/v1/auth/password-recovery/confirm` | Sin sesión; `token`, `newPassword` | 200 `{success:true}`; consume verificación y revoca sesiones; no login automático; 410 `VERIFICATION_EXPIRED`, 400 contraseña inválida. |
| 22 | POST `/api/v1/students` | TEACHER, grupo propio; `groupId`, `studentCode`, `firstName`, `lastName` | 201 Student con `isActive:false`; sin credenciales estudiantiles. |
| 23 | GET `/api/v1/students` | TEACHER; sin query | 200 `{items:Student[]}` de grupos propios, activos e inactivos, orden ID ascendente; sin paginación. |
| 24 | GET `/api/v1/students/{id}` | TEACHER; estudiante propio | 200 Student; ID malformado/ajeno/ausente → mismo 404. |
| 25 | PATCH `/api/v1/students/{id}` | TEACHER; uno o más de `studentCode`, `firstName`, `lastName` | 200 Student; no cambia grupo, ID o estado; comprueba ámbito antes de validar contenido detallado. |
| 26 | POST `/api/v1/students/{id}/deactivate` | TEACHER; cuerpo longitud cero | 200 Student inactivo; idempotente; sin borrado ni activación. |

Las rutas protegidas de Usuarios tienen 401/403 y errores de validación/negocio/infraestructura según el caso; las de estudiantes tienen 400/401/403/404/409/503 únicamente cuando la condición sea aplicable. No se documenta un 409 de código duplicado en una simple lectura.

## Restricciones y representaciones relevantes

- Usuarios: `accounts.validation.ts` exige nombre recortado 1–200, correo institucional terminado en `.edu.co` normalizado a minúsculas, y contraseña 8–128 con mayúscula/minúscula/número al fijarla. El login solo exige email válido y contraseña no vacía; no trasladar allí restricciones de creación. Incluye `rememberMe` opcional, omitido por el contrato histórico.
- Cuenta: `id,name,email,role,status,createdAt` y opcionales `pendingEmail,deliveryStatus,invitationExpiresAt`, según `accounts.service.ts`. Estado/rol y enums se contrastan con `accounts.types.ts` y esquemas actuales; no exponer identidad interna ni token de invitación.
- Solicitud: `id,requesterAccountId,status,requestedAt` y opcionales `decidedByAccountId,decidedAt`. Auditoría es array con `actorId,targetId,action,occurredAt` y snapshots `before/after` opcionales; no inventar envoltorios.
- Errores de Usuarios: `accounts.errors.ts` produce `{code,message,fields?}`; `fields` es array de `{field,reason}` cuando aplica. Errores SQL 23505→409 y 22P02→404; no prometer detalle de campo siempre.
- Estudiante: solo `id,groupId,studentCode,firstName,lastName,isActive`. Código recortado 1–50 puntos Unicode; nombres recortados 1–100; prohíbe NUL y claves desconocidas. Query siempre rechazado tras guarda; UUID malformado de `groupId`→400, ID de ruta inválido→404. `academic.errors.ts` usa `fields` como objeto de campo→motivo, no array. Duplicación de código global, incluidos inactivos,→409 sin revelar titular.
- Seguridad: `prepareActive` resuelve sesión persistida y cuenta concordante; Bearer admitido por plugin significa token opaco de sesión, no JWT. Inactividad de 30 min comprobada en servidor (`session-activity.ts`). No afirmar que `rememberMe` elimina este control. `requireTeacher` rechaza ADMIN antes de operar sobre estudiantes. La propiedad usa ID de cuenta de negocio, no ID interno Better Auth.
- Rutas del proveedor: solo las cinco de la lista blanca de `app.ts`. Resto de `/api/auth/*`→403 y no catálogo positivo. No habilitar registro público, Google, operaciones administrativas del plugin ni generación OpenAPI del proveedor a través del wildcard.

## Discrepancias documentales y resolución

| Fuente | Diferencia observada | Resolución acordada / acción documental |
| --- | --- | --- |
| Feature fuente §Buenas prácticas 7 | Enumera estudiantes junto a rutas no implementadas | Aclaración del usuario: incluir las cinco operaciones montadas; estudiantes no son usuarios ni operadores. Corregir referencia al consolidar documentación. |
| `architecture-summary.md` §Estado y README | Describen Académico como diseño sin código | No usar como inventario actual; actualizar la afirmación durante la entrega documental sin anunciar otros recursos académicos. |
| Contratos YAML 001/002/003 | Encabezados propuestos/planificados aunque partes tienen código y pruebas | Conservar trazabilidad histórica; catálogo actual derivado de código, no copia o cambio global de estado. |
| `auth.openapi.yaml` | No lista `/jwks`, `/token` ni `rememberMe` | Lista blanca y parser de `app.ts` prevalecen; incluirlos y verificar proveedor 1.7.7. |
| Feature fuente §Fuera de alcance | Dice no añadir endpoints, pero pide publicar UI y contrato | Usuario autoriza únicamente los recursos documentales `/docs` y `/openapi.yaml`, no nuevos endpoints de negocio. |
| Dependencias | Hay YAML, Ajv y pruebas de contrato; no Swagger UI ni validador completo identificado | Mantener formato 3.1/YAML; elegir publicación/validación mínimas compatibles en plan, sin refactor de routers ni asumir que Ajv por sí solo valida todo OpenAPI. |

## Verificación existente y límites

Referencias leídas: `tests/contract/accounts-openapi.test.ts`, `authentication.test.ts`; también existen `accounts-create-list`, `accounts-update-role`, `accounts-lifecycle`, `password-recovery`, `students-api` bajo `tests/contract/`, y pruebas de integración de autenticación/límites. Las pruebas existentes son evidencia de intención/cobertura, no resultados ejecutados en Specify. El test de inventario de cuentas comprueba un subconjunto, no igualdad con todas las rutas de la aplicación.

En implementación se contrastarán todas las entradas, respuestas/cabeceras y errores del catálogo, incluidos detalles delegados a Better Auth 1.7.7 (`jwks`, `token`, cierre, cookies y Bearer), contra proveedor instalado y ejecución aislada. No se inventan ahora formas exactas del proveedor no verificadas; esa comprobación es una obligación de FR-005/006/013, no autorización para habilitar más rutas.

La revisión Specify no instaló dependencias, no ejecutó pruebas que accedan a BD ni modificó código. No hay OpenAPI consolidado ni UI creados en esta fase. Publicación explícita solo para desarrollo/pruebas; producción o entorno no habilitado →404. La implementación debe indicar cómo declarar el entorno local porque los scripts actuales no fijan `NODE_ENV`.
