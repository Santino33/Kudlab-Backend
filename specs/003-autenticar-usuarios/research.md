# Investigación técnica: autenticar usuarios

**Fecha**: 2026-10-13. **Base**: [especificación](spec.md) y código instalado de Better Auth / adaptador Drizzle 1.7.7. Las reglas de V3 RF-003 («RF corregidos», fila 4) son propuestas; A CU02 (§6.1.1, p. 31) documenta 30 min; D §§3.2, 6 (pp. 10–16) ofrece alternativas de implementación. El responsable confirmó el 2026-10-13 la semántica de inactividad y recuperación por correo/30 minutos para esta iteración; las decisiones técnicas de este documento no convierten el texto original V3 en aprobado.

## R-01 — Plataforma y mecanismo de acceso

**Decision**: Extender la aplicación existente Node.js 24/TypeScript 5.9, Hono, Better Auth 1.7.7, Drizzle/PostgreSQL, Vitest y SMTP configurado. Mantener cookie de sesión o Bearer **opaco** del plugin como credencial de la API, respaldados por sesión persistida; JWT/JWKS instalado no habilita por sí solo rutas protegidas. No añadir Google ni registro público.

**Rationale**: `package.json`, `src/auth/auth.ts`, `src/app.ts`, `src/auth/session-guard.ts` y el plan ya resuelto de [cuentas](../001-gestionar-cuentas-roles/plan.md) muestran esta decisión implementada para cuentas. Better Auth [Session Management](https://better-auth.com/docs/concepts/session-management) y [Bearer](https://better-auth.com/docs/plugins/bearer) distinguen token de sesión persistida y JWT interoperable. D §6 pp. 14–16 propone contraseña/Google y token opaco→JWT, mientras D §3.2 p. 10 propone JWT directo; se conserva la elección local de cuentas sin elevarla a exigencia de V3.

**Alternatives considered**: JWT autosuficiente (no prueba revocación inmediata), Google (requiere decisión explícita de vinculación/primer acceso), nuevo proveedor de identidad (duplicaría el actual).

## R-02 — Inactividad exacta por sesión

**Decision**: Añadir `session_activity` con clave primaria y referencia a `session.id` con borrado en cascada, `last_accepted_at` (instante UTC); inicializar al primer uso protegido exitoso, tomando `session.createdAt` como origen cuando no exista fila. Autorizar solo si `now < last_accepted_at + 30 min`; después de completar una operación protegida **aceptada** actualizar condicionalmente la marca, de forma monotónica, sin reiniciar el plazo ante denegación/error. Serializar comprobación/alta/actualización por sesión y comprobar que sigue existiendo la sesión y que cuenta/rol siguen activos. Un intento vencido se rechaza, aunque Better Auth hubiera renovado su expiración. No exponer una ruta de «touch» independiente. Mantener `expiresIn:1800`, `updateAge:60` como límite adicional, sin `cookieCache` ni `secondaryStorage`.

**Rationale**: Better Auth [Session Management](https://better-auth.com/docs/concepts/session-management#session-expiration) renueva `expiresAt` solo cuando llega `updateAge`, mientras `getSession` puede escribir incluso antes de comprobar autorización; por ello `src/auth/auth.ts` por sí solo no satisface «solo solicitud protegida aceptada» ni el instante de 30 min de FR-005. `src/db/schema/auth.ts` no contiene última actividad. A CU02 p. 31 y DBML `esquema.dbml` líneas 36–42 proponen 30 min; PUML `users-jwt-code-diagram.puml` líneas 47–57 propone sesiones independientes y no revivir una vencida. La política exacta de qué cuenta como actividad procede de `spec.md`, no de esos diagramas.

**Alternatives considered**: Usar `session.updatedAt` (también cambia por Better Auth); configurar solamente `updateAge=0` (seguirían contando lecturas de sesión/denegaciones); confiar en un contador del navegador o JWT (no protege peticiones directas).

## R-03 — Protección uniforme de inicio, consulta, cierre y recursos

**Decision**: Mantener el prefijo existente `/api/auth/*` pero permitir únicamente métodos/rutas acordados; adaptar ingreso/consulta a un contrato de identidad propia mínima con rol actual y normalizar externamente fallos de correo desconocido, contraseña errónea, PENDIENTE, INACTIVA y rol discordante a un mismo error de ingreso. Mantener `databaseHooks.session.create.before` como segunda barrera; verificar la identidad propia activa al crear sesión y en cada petición protegida. En `get-session` no devolver perfil de una cuenta inactiva ni convertir una consulta de sesión en actividad; en `sign-out` invalidar la sesión actual y no las otras; no crear una vía alternativa por rutas del plugin Admin, sign-up, change-password o revocación de terceros. Un error de almacenamiento se comunica como indisponibilidad genérica y siempre se deniega.

**Rationale**: `src/app.ts` ya restringe rutas Better Auth, pero `get-session` actualmente pasa directamente al handler; `requireActive` sí consulta ambos roles y estado. Better Auth [Email & Password](https://better-auth.com/docs/authentication/email-password#sign-in) y [Session Management](https://better-auth.com/docs/concepts/session-management#session-management) ofrecen endpoints de sign-in/sign-out; no certifican por sí mismos el estado propio Kudlab. Constitución II y IV requieren control en servidor y contrato explícito para consumidores.

**Alternatives considered**: Confiar en ocultar la UI; permitir respuesta sin filtrar de `get-session`; habilitar endpoints Better Auth no usados.

## R-04 — Recuperación verificable, revocación atómica y correo vigente

**Decision**: Usar rutas propias `/api/v1/auth/password-recovery/request` y `/api/v1/auth/password-recovery/confirm` para cuentas ACTIVAS. Generar secreto aleatorio de un solo uso y persistir solo digest, cuenta, correo confirmado al emitir, `created_at`, `expires_at` (30 minutos), `consumed_at`/`invalidated_at`; responder siempre de modo neutro por correo existente/inexistente/no activo. En canje bloquear cuenta y verificación, comparar correo vigente y estado activo, validar contraseña compartida, actualizar el hash `account(providerId=credential).password` con `hashCredentialPassword`, invalidar **todas** las sesiones y consumir verificación en la misma transacción PostgreSQL. Repeticiones/concurrencia solo permiten un canje. Reutilizar transporte SMTP configurado con mensaje de recuperación propio, `RESET_BASE_URL` apuntando al origen SPA permitido; fallos de entrega específicos se registran sin revelar existencia de cuenta en la respuesta neutra (si falla la consulta/almacenamiento para todos, 503 genérico y sin acceso). Registrar un evento de cambio sin contraseña/token.

**Rationale**: Better Auth [Email & Password](https://better-auth.com/docs/authentication/email-password#request-password-reset) proporciona reset nativo y opción `revokeSessionsOnPasswordReset`, pero no impone sin control adicional el estado/correo vigente Kudlab al **canjear** el token y requiere transacciones del adaptador para atomicidad. `src/modules/usuarios/invitations.service.ts` ya usa tokens digest y transacciones, `src/modules/usuarios/email-changes.service.ts` mantiene cambios de correo pendientes, y `src/modules/usuarios/lifecycle.service.ts` revoca sesiones. `spec.md` FR-009–011 fija el comportamiento confirmado por el responsable para esta iteración; D §6.1 p. 14 solo propone la biblioteca, no un flujo aprobado de recuperación.

**Alternatives considered**: Exponer sin filtro `/api/auth/request-password-reset` y `/reset-password` (el token podría canjearse tras desactivar/cambiar correo); sesión o contraseña temporal creada por administrador (amplía permisos); actualizar contraseña sin transacción (puede dejar sesiones válidas o token consumido sin cambio).

## R-05 — Verificación, límites y alcance

**Decision**: Contratos OpenAPI de los endpoints publicados, validación con Vitest (unitaria de frontera temporal, integración PostgreSQL/Better Auth, contratos HTTP/errores, carreras de canje/inactivación) y guía reproducible. Probar explícitamente el acceso sin sesión, inactividad a 29:59 y 30:00, dos sesiones separadas, inactivación y reactivación, cambio de rol, caída de DB/correo, token usado o vencido, correo pendiente de cambio y JWT firmado sin sesión.

**Rationale**: Constitución II, IV, V y SC-001–006 de la feature; A §3.2 pp. 16–18 y D §4 pp. 11–12 documentan metas de API p95 ≤2 s y 30 usuarios concurrentes como referencias de diseño, no criterios aprobados para login. Para este plan se propone medirlas sin convertirlas en gate de aceptación hasta validación institucional. El escenario de facilidad (<2 min, ≥90 % de 5 participantes) procede de la spec, también provisional.

**Alternatives considered**: Dar por demostrado el control temporal con `expiresIn` o con pruebas unitarias aisladas; tratar la sesión de tarea como sesión de usuario.
