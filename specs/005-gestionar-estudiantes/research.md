# Research: operaciones del docente sobre estudiantes

Fecha: 2026-10-23. Alcance: resolver el diseño de la feature 005 sin implementar código ni ampliar sus operaciones.

## 1. Modelo académico mínimo

**Decision**: Agregar `groups` y `students`, preservando campos y tipos del ERD/DBML, y enlazar `groups.teacher_id` a `user_accounts.id`. Registrar los esquemas en el cliente Drizzle existente y generar una migración aditiva con su snapshot/journal.

**Rationale**: Las dos entidades faltan en la implementación; el ámbito necesita grupo y responsable. La cuenta de negocio existente tiene UUID y representa al docente. Ver [source-context.md](source-context.md) para pasajes originales y contraste comprobado.

**Alternatives considered**: Crear `users` duplicaría la identidad existente; enlazar directamente a Better Auth acoplaría el dominio académico a su identificador interno; agregar credenciales infantiles contradice FR-001. No se agregan timestamps, documentos de identidad ni tablas auxiliares no exigidas.

## 2. Integridad, normalización y unicidad

**Decision**: Campos obligatorios `NOT NULL`; UUID con generación por servidor; longitudes originales; `is_active NOT NULL DEFAULT false`; FK sin borrado en cascada. Índices en `groups.teacher_id` y `students.group_id` y restricción única global sobre código con comparación determinista sensible a mayúsculas (collation PostgreSQL `C` para `student_code`). Validar longitudes en puntos de código Unicode, no bytes ni unidades UTF-16, y recortar espacios externos antes de escribir. Nombres aceptan Unicode sin regex restrictiva al alfabeto latino.

**Rationale**: Mantiene fidelidad al ERD y explicita la nulabilidad ausente según FR-003/004. La restricción única es la autoridad ante carreras; una búsqueda previa no basta. La collation determinista conserva `abc` distinto de `ABC`, sin añadir campos de normalización.

**Alternatives considered**: Unicidad por grupo, índices parciales de activos o lowercase contradicen el código global definido en la spec. No se usa `citext`. Un fallo de unicidad solo se traduce a conflicto cuando corresponde a la restricción del código, no a cualquier error de base.

## 3. Autorización y concurrencia

**Decision**: Reutilizar autenticación vigente y la frontera `authorizeScope` con un proveedor implementado en Académico. Para cada lectura, restringir la consulta mediante join estudiante → grupo → cuenta vigente con `teacher_id` de la identidad autenticada. Listar siempre con ese filtro, nunca recuperar todo y filtrar en memoria. Ejecutar autorización, operación y registro de actividad aceptada en una misma transacción; bloquear cuenta responsable `FOR SHARE`, identidad de autenticación `FOR SHARE`, sesión `FOR UPDATE`, grupo `FOR SHARE` y, para escrituras existentes, estudiante `FOR UPDATE`, en ese orden, revalidando rol/estado y relación antes de escribir. No emplear una decisión antigua del proveedor como autorización suficiente para una escritura posterior.

**Rationale**: Cierra la ventana entre autorización y uso; cambios de rol/estado o de responsable no pueden intercalarse en mitad de la escritura autorizada. Los errores o ausencia de proveedor siguen denegando. Los bloqueos se liberan por commit/rollback; el diseño no añade gestión de grupos ni modifica los bloqueos de cuentas existentes.

**Alternatives considered**: Confiar en `teacher_id` del cuerpo o autorizar solo en UI permite acceso ajeno. Consultar existencia global antes de ámbito filtra menores. Crear un rol de estudiante es incompatible. Las escrituras y cambios de cuenta simultáneos se ordenan por transacción: si el cambio de cuenta se confirma primero, la escritura debe denegarse; una escritura ya autorizada puede terminar antes del cambio bloqueado.

## 4. Estado y consentimiento

**Decision**: Alta inactiva; edición solo código/nombres/apellidos; operación de inactivación idempotente. No exponer activación, reactivación o borrado. No añadir un CHECK que impida permanentemente almacenar activos: la futura gestión de consentimiento necesitará habilitarlos legítimamente.

**Rationale**: Respeta el principio II sin introducir gestión de consentimiento. El estado del estudiante no es estado de usuario. Datos activos para pruebas se preparan solo en la base aislada.

**Alternatives considered**: Alta activa o edición genérica de `isActive` elude la constitución; crear consentimiento ficticio amplía alcance y falsea evidencia.

## 5. Grupos y preparación operativa

**Decision**: No exponer gestión de grupos ni crearlos automáticamente. Pruebas con fixtures idempotentes en PostgreSQL aislado; antes de un despliegue real, la persona responsable de datos debe preparar grupos y vincularlos a docentes existentes por un procedimiento operativo revisado.

**Rationale**: FR-012 excluye gestión de grupos, pero la tabla es necesaria para autorización. La API funciona con un ámbito vacío devolviendo lista vacía.

