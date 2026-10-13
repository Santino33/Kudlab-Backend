# Modelo de datos: cuentas y roles

**Estado**: diseño para planificar, no migración aprobada. Referencias:
`spec.md` FR-001…018; V3 RF-001 (hoja «RF corregidos», fila 2,
**propuesto**); A CU01-S1…S4 pp. 27–30; DBML líneas 5–42, 89–98;
`research.md` R-02…R-06.

## Cuenta Kudlab (`user_accounts`, propia)

| Campo | Tipo lógico | Regla |
| --- | --- | --- |
| `id` | Identificador único | Estable desde la invitación. |
| `auth_user_id` | Identificador Better Auth, opcional | Único; ausente mientras está PENDIENTE. |
| `email_normalized` | Correo institucional | Único en todo estado, incluso INACTIVA; dominio después de `@` terminado en `.edu.co` sin distinguir mayúsculas/minúsculas. |
| `pending_email_normalized` | Correo opcional | Cambio solicitado en cuenta ACTIVA, no se usa para iniciar sesión hasta verificación. |
| `full_name` | Nombre completo | Obligatorio; sin datos de estudiantes. |
| `role` | ADMIN o TEACHER | Exactamente uno; al activar, sincronizado con `user.role` de Better Auth (`admin`/`teacher`). |
| `status` | PENDIENTE, ACTIVA, INACTIVA | Estado autoritativo consultado en cada solicitud. |
| `created_at`, `updated_at` | Instantes | Nunca usar la fecha para inferir permiso. |

**Invariantes**: no acceso si `auth_user_id` es nulo, estado no ACTIVA,
rol de Better Auth distinto del rol Kudlab, o sesión revocada. Un correo
pertenece a una sola cuenta aun si la anterior se inactivó. El rol no es
array ni lista separada por comas; solo ADMIN puede gestionar cuentas.
La sincronía de dos columnas de rol existe para soportar invitaciones antes
de crear identidad Better Auth: una discrepancia deniega acceso y se investiga.

## Invitación (`account_invitations`, propia)

| Campo | Tipo lógico | Regla |
| --- | --- | --- |
| `id`, `account_id` | Identificadores | Cada invitación pertenece a una cuenta PENDIENTE. |
| `token_digest` | Resumen criptográfico | Único; el secreto en claro se entrega una vez, jamás se registra. |
| `expires_at` | Instante | `created_at` + siete días; no aceptar desde ese instante. |
| `consumed_at`, `invalidated_at` | Instantes opcionales | Uso único y revocación de anteriores al reemitir/cambiar correo. |
| `delivery_status` | PENDIENTE, ENVIADA, ERROR | Distingue alta de entrega; no informa éxito sin entrega. |
| `created_by`, `created_at` | Actor/instante | Vincula a administrador activo y registro de gestión. |

**Validación**: comparar resumen en tiempo constante, comprobar caducidad,
cuenta/correo vinculados y no consumida; una disputa de aceptación simultánea
solo permite una activación, las demás reciben conflicto. Se requiere diseño
de idempotencia/reintento y control del correo de destino.
La invitación vencida o consumida queda registrada como historial sin volver
a ser válida; no se elimina automáticamente su registro.

## Solicitud de ascenso (`admin_role_requests`, propia)

| Campo | Tipo lógico | Regla |
| --- | --- | --- |
| `id`, `requester_account_id` | Identificadores | Solicitante activo con rol TEACHER. |
| `status` | PENDIENTE, APROBADA, RECHAZADA | Una solicitud pendiente por cuenta; decisión única. |
| `requested_at` | Instante | Fecha de petición; no cambia rol. |
| `decided_by_account_id`, `decided_at` | Identificador/instante opcionales | ADMIN activo distinto del solicitante, obligatorios al decidir. |

Solo la aprobación sustituye TEACHER por ADMIN y se audita en la misma
transición; una solicitud duplicada o decidida no puede aprobarse otra vez.
El bootstrap inicial es la única excepción sin solicitud previa.

## Identidad y sesión (Better Auth, esquema generado)

- `user`: `id`, `email`, `name`, `emailVerified`, `role`, campos de Admin plugin
  (`banned`, etc.) según versión fijada. Solo existe después de aceptar
  invitación; no se usa `users.password_hash` del ERD como segunda fuente.
- `account`: credencial `providerId=credential` y hash gestionado por Better
  Auth, sin contraseñas en cuentas Kudlab ni en auditoría. La contraseña inicial
  debe tener mínimo ocho caracteres, mayúscula, minúscula y número; la misma
  regla aplica al bootstrap y aceptación de invitación.
- `session`: sesión persistida con `userId`, `token`, `expiresAt` y política de
  vigencia de autenticación. Es distinta de `task_sessions` de la batería.
- `jwks`: si se habilita `jwt()` como capacidad para terceros, generada por
  Better Auth; el JWT no sustituye `session` ni `user_accounts.status`.
