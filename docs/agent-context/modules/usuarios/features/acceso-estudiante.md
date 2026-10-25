# Propuesta de feature: operaciones del docente sobre estudiantes

**Estado y propósito:** propuesta surgida de esta iteración; no es un RF aprobado ni una funcionalidad implementada. Permitir que un docente autenticado use los endpoints de Académico para operar sobre registros de estudiantes que están dentro de su ámbito. En esta feature, «acceso» significa acceso del docente a operaciones sobre datos de estudiantes, **no inicio de sesión ni acceso a la plataforma por parte del estudiante**.

## Decisión de dominio: estudiante no es usuario del sistema

El estudiante es un registro académico y sujeto de los datos, no un actor que interactúa con la aplicación. El docente realiza todas las operaciones mediante su propia sesión autenticada. El estudiante no tiene cuenta, credenciales, rol, sesión de usuario, token ni mecanismo de recuperación. No se crea una identidad de autenticación para el estudiante ni se reutiliza o comparte la sesión del docente como si fuera una sesión del estudiante.

La autorización se decide a partir de la identidad autenticada del docente y su relación con el grupo; nunca a partir de una credencial presentada por el estudiante. `student_code` identifica un registro según el ERD, pero no se trata como secreto, contraseña ni prueba de identidad. Las referencias a estudiante que ejecute tareas o «se identifique con código» en diagramas/contexto no cambian esta decisión para esta feature: la ejecución de tareas queda fuera de alcance y no se especifica aquí ningún flujo interactivo del estudiante.

## Alcance y límites

- **Incluye:** endpoints de Académico para registrar, consultar, actualizar e inactivar estudiantes, según las operaciones que se confirmen para esta feature; validación del docente autenticado y de su ámbito; validación de campos y unicidad de `student_code`; persistencia de la relación estudiante-grupo y su estado activo/inactivo.
- **No incluye:** login/identificación del estudiante, cuentas infantiles, credenciales o sesiones de estudiante; asignación o ejecución de tareas, intentos, sesiones/eventos de tarea; gestión de consentimiento o sus archivos; operaciones de cuentas/roles del personal. Estas responsabilidades están fuera de esta feature y se especifican por separado.
- Las operaciones son sobre registros académicos. Que un estudiante esté activo no implica que tenga una sesión o permiso de usuario. Cualquier regla que condicione una operación académica al consentimiento debe definirse en la feature de consentimiento y aplicarse donde corresponda; esta propuesta no introduce tablas ni comportamiento de tareas para resolverlo.

## Referencia de datos: ERD original y base implementada

El modelo original es una propuesta, no el esquema actualmente implementado: [ERD PlantUML](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/ERD-plantuml.puml) y [DBML](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml). Para este alcance, el ERD propone:

| Entidad | Atributos/referencia del ERD | Uso en esta feature |
| --- | --- | --- |
| `groups` | `id`, `teacher_id`, `name`, `grade`, `school_year` | Define el ámbito académico y el docente responsable. |
| `students` | `id`, `group_id`, `student_code` único, `first_name`, `last_name`, `is_active` | Registro operado por el docente; `group_id` lo vincula al ámbito. |

La base actual (`src/db/schema/` y `src/db/migrations/`) implementa cuentas del personal en `user_accounts`, identidad/sesiones Better Auth en `user`/`session` y tablas auxiliares de cuentas. No implementa `groups` ni `students` (tampoco consentimiento o entidades de tareas). Por tanto, esta feature requiere incorporar las dos entidades académicas anteriores; no requiere cambiar el modelo de autenticación ni crear una tabla de usuario para estudiante.

**Ajuste necesario por la implementación real:** el ERD dibuja `groups.teacher_id` relacionado con `users.id`, pero la implementación actual representa la cuenta de negocio del docente como `user_accounts.id`, vinculada a Better Auth por `auth_user_id`. Al implementar `groups`, su FK debe apuntar a `user_accounts.id` para representar al docente existente, sin duplicar usuarios ni apuntar directamente a la identidad interna de autenticación. El tipo físico de esa FK debe coincidir con el UUID de `user_accounts.id`. Esta adaptación conserva la relación conceptual del ERD (un docente tiene grupos) sin copiar literalmente un nombre de tabla que no existe en la implementación.

Fuera de esas dos tablas y su FK, no se propone en esta feature implementar `informed_consents`, `task_assignments`, `task_sessions` ni `raw_events`. Aunque aparecen en el ERD y pueden depender de estudiantes, no son necesarias para las operaciones académicas aquí delimitadas.

## Flujo y reglas esperadas

1. El docente inicia sesión usando la autenticación existente; el endpoint recibe la solicitud dentro de esa identidad autenticada. Una solicitud sin sesión válida se rechaza.
2. El servidor obtiene la cuenta/rol del docente y valida en servidor que la operación esté permitida. No confía en un `teacher_id` enviado por el cliente para decidir el ámbito.
3. Para crear un estudiante, valida los campos acordados, que el grupo exista y pertenezca al docente, y que `student_code` no esté ya registrado conforme a la regla de unicidad adoptada. La escritura asocia el registro al grupo autorizado.
4. Para consultar, actualizar o inactivar, el servidor comprueba que el estudiante pertenece a un grupo bajo responsabilidad del docente. Un UUID conocido, parámetro manipulado o llamada directa a la API no permite operar sobre un estudiante de otro docente.
5. Un estudiante inactivo permanece como registro consultable/modificable solo según las reglas de operación que se acuerden; no se interpreta como cuenta bloqueada ni como sesión revocada. La semántica exacta de reactivación e inactivación debe confirmarse con la feature de mantenimiento académico.
6. Errores de autorización, ámbito, validación o persistencia no deben producir cambios parciales ni exponer datos de un estudiante fuera del ámbito. Los contratos de rutas y códigos HTTP no se fijan aquí mientras no estén definidos por el proyecto.

## Criterios de verificación

- Un docente autenticado puede operar únicamente sobre estudiantes de sus grupos autorizados.
- Un docente distinto no puede consultar, actualizar ni inactivar el registro, incluso manipulando identificadores o invocando directamente el endpoint.
- La creación valida la pertenencia del grupo y rechaza un `student_code` duplicado conforme a la unicidad definida.
- Las operaciones no crean ni buscan una cuenta/sesión del estudiante; el actor auditado/autorizado es el docente.
- El estado `is_active` pertenece al registro académico y no se confunde con el estado de `user_accounts` ni con una sesión de autenticación.

## Decisiones pendientes antes de especificar contratos

Confirmar campos obligatorios y normalización de `student_code`; unicidad global o con otro alcance si se decide apartarse del ERD (que lo dibuja único); operaciones exactas expuestas por estos endpoints; comportamiento de actualización, inactivación/reactivación y consulta de inactivos; reglas de auditoría; y si la relación docente-grupo permitirá más de un responsable o conservará la cardinalidad 1:N del ERD. La especificación de consentimiento y sus consecuencias permanece en [Académico/consentimiento](../../academico/features/consentimiento.md); esta feature no anticipa su modelo ni incorpora tareas.
