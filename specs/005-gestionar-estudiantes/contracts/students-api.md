# Contrato HTTP: operaciones sobre estudiantes

Estado: contrato implementado y probado localmente, no despliegue productivo. Consumidor: cliente del docente; proveedor: Académico. No cambia los contratos de Usuarios. Vinculado a FR-001–012 de [spec.md](../spec.md).

## Reglas comunes

- Prefijo `/api/v1/students`; JSON con nombres camelCase y `Content-Type: application/json` para cuerpos no vacíos.
- Autenticación: sesión persistida válida de Better Auth por los mecanismos actualmente aceptados por el backend; un JWT firmado aislado no basta. Cuenta activa con rol `TEACHER`. El estado y la identidad se verifican antes de ofrecer diagnósticos sobre campos.
- No se acepta identidad docente en cuerpo, ruta o query. Propiedad de grupo se resuelve con `currentAccount.id`, no con el ID interno de Better Auth.
- Cuerpos estrictos: claves desconocidas, null, tipos incorrectos o JSON malformado → 400. Strings se recortan por extremos; no se cambia caso, acentos o ceros iniciales. Límites en puntos de código Unicode: código 1–50, nombres/apellidos 1–100.
- UUID de ruta malformado, estudiante ajeno o inexistente → mismo 404 y cuerpo. Para alta, grupo ajeno o inexistente → ese mismo 404. `groupId` malformado en el cuerpo → 400 por formato, sin consulta de existencia.
- Rechazos no persisten cambios ni renuevan actividad. Escrituras y aceptación final de sesión son atómicas; ver research §8. No se garantiza entrega de la respuesta si la red falla después de commit.
- No hay endpoints de activación, borrado, grupos, tareas ni consentimiento.

## Representación `Student`

Objeto sin envoltorio `{ data: ... }`:

```json
{
  "id": "3a92e0d8-f29d-4d53-8b61-d757fb248d1d",
  "groupId": "7f839162-c71a-4b17-8e1f-2463c628a40b",
  "studentCode": "0001-A",
  "firstName": "María",
  "lastName": "Pérez",
  "isActive": false
}
```

Solo se devuelven estas seis propiedades. No incluir responsable de otro grupo, tokens, correo docente, campos internos de autenticación ni datos de consentimiento.

## Operaciones

| Método y ruta | Entrada | Éxito | Ámbito y efecto |
| --- | --- | --- | --- |
| `POST /api/v1/students` | `groupId`, `studentCode`, `firstName`, `lastName`, todos obligatorios | 201 + `Student` | `write` al grupo propio; crea ID y `isActive=false`. |
| `GET /api/v1/students` | Sin parámetros de consulta | 200 + `{ "items": Student[] }` | Solo grupos propios; incluye inactivos; orden estable por `id` ascendente. Vacío: `{ "items": [] }`. |
| `GET /api/v1/students/:id` | ID en ruta | 200 + `Student` | `read` al estudiante propio. |
| `PATCH /api/v1/students/:id` | Uno o más de `studentCode`, `firstName`, `lastName` | 200 + `Student` | `write` al estudiante propio; conserva ID, grupo y estado. |
| `POST /api/v1/students/:id/deactivate` | Sin cuerpo (longitud cero) | 200 + `Student` con `isActive=false` | `write` al estudiante propio; idempotente, conserva datos. |

Para POST de alta y PATCH, rechazar cualquier `id`, `groupId` no permitido en PATCH, `teacherId`, `isActive` o dato de credencial, incluso si su valor coincide con el actual. PATCH vacío se rechaza. El alta tampoco acepta `isActive=false`: el estado lo fija el servidor. La inactivación rechaza cuerpo no vacío. Todas las operaciones rechazan query parameters no definidos con 400, después de validar sesión/rol; no hay parámetros de paginación, filtros o expansión en esta iteración.

La colección no usa un target ficticio en `authorizeScope`: revalida cuenta/rol y aplica directamente el join restringido por responsable. No se agregan totales o paginación que puedan filtrar registros ajenos. La autorización por recurso antecede a la validación detallada de PATCH para no ofrecer diagnósticos de un registro ajeno; alta valida el formato mínimo de `groupId` antes de comprobar el ámbito y luego valida el resto.

## Errores

Formato compatible con el backend:

```json
{ "code": "NOT_FOUND", "message": "Recurso no encontrado" }
```

| HTTP | `code` | Mensaje | Condición |
| --- | --- | --- | --- |
| 400 | `INVALID_INPUT` | `Datos inválidos` | Cuerpo/query no permitido, formatos o límites inválidos; puede incluir `fields`. |
| 401 | `UNAUTHENTICATED` | `Sesión requerida` | Sin sesión persistida utilizable, vencida o cerrada. |
| 403 | `FORBIDDEN` | `Acceso denegado` | Cuenta no activa, identidad inconsistente o rol distinto de Docente. |
| 404 | `NOT_FOUND` | `Recurso no encontrado` | Recurso/grupo inexistente o fuera de ámbito; ID de ruta malformado. |
| 409 | `CONFLICT` | `Código de estudiante no disponible` | Código idéntico globalmente ocupado, incluido inactivo; sin titular ni grupo. |
| 503 | `UNAVAILABLE` | `Servicio no disponible` | No se pudo completar verificación/persistencia por fallo técnico. |

La contención del bloqueo de identidad puede devolver 503 seguro y sin cambios confirmados. El cliente puede reintentar; un fallo de red después del commit es distinto y se debe reconciliar mediante consulta/código único.

No confundir fallo técnico verificable con recurso ajeno: ambos deniegan y no exponen datos; la infraestructura puede informar 503, nunca conceder permiso. Si la frontera existente reduce una comprobación fallida a denegación, responder 404 sin intentar una consulta global de existencia.

`fields`, cuando corresponda, es objeto de nombres de campo permitidos (`groupId`, `studentCode`, `firstName`, `lastName`) a un motivo seguro: `required`, `invalid_type`, `invalid_format`, `too_long`. Para valor vacío tras trim usar `required`. No incluir valores recibidos, rutas internas ni información de menores; las claves desconocidas pueden causar 400 sin reflejarlas. Cuerpos y mensajes de 404 deben ser idénticos en los casos comparados.

Implementar errores de Académico con mapper propio compatible con `{code,message,fields?}`, no lanzar una clase nueva esperando que el `fail` actual la reconozca. No convertir todo `23505` en conflicto de código sin comprobar la restricción; errores inesperados se neutralizan como 503.

## Matriz de verificación contractual

- Todos los endpoints: sin sesión, cuenta inactiva, Administrador, grupo ajeno, identidad vigente; autorización previa a diagnósticos de campos cuando corresponda.
- Lista: vacía y dos docentes con dos grupos cada uno, activos/inactivos; cero registros ajenos.
- Alta/PATCH: límites Unicode, ceros iniciales, mayúsculas distintas, duplicado en inactivo/grupo ajeno, concurrencia y rollback de otros campos.
- PATCH: código actual válido, estado/grupo/ID inmutables, cuerpo vacío/unknown rechazado.
- Inactivación: repetición y conservación de datos; cuenta/sesión docente sin cambios de ciclo de vida.
- Respuestas neutrales ante UUID malformado, inexistente o ajeno; campos seguros sin eco de datos.
- Expiración/revocación antes de aceptación final: rechazo sin escritura confirmada, sin reactivar sesión. Ninguna operación crea cuentas o sesiones para estudiantes.
