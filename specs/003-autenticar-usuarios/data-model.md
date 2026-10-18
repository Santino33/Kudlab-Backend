# Modelo de datos: autenticación del personal

**Fuente funcional**: [spec.md](spec.md) FR-001–012. **Diseño elegido**: [research.md](research.md). El ERD/DBML original (`docs/original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml`, líneas 26–42) es una propuesta; las tablas concretas siguientes siguen el esquema existente de este repositorio, no se fusionan con `user_sessions` del ERD.

## Cuenta de personal y credencial (existentes)

- `user_accounts`: `id` UUID PK; `auth_user_id` FK única a `user.id` (nulo solo en PENDIENTE); `email_normalized` único, `pending_email_normalized` opcional, `role` ADMIN/TEACHER, `status` PENDIENTE/ACTIVA/INACTIVA, datos personales mínimos y fechas. Autoridad para estado y rol de negocio.
- `user` Better Auth: `id` texto PK, `email` confirmado para acceso, `role` (`admin`/`teacher`), `banned`, demás columnas generadas. No hay `user` para cuenta pendiente; para ACTIVA/INACTIVA debe existir identidad vinculada con rol equivalente. Si no concuerdan `user` y `user_accounts`, no se autentica ni autoriza.
- `account` Better Auth: `userId` FK, `providerId='credential'`, `password` (hash, nunca texto claro). Solo una credencial de este proveedor por identidad de personal. Correo pendiente de cambio no es correo de acceso/recuperación hasta que se confirme en cuentas.
- Validación: el correo vigente pertenece a la cuenta y cumple `.edu.co`; una nueva contraseña tiene longitud 8–128 e incluye mayúscula, minúscula y dígito (la longitud superior procede de la validación existente). Una cuenta reactivada mantiene identidad pero no recupera sesiones.

## Sesión de usuario (existente)

- `session`: `id` texto PK, `token` único y opaco, `user_id` FK a `user.id`, `expires_at`, `created_at`, `updated_at`; cada fila representa una sesión separada. Better Auth gestiona alta/cierre y expiración propia. No se acepta JWT de `/api/auth/token` como sesión de `/api/v1/*`.
- Verificación: antes de acceder a recursos protegidos, exigir fila válida más cuenta ACTIVA y rol correspondiente; si falla DB, no permitir acceso. El cierre elimina la sesión actual; inactivación o recuperación válida eliminan todas las sesiones del titular. Una sesión de tarea es otra entidad del módulo Tareas.

## Actividad de sesión (nueva)

| Campo | Tipo y regla | Uso |
| --- | --- | --- |
| `session_id` | texto PK, FK `session.id` ON DELETE CASCADE | Una marca opcional por sesión persistida; nunca sobrevive a revocación. |
| `last_accepted_at` | timestamp with time zone NOT NULL | Fin de la última solicitud protegida aceptada; solo se actualiza tras éxito. |

- Si falta la marca, la referencia de inactividad es `session.created_at` (no `updated_at`, que Better Auth modifica también al consultar sesión). En el primer éxito se inserta la marca; fallos no insertan ni renuevan.
- Expiración: en el instante `now >= reference + interval '30 minutes'` se rechaza. Una actualización concurrente debe ser monotónica (`greatest`); la condición de vigencia se evalúa con lectura serializada por `session_id` y se confirma que la sesión y cuenta siguen vigentes. No admitir actualización de una sesión eliminada por cierre/inactivación.
- Better Auth `expires_at` sigue siendo una condición adicional; una consulta `get-session` puede actualizarlo, pero no afecta `last_accepted_at`. No usar cookie cache ni almacenamiento alterno de sesión.

## Verificación de recuperación (nueva)

| Campo | Tipo y regla | Uso |
| --- | --- | --- |
| `id` | UUID PK | Identificador interno. |
| `account_id` | UUID FK `user_accounts.id`, no nulo | Cuenta emisora; nunca puede pertenecer a cuenta sin identidad activa en emisión/canje. |
| `email_normalized` | texto no nulo | Copia del correo de acceso al emitir; debe seguir coincidiendo al canjear. |
| `token_digest` | texto único no nulo | Resumen del secreto aleatorio; el texto de enlace no se guarda. |
| `created_at` | timestamptz no nulo | Momento de emisión. |
| `expires_at` | timestamptz no nulo; exactamente 30 minutos después | A partir de ese instante no canjeable. Confirmado por el responsable para esta iteración el 2026-10-13. |
| `consumed_at` | timestamptz nullable | Canje único exitoso. |
| `invalidated_at` | timestamptz nullable | Invalidez por nueva emisión o cambio de correo/estado cuando corresponda. |

Índice por `(account_id, created_at)` para invalidar emisiones anteriores; índice único por digest. La solicitud genera enlace solo para cuenta ACTIVA cuyo correo confirmado coincide con identidad Better Auth, entrega al correo vigente y da respuesta neutra aun si no existe. No registrar el token ni contraseña en auditoría ni en respuestas públicas. Una incidencia de correo no habilita el enlace a un tercero ni se anuncia como entrega exitosa; una nueva solicitud puede emitir uno nuevo e invalidar los antiguos.

### Transiciones de recuperación

`EMITIDA` (`consumed_at=null`, `invalidated_at=null`, ahora < `expires_at`) → `CONSUMIDA` tras verificación, contraseña válida, actualización de hash y borrado de sesiones en **una transacción**. `EMITIDA` → `VENCIDA` por tiempo o `INVALIDADA` por sustitución; ninguna transición inversa. Si contraseña no cumple política o transacción falla, sigue EMITIDA mientras aún no vence. Si la cuenta pasa a INACTIVA o el correo confirmado cambia, un canje antiguo falla aunque todavía no tenga `invalidated_at`.

## Transiciones relacionadas y límites de atomicidad

- Inicio: PENDIENTE/INACTIVA/no concordante → ninguna sesión; ACTIVA + credenciales y rol concordantes → nueva `session` con origen temporal `created_at`.
- Uso: VIGENTE y cuenta ACTIVA → comprobación de permisos (responsabilidad docente en otro módulo); solo respuesta protegida aceptada → actualizar marca. VENCIDA/CERRADA/INACTIVA → denegar sin datos, sin actividad nueva.
- Cierre: eliminar una sola sesión, marca propia en cascada; demás sesiones permanecen.
- Inactivación existente (`src/modules/usuarios/lifecycle.service.ts`): actualiza cuenta, identidad, sesiones y auditoría en transacción. Reactivación no recrea sesiones.
- Recuperación: adquirir bloqueo de cuenta y verificación con orden constante, validar correo/estado vigentes, actualizar hash y revocar todas las sesiones antes de marcar canje consumido dentro de la misma transacción. Evento de auditoría PASSWORD_RESET con titular y fecha, sin valor anterior/nuevo de credencial.

**Consumidores**: cliente SPA para ingreso/cierre/recuperación; `src/auth/session-guard.ts` y rutas `/api/v1/*` para verificación; módulo Cuentas para inactivación/correo/rol; Académico para autorización adicional sobre estudiantes/grupos. Contrato HTTP: [auth.openapi.yaml](contracts/auth.openapi.yaml).
