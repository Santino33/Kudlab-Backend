# Modelo documental (sin cambios de persistencia)

Estado: diseño de documentación de la API, no nuevas entidades de base de datos. Fuente de reglas: [spec.md](spec.md) y [inventory.md](inventory.md); código base `096a8fa`. Los registros de estudiantes son gestionados por profesores, no actores autenticados.

## 1. Catálogo actual

- `openapi`: `3.1.0`, consistente con los contratos actuales.
- `info`: título, versión documental inicial `0.1.0` y descripción de alcance/estado. La versión documental no acredita despliegue.
- `servers`: URL relativa `/`, sin hosts reales ni entornos productivos precargados.
- `tags`: `Acceso`, `Cuentas`, `Invitaciones`, `CambiosCorreo`, `SolicitudesRol`, `Recuperacion`, `Estudiantes`.
- `paths`: exactamente las 26 combinaciones método/ruta del inventario contrastado; no incluye los recursos documentales ni rutas futuras.
- `components`: esquemas reutilizables, errores, parámetros y seguridad. Referencias internas al mismo archivo, sin dependencias remotas.

Relación: un catálogo contiene muchas operaciones; cada operación referencia cero o más esquemas y alternativas de seguridad. El archivo canónico futuro es `docs/api/openapi.yaml`; el endpoint lo entrega sin alterar su contenido ni generar un segundo contrato.

## 2. Operación documentada

| Campo | Reglas |
| --- | --- |
| método + ruta | Clave única; parámetros OpenAPI `{id}` corresponden a `:id` del router; normalizar únicamente barra final para comparación. |
| `operationId` | Único y estable en todo el catálogo; identifica la operación, no la implementación interna. |
| `summary`, `description`, `tags` | Obligatorios; propósito, límites, normalización y efectos observables. |
| `parameters` | Declarar ubicación, nombre, obligatoriedad, tipo, restricciones, valores por defecto y ejemplos aplicables. No inventar filtros. |
| `requestBody` | Solo cuando existe una entrada requerida por el contrato; diferenciar ausencia de cuerpo, cuerpo ignorado y cuerpo explícitamente prohibido. |
| `responses` | Al menos éxito nominal; errores realmente aplicables con código, esquema, ejemplo y condición. Cabeceras relevantes explícitas. |
| `security` | Pública explícita `[]` o alternativas de sesión persistida; permisos de rol/ámbito descritos además del transporte de credencial. |

No crear una seguridad HTTP JWT genérica que prometa acceso al negocio con el JWT de interoperabilidad. Los tokens de invitación, correo y recuperación son campos de petición de un solo uso, no esquemas de sesión.

## 3. Esquemas de intercambio existentes

| Entidad documental | Campos y relaciones | Reglas a conservar |
| --- | --- | --- |
| `Account` | `id,name,email,role,status,createdAt`; opcionales `pendingEmail,deliveryStatus,invitationExpiresAt` | ID de cuenta de negocio distinto de identidad; alta solo TEACHER/PENDIENTE. |
| `AccountPage` | `items:Account[]`, `total`, `limit`, `offset` | limit 1–100 default20; offset≥0 default0; filtro status solo donde existe. |
| `Identity` | `id,email,name,role` | Vista filtrada del personal, sin contraseña, credenciales o campos del proveedor no expuestos. |
| `SessionView` | `user:Identity`, `session:{id,expiresAt}` | ID interno de sesión no equivale a su credencial ni al token de interoperabilidad. |
| `RoleRequest` | `id,requesterAccountId,status,requestedAt`; opcionales `decidedByAccountId,decidedAt` | Array en listado; ADMIN ve pendientes, TEACHER propias. |
| `AuditEvent` | `actorId,targetId,action,occurredAt`; snapshots `before/after` opcionales | Array sin envoltorio; snapshots solo campos realmente expuestos. |
| `Student` | `id,groupId,studentCode,firstName,lastName,isActive` | Seis propiedades; sin datos de consentimiento, credenciales ni identidad del profesor. |
| `StudentList` | `items:Student[]` | Incluye activos e inactivos de grupos propios; sin total, paginación o filtros. |
| `UserError` | `code,message,fields?` | `fields` es array de `{field,reason}` si existe. No obligarlo en todos los 400. |
| `AcademicError` | `code,message,fields?` | `fields` es objeto de campos permitidos a motivos seguros; no fusionarlo con el array de Usuarios. |
| `ProviderError` | Forma exacta del proveedor donde se delega sin adaptación | No convertir a `UserError` respuestas que `auth.handler` devuelve directamente. |