**Alternatives considered**: Incluir endpoints CRUD de grupos o crear un grupo por estudiante ampliaría la feature. No introducir un script de carga productiva con datos inventados. La preparación real es requisito de despliegue, no una incógnita del diseño de los endpoints.

## 6. Stack y contratos

**Decision**: Extender el backend y convenciones existentes, sin nuevas dependencias ni cambios al login. Diseñar cinco operaciones REST bajo `/api/v1/students`, documentadas en [contracts/students-api.md](contracts/students-api.md). Respuestas con datos camelCase y errores de dominio neutrales; integrar el tratamiento de errores al patrón actual sin romper rutas existentes.

**Rationale**: Se trata de una extensión del backend implementado, no de resolver nuevamente las alternativas históricas del diseño. El cliente del docente es consumidor nuevo; Usuarios mantiene sus contratos.

**Alternatives considered**: Rutas en cuentas del personal confunden dominios; usar claves de sesión nuevas contradice la spec. Una lista completa sin paginación mantiene el alcance pequeño del piloto; no se agregan filtros avanzados ni paginación contractual en esta iteración.

## 7. Verificación y calidad

**Decision**: Unitarias de validación y ámbito; contratos HTTP; integración con PostgreSQL real migrado para FK, unicidad, rollback y carreras; regresión completa de Usuarios. No declarar los criterios de éxito ejecutados durante planificación. No convertir objetivos históricos de latencia/capacidad en SLA nuevos.

**Rationale**: Mocks no prueban semántica de transacciones ni unicidad concurrente. La matriz cubre los seis SC y los doce FR; la spec no aprobó un umbral temporal nuevo.

**Alternatives considered**: SQLite o pruebas solo en memoria no representan PostgreSQL. Añadir tablas genéricas de auditoría o medir tareas no es necesario para esta feature.

## Cierre

Sin incógnitas técnicas bloqueantes ni marcadores de aclaración abiertos. Los defaults funcionales de la spec siguen siendo propuestas revisables, no políticas institucionales ratificadas. No se modifica la constitución ni se inspecciona una base productiva.

## 8. Carrera del middleware de actividad — resolución de diseño

**Evidence**: `src/auth/session-guard.ts`, líneas 23–26, ejecuta el handler antes de `recordAcceptedRequest`; si este devuelve false, sustituye el éxito por 401. `src/auth/session-activity.ts`, líneas 42–60, inicia su propia transacción. Reutilizar sin cambios ese montaje permitiría un rechazo HTTP después de un commit académico y contradice FR-009.

**Decision**: Extraer de `requireActive` una preparación compartida de identidad/sesión que no tenga efecto posterior al handler; mantener `requireActive` como wrapper con exactamente su comportamiento previo para Usuarios. El guard académico usa la preparación compartida, exige Docente antes de validar el cuerpo y pasa IDs de cuenta, identidad y sesión al servicio. Extraer una variante interna transaccional de `recordAcceptedRequest`, reutilizada por el wrapper existente sin cambiar su contrato. El servicio académico la llama al final de su transacción; un false lanza error y revierte la escritura, no confirma primero. Verificar además vencimiento absoluto de la sesión y consistencia de identidad dentro de esa transacción. Lecturas exitosas usan el mismo mecanismo de aceptación; solicitudes rechazadas no renuevan actividad.

**Rationale**: Reutiliza reglas de autenticación sin duplicarlas ni cambiar sus plazos; preserva contratos anteriores y evita un `401` posterior a un commit en las nuevas rutas. No guardar tokens ni contexto en estudiantes. Preparar el DTO y completar validación antes del commit; después no efectuar pasos de autorización capaces de reemplazar la respuesta.

**Alternatives considered**: Usar directamente `requireActive` en las escrituras deja la carrera abierta; ignorar el fallo de actividad concede acceso vencido; cambiar globalmente cuándo se registra actividad puede alterar la feature 003. La pérdida de conexión HTTP después de commit no se puede deshacer: no se equipara a un rechazo del servidor, y un reintento de alta con el mismo código devuelve conflicto sin duplicar.

**Validation**: Carrera de expiración/cierre antes del registro final: rollback sin cambio y sin nueva actividad aceptada. Si la operación obtiene bloqueos y confirma primero, la revocación se aplica después; el orden de commit determina el resultado. Regresión obligatoria de inactividad, sesión revocada, cambio de rol y recuperación en Usuarios tras la extracción, incluyendo carreras/deadlocks con los bloqueos actuales.

## 9. Precisión comprobada durante implementación

Lifecycle/promoción bloquean identidad antes de actualizar cuenta; edición/recuperación pueden hacer lo contrario. Académico mantiene cuenta→identidad→sesión→grupo→estudiante, pero toma el bloqueo compartido de identidad con `NOWAIT` para cortar la inversión y responder 503 con rollback ante contención, sin cambiar Usuarios. Cuenta y sesión permiten espera normal, de modo que solicitudes simultáneas de la misma sesión se serialicen. Se comprobó con transacción real que mantiene bloqueada la identidad y con barreras para cierre/revalidación antes y después de tomar los bloqueos. Ver `validation.md`.
