# Modelo de datos e invariantes: validar perfil y acceso

**Estado**: diseño incremental sobre 001; no implica migraciones nuevas por sí mismo. Fuente funcional: `spec.md` FR-001…FR-009; fuentes originales V3 RF-002 fila 3 y RF-004 fila 5 (propuestas), A CU01-S1/S2 pp. 27–29 y CU03 p. 32. Fuente de las reglas concretas: decisiones de `specs/001-gestionar-cuentas-roles/spec.md`. Referencias técnicas: `src/db/schema/accounts.ts`, `src/auth/auth.ts` y [modelo de 001](../001-gestionar-cuentas-roles/data-model.md).

## Cuenta del personal (`user_accounts`, existente)

| Dato | Validación/relación | Comportamiento |
| --- | --- | --- |
| `id`, `auth_user_id` | Identificador propio y enlace opcional a `user` de Better Auth | Identidad propia estable; PENDIENTE no tiene identidad activa. |
| `full_name` | Texto no vacío tras eliminar espacios de borde; regla funcional de 001/002 | Cambio válido mantiene el resto, incluidos permisos e historial. |
| `email_normalized` | Correo de dominio terminado exactamente en `.edu.co`, minúsculas; único sin distinción de estado | Nunca disponible por inactivación; duplicidad concurrente se rechaza. |
| `pending_email_normalized` | Reserva opcional con mismas reglas; no es correo de acceso | Cuenta ACTIVA conserva el correo actual hasta confirmación del titular. |
| `role` | Un valor entre ADMIN y TEACHER | Alta ordinaria TEACHER; incompatibilidad con rol de identidad impide acceso. |
| `status` | PENDIENTE, ACTIVA o INACTIVA | Solo ACTIVA puede operar, siempre tras comprobar sesión y rol vigentes. |

`account_email_changes` reserva el nuevo correo de ACTIVA y exige confirmación; `account_invitations` reemplaza enlaces de PENDIENTE al modificar correo. La reserva, la asignación actual y el flujo de cambio de correo comparten las restricciones de unicidad existentes; la verificación de la disponibilidad **no** se basa en una lectura previa sin protección de concurrencia. En un PATCH con nombre y correo, los datos se validan antes de cambios y el cambio inicial de nombre/reserva de correo se confirma íntegramente o no se confirma. La confirmación posterior del correo es una transición separada, iniciada por el titular.

## Credencial e invitación (existentes)

| Dato | Relación/invariante |
| --- | --- |
| Contraseña de `account` Better Auth | En entrada debe tener ≥8 caracteres e incluir mayúscula, minúscula y número; nunca devolver ni auditar valor, hash o token. |
| `account_invitations` | Vínculo de una cuenta PENDIENTE al correo destinatario; contraseña rechazada no consume invitación. |
| `account_email_changes` | En cuenta ACTIVA, verificación del correo nuevo antes de cambiar la identidad; un enlace no válido no mueve el correo. |

Cambiar/restablecer contraseñas es responsabilidad de la feature de autenticación: debe consumir la misma regla de credenciales y aplicar comprobaciones de titularidad antes de modificar una credencial. No existe en este diseño un mecanismo nuevo de recuperación que presuma ya verificada la identidad.

## Sesión/actor y solicitud protegida (datos transitorios)

| Dato | Origen | Regla |
| --- | --- | --- |
| Identidad/sesión de personal | Better Auth persistido (`user`, `session`) | Sesión opaca válida; un JWT firmado no equivale a acceso activo. |
| Cuenta/rol/estado actuales | `user_accounts` y `user.role` | Consultar en cada solicitud; discrepancia, cuenta INACTIVA o PENDIENTE → denegación. |
| Operación y objetivo | Ruta de cuentas o recurso protegido del consumidor | No decidir permiso usando el rol declarado por el cliente. |
| Ámbito solicitado | ID de grupo/estudiante y filtros del consumidor | Comprobar por asignación real del actor antes de leer o escribir; filtro arbitrario no da permiso. |

## Responsabilidad docente (contrato, no tabla nueva)

Académico será propietario del vínculo vigente docente↔grupo/estudiante y ofrecerá una decisión comprobable al consumidor de recursos. El módulo Usuarios ofrece identidad/estado/rol vigentes pero **no** infiere un grupo desde la cuenta ni mantiene una segunda fuente de asignaciones. Si el vínculo no existe, está revocado, el objetivo no pertenece al actor o la comprobación falla, se deniega. Para consultas/listados, cada registro o conjunto visible debe pertenecer al ámbito verificado: un filtro manipulado no amplía el resultado. La interface prevista consta en [scope-authorization.md](contracts/scope-authorization.md), pendiente de concretar con Académico antes de implementar rutas de estudiantes.

## Transiciones y consistencia

```text
Cuenta nueva válida → PENDIENTE + invitación propia de 001
PENDIENTE: correo corregido → nuevo correo vigente + invitación anterior invalidada
ACTIVA: correo solicitado → correo vigente sin cambio + nuevo correo reservado
ACTIVA: titular confirma reserva válida → nuevo correo vigente + sesiones anteriores revocadas
PENDIENTE/ACTIVA: nombre válido → nombre actualizado; rol, estado e historial intactos
Dato inválido, correo reclamado o actor sin permiso → ninguna transición
```

Los eventos auditados de 001 conservan actor y estado pertinente sin credenciales; los rechazos de entrada no se convierten en actualizaciones parciales. La autorización de estudiantes nunca se confirma hasta integrar un proveedor real de asignaciones y su consumidor; este modelo no promete accesos mientras falten.
