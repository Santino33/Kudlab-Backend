# Modelo de datos: sin cambios

El refactor reorganiza servicios; **no introduce entidades, campos, validaciones, relaciones, migraciones ni transiciones nuevas**. La línea base es `src/db/schema/` y las especificaciones vigentes de cuentas, validación y autenticación. Las siguientes relaciones y transiciones ya existen y deben conservarse:

| Entidad o relación actual | Comportamiento que se preserva |
| --- | --- |
| Cuenta de usuario e identidad autenticada | Una cuenta vinculada a su identidad mantiene correo, nombre, rol y estado coherentes. Las comprobaciones de cuenta activa y rol siguen precediendo el acceso. |
| Invitación y cuenta pendiente | La emisión, entrega, consumo, invalidación y activación respetan las mismas verificaciones y auditoría existentes. |
| Solicitud de cambio de correo y cuenta | La solicitud/confirmación conserva reserva del correo, vigencia del token, estado, actualización de identidad y revocación de sesiones existentes. |
| Solicitud de ascenso y cuenta | Los cambios de pendiente a aprobada/rechazada y los permisos efectivos siguen sujetos a elegibilidad, decisión autorizada y registro de auditoría. |
| Verificación de recuperación, credencial y sesión | El token de un solo uso, cambio de contraseña e invalidación de sesiones conservan las mismas condiciones y el mismo orden de confirmación. |
| Registro de auditoría | Mantiene actor, acción y cambios de las operaciones que ya lo registran; fallos no confirman cambios parciales. |

**Verificación**: comparar transiciones válidas e inválidas, simultaneidad, efectos y registros con la línea base, sin reescribir datos persistidos. Véase [quickstart.md](quickstart.md) y [contracts/current-interfaces.md](contracts/current-interfaces.md).
