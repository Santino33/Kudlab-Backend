# Investigación técnica: gestionar cuentas y roles

**Fecha**: 2026-10-12 | **Fuentes Better Auth**: Better Auth y
`@better-auth/drizzle-adapter` **1.7.7**, fijados en `package-lock.json`.
El índice `/llms.txt` identifica la serie 1.7.x como `latest`; se consultaron
por MCP las páginas versionadas `latest` de Admin, opciones, base de datos,
adaptador Drizzle, Bearer y JWT para cotejar `databaseHooks.session.create.before`,
`createUser`, el esquema generado y el uso de sesiones persistidas. El CLI
`auth` también se fija en 1.7.7. `npm run auth:generate` generó `user`,
`session`, `account`, `verification` y `jwks` (incluye `alg` y `crv`).

## R-01 — Stack y límites de esta feature

**Decision**: Usar Node.js 24 LTS/TypeScript, Hono, Better Auth 1.7.x,
Drizzle/PostgreSQL y, para interoperabilidad, JWT/JWKS + `jose`. Separar
Usuarios (este repositorio) de la SPA React/Vite; R2 corresponde a evidencias
de consentimiento y recursos de juegos, no a cuentas.

**Rationale**: El usuario pidió utilizar el stack resumido en
`docs/agent-context/architecture-summary.md`. En el diseño original
`docs/original/DESCRIPCIÓN DE DISEÑO DE SOFTWARE.docx.pdf`, §6.1–6.4,
pp. 14–16, figura como «uso propuesto», no como instalación. A CU01,
`docs/original/3 ANALISIS DEL PROYECTO.docx.pdf` pp. 27–30, define los flujos;
V3 `docs/original/requisitos_V3.xlsx`, «RF corregidos» fila 2, RF-001, dice
«Propuesto - corregido para validación». Esta elección explícita de stack no
convalida automáticamente los RF ni las políticas institucionales.

**Alternatives considered**: NestJS/TypeORM/Prisma y MySQL de diagramas/diseño
alterno: descartados para esta feature por indicación expresa del usuario.

## R-02 — Better Auth y rol único

**Decision**: Configurar Better Auth con Admin plugin, `admin` para ADMIN y
un rol custom `teacher` para TEACHER. Combinar `defaultStatements` y
`adminAc.statements` al redefinir admin; dar a `teacher` cero permisos de
gestión. Mientras la cuenta está pendiente, `user_accounts.role` indica el
rol previsto; después de activarla, `user.role` de Better Auth es el rol
efectivo y la copia de Kudlab debe coincidir o se deniega acceso. Las rutas
propias solo reciben uno de esos valores y rechazan listas/roles separados
por comas. No exponer al cliente las acciones del
plugin Admin directamente: las rutas Kudlab comprueban estado, autorización,
autopromoción y auditoría y hacen las llamadas servidoras autorizadas.
Crear la primera cuenta ADMIN mediante bootstrap operativo controlado antes
de habilitar invitaciones; vincular su `user.id` Better Auth a una cuenta
Kudlab ACTIVA y auditar la inicialización. Ejecutarlo automáticamente al
primer arranque, con correo `.edu.co` y contraseña válidos aportados fuera
del repositorio; no publicar ruta de bootstrap ni duplicar/reinicializar el
ADMIN en arranques posteriores. Las altas ordinarias son solo TEACHER.

**Rationale**: Admin plugin incluye `auth.api.listUsers`, `auth.api.getUser`,
`auth.api.adminUpdateUser`, `auth.api.setRole`, `auth.api.banUser`,
`auth.api.unbanUser` y `auth.api.revokeUserSessions`; acepta varios roles por
defecto y `admin` tiene permisos amplios. `esquema.dbml` líneas 5–7 y 26–33
propone un rol único; el responsable del proyecto confirmó esa cardinalidad.
No se puede confiar solo en un control visual de roles, ni dejar disponibles
los endpoints `/api/auth/admin/*` para que eludan las reglas de negocio.

**Alternatives considered**: Usar rol propio como autoridad independiente de
Better Auth habilitaría desincronización sin denegación segura. Permitir roles
múltiples contradice la decisión de la feature. Usar `admin.createUser` en
alta pendiente requeriría contraseña al crear y no implementa invitación.