Las vistas públicas de JWKS y token se fijan según Better Auth 1.7.7, configuración real y `src/app.ts`; ver [research.md](research.md). JWKS devuelve `{keys:[…]}` con `kid,kty,alg` por clave y parámetros públicos dependientes del tipo (Ed25519 por defecto); token devuelve `{token:string}`. Son representaciones de protocolo ya disponibles, no nuevas credenciales aceptadas por rutas de negocio. La cookie de sesión se llama `better-auth.session_token` con baseURL HTTP y `__Secure-better-auth.session_token` con baseURL HTTPS; ambas variantes se explican sin exigirlas juntas.

## 4. Validación de entradas y ejemplos

- Usuarios: nombre recortado 1–200, correo `.edu.co` normalizado, rol literal TEACHER en creación; actualización con al menos nombre o correo. Password al fijarla: 8–128 y mayúscula/minúscula/número. Login: email válido, password no vacío y `rememberMe` boolean opcional; no trasladar reglas de alta al parser de login.
- Estudiantes: UUID de grupo en alta; código recortado de 1–50 puntos de código Unicode y nombres de 1–100, sin NUL. PATCH no vacío solo con código/nombres; grupo/ID/estado no editables. Alta fija inactivo; inactivación exige cuerpo de longitud cero.
- Consultas: cuentas acepta limit/offset/status; estudiantes rechaza cualquier query. ID estudiantil inválido, ajeno o ausente produce 404 equivalente.
- Ejemplos: UUID ficticios válidos y nombres como `Docente Ejemplo` o `Participante Ficticio`; correos sintéticos compatibles con `.edu.co`, identificados expresamente como no operativos y nunca utilizados para envíos. Contraseñas de ejemplo exclusivamente ficticias; marcadores opacos nunca activos. No capturar respuestas con credenciales reales para construir ejemplos.
- Ajv2020 verifica esquemas y ejemplos donde corresponda; no imponer `additionalProperties:false`, `required` o límites que el código no exige. Esquemas de respuesta solo cierran propiedades si la representación real lo justifica.

## 5. Transiciones existentes que deben explicarse, no implementarse

| Flujo | Transición / efecto observable |
| --- | --- |
| Cuenta invitada | PENDIENTE→ACTIVA al aceptar invitación válida; token de siete días, un uso. |
| Cuenta activa | ACTIVA→INACTIVA y revocación de sesiones; reactivar no las restaura; se protege último ADMIN activo. |
| Cambio de correo activo | Correo nuevo pendiente→confirmado mediante token de siete días; revoca sesiones al confirmar. |
| Solicitud de ascenso | PENDIENTE→APROBADA/RECHAZADA; solo decisión ADMIN elegible, sin auto-decisión; aprobación cambia rol. |
| Descenso | ADMIN activo→TEACHER mediante operación específica; protección de último administrador. |
| Recuperación | Token de 30 minutos disponible→consumido; petición posterior invalida anteriores; confirmar cambia password y revoca sesiones, sin login automático. |
| Estudiante | Alta `isActive:false`; actualización conserva grupo/estado; inactivación fija false y es idempotente; no hay activación pública. |
| Recursos documentales | Disponibles solo con entorno explícito development/test; resto 404. No estado por usuario ni transición persistida. |

## 6. Sin modelo nuevo de negocio

No tablas, índices, migraciones, colas ni cambios de persistencia. Grupos se mencionan únicamente para explicar entradas y ámbito ya implementados; no se crea un contrato HTTP de grupos. Consentimientos, notas, juegos, tareas e indicadores quedan fuera del catálogo disponible.