- `account_email_changes` (propia): cuenta, nuevo correo único reservado,
  digest del token, caducidad y consumo; la confirmación mueve el correo
  reservado a cuenta y Better Auth en una transición auditada. Cambiar el
  correo de una cuenta PENDIENTE invalida la invitación anterior y expide otra.

**Relaciones**: `user_accounts` 0..1→1 `user` tras activación; 1→N
`account_invitations` y 1→N `admin_role_requests`; `user` 1→N `session`
y 1→N `account` de credenciales.
Better Auth administra su propio esquema generado; al fijar versión/plugins
regenerar y aplicar migraciones mediante Drizzle Kit, sin copiar a mano el ERD.

## Registro de gestión (`account_audit_events`, propio)

| Campo | Tipo lógico | Regla |
| --- | --- | --- |
| `id`, `occurred_at` | Identificador/instante | Append-only desde aplicación. |
| `actor_auth_user_id` | Identificador | Puede ser sistema al completar invitación; conservar autoría del administrador. |
| `target_account_id` | Identificador | Cuenta afectada, sin borrado físico. |
| `action` | Enum | BOOTSTRAP_ADMIN, INVITE, ACTIVATE, UPDATE, REQUEST_ADMIN, APPROVE_ADMIN, REJECT_ADMIN, ROLE_CHANGE, DEACTIVATE, REACTIVATE. |
| `before`, `after` | Datos mínimos | Solo cambios de estado/rol/correo/nombre; jamás secreto/token/hash. |

Consulta exclusiva de ADMIN autorizado. Restringir UPDATE/DELETE a rol de
aplicación y probarlo antes de afirmar inmutabilidad: el diseño ADR-04 es
adoptado en D §5 p. 13, mientras V3 D-07 aún solicita validación técnica.
Conservación indefinida de cuentas, historial de invitaciones, auditoría y
solicitudes/decisiones de ascenso: sin purga periódica ni eliminación al
inactivar al usuario. La vigencia del enlace sí termina a los siete días.

## Transiciones permitidas

```text
∅ → ACTIVA        bootstrap automático y único del ADMIN inicial, con
                    credenciales externas válidas, solo si no existe
∅ → PENDIENTE     alta ordinaria TEACHER + invitación registrada
PENDIENTE → ACTIVA  titular acepta invitación vigente, define acceso,
                    se confirma identidad + auditoría
ACTIVA → INACTIVA  administrador confirma, audita, invalida accesos
INACTIVA → ACTIVA  administrador confirma; exige nuevo inicio de sesión
```

No hay transición de cuenta inactiva a nueva identidad con el mismo correo;
no se borra histórico. TEACHER→ADMIN requiere solicitud pendiente aprobada
por otro ADMIN; una solicitud rechazada conserva el rol anterior. El arranque
repetido no crea otro ADMIN ni restablece credenciales de uno ya existente.
Degradar o inactivar al último ADMIN activo está prohibido, incluso en
solicitudes simultáneas; la regla se comprueba en la misma transición.
Una edición del correo pendiente invalida invitaciones antiguas y solicita
entrega al correo nuevo; para cuenta activa, verificar el nuevo correo y
mantener denegado el acceso con ese correo hasta confirmación.

## Consistencia y autorización

1. Un cambio de estado/rol y su auditoría deben confirmar juntos o no confirmar;
   usar una transacción Drizzle sobre datos propios y columnas de Better Auth
   cuando el esquema/adapter permita actualizar el mismo PostgreSQL. En cambio
   de rol denegar mientras se reconcilia cualquier discrepancia.
2. En inactivación, confirmar bloqueo autoritativo, auditoría y eliminación o
   vencimiento de sesiones en la misma base; al renovar, una sesión anterior no
   revive. El plugin `banUser`/`unbanUser` puede reforzar el inicio de sesión;
   no debe ser la única comprobación de estado.
3. La creación de `user` vía `auth.api.createUser` y la auditoría propia pueden
   no compartir transacción pública. Mantener estado PENDIENTE hasta completar;
   si falla después de crear identidad, denegar acceso e investigar/reintentar
   sin duplicar usuario. Una operación incompleta no se presenta como exitosa.
4. Proteger también el ingreso de Better Auth: una cuenta no ACTIVA no recibe
   acceso utilizable. El mecanismo de hook para impedir crear sesión, y la
   posibilidad de transacción compartida, deben verificarse con la versión
   instalada antes de implementar; la guardia de cada ruta es obligatoria.

**Configuración operativa**: `.edu.co`, contraseña mínima y siete días ya
están definidos por el usuario. Credenciales concretas del ADMIN inicial,
proveedor de correo, remitente y URL se reciben fuera del repositorio; no
usar contraseñas o enlaces predefinidos. La retención es indefinida.