**Docs**: [Admin plugin](https://better-auth.com/docs/plugins/admin).

## R-03 — Invitación sin registro público

**Decision**: `emailAndPassword.enabled = true`, `disableSignUp = true` y
alta de una invitación **propia** en una transacción con estado PENDIENTE;
la cuenta de Better Auth aún no se crea. Entregar un enlace de un solo uso
con secreto aleatorio, conservando solo su resumen y expiración siete días
después de emitirse. Cuando la persona acepta desde el correo destinatario
y define su contraseña, validar token, plazo, correo `.edu.co`, rol TEACHER
y contraseña de mínimo ocho caracteres con mayúscula, minúscula y número;
usar desde servidor
`auth.api.createUser({body:{email,name,password,role}})` y dejar la cuenta
habilitada únicamente después de la auditoría y confirmación de activación.
`createUser` requiere contraseña; no se la solicita al administrador.

**Rationale**: El Admin plugin no implementa invitación global pendiente.
`organization.inviteMember` corresponde a membresías de organización y
exige flujo diferente; `requestPasswordReset` es para usuarios existentes,
no para invitación pendiente. Verificación de correo nativa no sustituye
validar un token propio ni asegura por sí sola bloquear ingreso social.
Bloquear rutas de registro público y de gestión Admin en el handler antes
de montar `/api/auth/*`; permitir solo flujos de autenticación configurados
y evaluar esta intercepción con pruebas de integración en versión fijada.

**Failure handling**: Alta pendiente/invitación/auditoría se escriben juntos;
fallo de correo mantiene invitación PENDIENTE, con entrega pendiente y
reintento controlado (no informar «enviada» si falló). La creación de
credencial Better Auth y la transacción de activación pueden no compartir
una transacción garantizada por la API pública. Si falla la activación después
de crear credencial, el estado autoritativo sigue PENDIENTE, toda solicitud
protegida se deniega y el canje se puede reintentar/reconciliar sin duplicar
cuenta ni gastar el token antes de terminar. No se promete atomicidad cruzada
sin probarla en la implementación.

**Alternatives considered**: Contraseña provisional y correo de reset crean
identidades antes de la invitación; requiere ban/sincronización y permite
confundir reset con activación. Organización añade modelo de membresía ajeno.

**Docs**: [Admin createUser](https://better-auth.com/docs/plugins/admin#create-user),
[Email & Password](https://better-auth.com/docs/authentication/email-password),
[Email verification](https://better-auth.com/docs/concepts/email),
[Organization invitations](https://better-auth.com/docs/plugins/organization#invitations).

## R-04 — Sesión actual, Bearer y JWT/JWKS

**Decision**: Sesión persistida Better Auth en PostgreSQL; sin `cookieCache`,
sin sesión stateless ni secondary storage. Cliente SPA puede usar cookie de
sesión o `bearer()` con token **opaco de sesión** para `/api/v1/*` y
`auth.api.getSession({headers})`. En cada solicitud, consultar además estado
Kudlab y rol Better Auth vigentes; si no concuerdan, denegar. Para integración
futura con otros servicios se puede habilitar `jwt()` con `/api/auth/token`,
`/api/auth/jwks` y `jose` verificando firma/issuer/audience/vigencia, pero
JWT **nunca** se acepta en esta API como permiso sin consultar estado y sesión
vigentes: una firma válida no prueba que no se inactivó al titular.

**Rationale**: Better Auth documenta que el cache cookie puede mantener
sesiones revocadas en otros dispositivos hasta `maxAge`. El JWT plugin está
orientado a servicios externos, no reemplaza la sesión; el token Bearer de
`bearer()` no es su JWT. V3 RF-001 y A CU01-S4 exigen inactivación efectiva
sin esperar 15/30 minutos. Ajustar expiración deslizante de sesión a 30 min
según A CU02 p. 31/D §4 p. 12 cuando se planifique autenticación.

**Alternatives considered**: Solo JWT firmado o cookie cache: no cumplen
revocación inmediata. Usar `jose` en todas las operaciones sin consultar
sesión/estado tampoco. Servir JWT para terceros no equivale a autorizar
operaciones propias; mientras no existan consumidores externos, mantener
su emisión restringida o diferida.

**Docs**: [Session management](https://better-auth.com/docs/concepts/session-management),
[Bearer](https://better-auth.com/docs/plugins/bearer),
[JWT](https://better-auth.com/docs/plugins/jwt),
[Hono integration](https://better-auth.com/docs/integrations/hono).

## R-05 — Inactivación, cambios de rol y auditoría

**Decision**: Estado de negocio PENDIENTE/ACTIVA/INACTIVA en almacenamiento
autoritativo con unicidad por correo, vinculado a `user.id` Better Auth tras
activación. La autorización siempre consulta el estado y rol actual. Cambios
de rol/estado y registro de auditoría deben tener un punto de confirmación
único y fallar cerrados. `banUser` + `revokeUserSessions` y `unbanUser` son
mecanismos del plugin útiles para inactivación/reactivación, **no** sustituyen
el estado propio. Coordinar los cambios del plugin con el estado/auditoría;
ante fallo de revocación no confirmar operación exitosa y mantener el
acceso bloqueado por el guardia propio. Degradar o inactivar al último ADMIN
activo debe fallar en una comprobación coherente incluso con concurrencia.
TEACHER→ADMIN requiere solicitud
propia y aprobación explícita de un ADMIN activo distinto; ni `setRole`
directo ni el alta ordinaria pueden eludirla. Conservar los registros y las
decisiones de ascenso indefinidamente, sin purga automática.

**Rationale**: A CU01-S1…S4, pp. 27–30 exige historia y reversión ante fallo;
D ADR-04 p. 13 declara bitácora inmutable pero V3 D-07 (hoja «Decisiones y
pendientes», fila 8) pide probar garantía técnica antes de declararla. Plan
debe validar con prueba que el rol de aplicación no puede alterar auditoría;
traza actor, objetivo, antes/después y fecha, sin credenciales ni tokens.

**Alternatives considered**: Solo `banUser` pierde estado PENDIENTE y auditoría
de negocio; solo revocar sesiones no bloquea futuros accesos. Secuencia
simple `setRole` + `revokeUserSessions` sin comprobación por solicitud crea
ventana de permisos obsoletos.

**Docs**: [Admin plugin](https://better-auth.com/docs/plugins/admin),
[Session management](https://better-auth.com/docs/concepts/session-management).

## R-06 — Persistencia, Hono, pruebas y políticas faltantes

**Decision**: Conservar esquema de Better Auth generado según versión fijada;
usar `drizzleAdapter(db,{provider:"pg",schema})`, generar migraciones con
Drizzle Kit y aplicar un solo flujo de migraciones. Hono enruta
`app.all('/api/auth/*', c => auth.handler(c.req.raw))`; declarar CORS de
origen confiable y `trustedOrigins` antes de montar handler, sin consumir
el cuerpo antes de Better Auth. Vitest + PostgreSQL para pruebas de permisos,
concurrencia y transiciones.

**Rationale**: El ERD original presenta `users.password_hash` y `user_sessions`,
pero Better Auth administra `user`, `account` (hash de credenciales) y `session`;
no crear dos tablas de contraseñas. El adaptador Drizzle exige generación del
esquema y migración propia (no asumir que `auth migrate` lo aplica).

**Alternatives considered**: SQL manual para duplicar esquema auth y usar
`auth migrate` sobre Drizzle: riesgo de drift. Hono sin origen controlado:
incompatible con sesión cross-origin segura.

**Docs**: [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle),
[Hono integration](https://better-auth.com/docs/integrations/hono).

**Decisiones del responsable del proyecto**: correo con dominio terminado en
`.edu.co`, contraseña de al menos ocho caracteres con mayúscula/minúscula/número,
invitación válida siete días, ascenso solicitado por el titular y aprobado
por otro ADMIN, administrador inicial automático y registros sin caducidad.
Provienen del usuario, no del RF-001 V3 aún propuesto. Proveedor/remitente
de correo, URL y credenciales concretas del bootstrap son configuración por
entorno; no hay secretos predeterminados en el código. Metas de 30 concurrentes
y p95 ≤2s (A §3.2 pp. 16–18) son referencias hasta validación del piloto.
