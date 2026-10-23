# Feature Specification: Operaciones del docente sobre estudiantes

**Feature Branch**: Sin rama asociada; directorio independiente de la rama (`005-gestionar-estudiantes`).

**Created**: 2026-10-23

**Status**: Draft — decisiones de dominio y alcance confirmadas en la sesión; supuestos funcionales pendientes de revisión del responsable.

**Input**: User description: "Utiliza el documento de acceso-estudiante para hacer la especificacion". Fuente: documento adjunto `docs/agent-context/modules/usuarios/features/acceso-estudiante.md`, refinado en esta sesión. El estudiante no interactúa con la plataforma; el docente realiza las operaciones. No se incluyen tareas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un estudiante de un grupo propio (Priority: P1)

Como docente con acceso vigente, quiero registrar un estudiante en un grupo bajo mi responsabilidad para mantener su información académica sin crearle una cuenta de usuario.

**Why this priority**: El registro académico es la base de las consultas y del mantenimiento posterior; no depende de que el menor utilice la aplicación.

**Independent Test**: Con un grupo propio previamente disponible, registrar un estudiante con código, nombres y apellidos válidos, consultar el resultado y comprobar que existe un único registro inactivo y ninguna cuenta de usuario nueva.

**Acceptance Scenarios**:

1. **Given** un docente activo con sesión vigente y un grupo propio, **When** registra código, nombres y apellidos válidos, **Then** se crea un único estudiante asociado al grupo, inicialmente inactivo, y se confirma el registro sin crear cuentas ni accesos para el menor.
2. **Given** un código ya utilizado por cualquier estudiante, incluso inactivo o de otro grupo, **When** se intenta registrar el mismo código, **Then** se rechaza el duplicado sin crear otro registro ni revelar datos del estudiante existente.
3. **Given** datos obligatorios ausentes, vacíos o superiores a los límites admitidos, **When** se solicita el alta, **Then** se informa qué datos de la solicitud son inválidos y no se guarda un registro parcial.
4. **Given** un grupo inexistente o ajeno, **When** el docente intenta registrar un estudiante allí, **Then** no se crea el registro ni se divulga información del grupo ajeno.

---

### User Story 2 - Consultar estudiantes del ámbito propio (Priority: P1)

Como docente, quiero listar y consultar individualmente los estudiantes de mis grupos para identificar el registro académico sobre el que debo trabajar.

**Why this priority**: Permite usar la información registrada sin exponer registros de otros docentes.

**Independent Test**: Preparar dos docentes, cada uno con un grupo y estudiantes activos e inactivos; consultar listados y detalles con cada identidad y comprobar el aislamiento entre ámbitos.

**Acceptance Scenarios**:

1. **Given** estudiantes en grupos propios y ajenos, **When** el docente consulta su listado, **Then** recibe exclusivamente sus estudiantes, con código, nombres, apellidos, grupo y estado, incluidos los inactivos.
2. **Given** un estudiante propio, **When** consulta su detalle, **Then** recibe los datos académicos del registro y no credenciales ni información personal innecesaria del personal.
3. **Given** un identificador ajeno o inexistente, **When** se consulta directamente, **Then** se deniega la consulta con una respuesta indistinguible que no confirma la existencia de un menor fuera del ámbito.
4. **Given** un docente sin grupos o sin estudiantes registrados, **When** consulta el listado, **Then** obtiene un resultado vacío sin incorporar registros de otro ámbito.

---

### User Story 3 - Corregir información de un estudiante (Priority: P2)

Como docente responsable, quiero corregir el código, nombres y apellidos de un estudiante para mantener información exacta sin alterar su identidad académica.

**Why this priority**: Las correcciones no deben exigir duplicar al estudiante ni perder la continuidad de su registro.

**Independent Test**: Con un estudiante propio existente, modificar cada dato permitido y verificar su persistencia bajo el mismo identificador; repetir con código duplicado, cambios de grupo o de estado y docente ajeno.

**Acceptance Scenarios**:

1. **Given** un estudiante propio activo o inactivo, **When** el docente corrige sus datos permitidos con valores válidos, **Then** se conservan el identificador, el grupo y el estado, y se muestran los valores corregidos en consultas posteriores.
2. **Given** una actualización inválida o un código ocupado por otro estudiante, **When** intenta guardarla, **Then** se rechaza íntegramente y permanecen los datos anteriores; conservar el código actual no se considera duplicado.
3. **Given** un intento de modificar el identificador, trasladar el estudiante de grupo o activarlo mediante la edición, **When** se solicita el cambio, **Then** se rechaza sin modificar el registro.
4. **Given** un estudiante ajeno, **When** el docente intenta actualizarlo manipulando su identificador, **Then** se deniega sin exponer ni cambiar sus datos.

---

### User Story 4 - Inactivar conservando el registro (Priority: P2)

Como docente responsable, quiero inactivar un estudiante sin eliminarlo para mantener disponible su información académica dentro de mi ámbito.

**Why this priority**: Diferencia el mantenimiento del participante del ciclo de vida de las cuentas del personal y evita borrar información por una inactivación.

**Independent Test**: Con un estudiante propio activo de prueba, inactivarlo y consultarlo; repetir la inactivación y comprobar conservación de identidad y datos sin efectos sobre la sesión docente.

**Acceptance Scenarios**:

1. **Given** un estudiante propio activo, **When** se solicita su inactivación, **Then** queda inactivo y conserva identificador, código, nombres, apellidos y grupo; la sesión del docente no cambia.
2. **Given** un estudiante ya inactivo, **When** se repite la solicitud, **Then** permanece inactivo sin duplicación ni pérdida de datos.
3. **Given** un estudiante ajeno, **When** se solicita su inactivación, **Then** se deniega sin modificarlo ni confirmar su existencia.

### Edge Cases

- Dos altas o correcciones simultáneas que usan el mismo código solo pueden dejar un estudiante con ese código; la operación rechazada no persiste parcialmente.
- Espacios externos en código, nombres o apellidos se eliminan antes de validar; valores que queden vacíos se rechazan. Se conservan acentos y caracteres propios de nombres.
- La comparación de códigos distingue mayúsculas y minúsculas; el código se trata como texto y conserva ceros iniciales. Los códigos de estudiantes inactivos siguen reservados.
- Una sesión vencida, cuenta pendiente/inactiva o rol distinto de Docente no permite ninguna operación, aunque antes hubiese tenido acceso.
- Un identificador de docente o filtro enviado por el solicitante no amplía el ámbito; los listados, detalles y escrituras verifican la responsabilidad vigente.
- Si no se puede verificar la identidad o responsabilidad del docente, se deniega sin datos protegidos ni cambios parciales.
- Un registro inactivo sigue siendo consultable y corregible por su docente; ninguna edición lo activa automáticamente.
- Una solicitud de alta o edición que intente activar al participante se rechaza: no se omite el requisito de consentimiento por estar su gestión fuera de esta feature.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE tratar al estudiante exclusivamente como registro académico. NO DEBE crearle cuenta, credenciales, rol, token ni sesión de usuario, ni solicitarle interacción con la plataforma. Todas las operaciones de esta feature DEBEN ejecutarse bajo la identidad del docente.
- **FR-002**: Cada operación DEBE verificar acceso vigente, cuenta activa, rol Docente y responsabilidad actual sobre el grupo del estudiante. Ausencia o fallo de cualquier verificación DEBE impedir la operación. El rol Administrador, por sí solo, no concede acceso a estas operaciones.
- **FR-003**: El docente DEBE poder registrar un estudiante únicamente en un grupo existente del que sea responsable, indicando código, nombres y apellidos obligatorios. El estudiante DEBE recibir un identificador estable y comenzar inactivo; el alta NO DEBE activar al participante.
- **FR-004**: El código DEBE ser único entre todos los estudiantes, incluidos los inactivos, y tener entre 1 y 50 caracteres tras eliminar espacios externos. Nombres y apellidos DEBEN tener entre 1 y 100 caracteres cada uno tras la misma normalización. El código DEBE conservar ceros iniciales y distinguir mayúsculas/minúsculas; la duplicación DEBE comprobarse también al corregirlo y bajo solicitudes simultáneas.
- **FR-005**: El docente DEBE poder listar exclusivamente estudiantes de sus grupos y consultar su detalle individual, incluyendo activos e inactivos. Solo DEBEN entregarse identificador, código, nombres, apellidos, referencia del grupo y estado académico necesarios para estas operaciones; un ámbito vacío DEBE devolver un listado vacío.
- **FR-006**: El docente DEBE poder corregir código, nombres y apellidos de estudiantes de su ámbito, activos o inactivos. La corrección DEBE conservar identificador, grupo y estado; intentar modificar estos últimos por edición DEBE rechazarse. Tras un cambio aceptado, una consulta DEBE reflejar los datos corregidos.
- **FR-007**: El docente DEBE poder inactivar estudiantes de su ámbito sin borrarlos ni perder sus datos. Repetir la inactivación DEBE dejar el mismo estado final, sin crear otro registro ni afectar las cuentas o accesos del docente.
- **FR-008**: Los datos de la solicitud NO DEBEN definir o ampliar la identidad ni el ámbito del solicitante. Conocer un identificador ajeno NO DEBE habilitar lectura o escritura. Las consultas o modificaciones de estudiantes inexistentes y ajenos DEBEN producir respuestas indistinguibles, sin datos protegidos.
- **FR-009**: Toda operación inválida, no autorizada o fallida DEBE dejar intacto el estado anterior. Los errores DEBEN ser comprensibles y no revelar información de estudiantes de otro ámbito; un código ocupado puede informarse sin identificar al titular ni su grupo.
- **FR-010**: La relación académica DEBE conservar un docente responsable por grupo, múltiples grupos posibles por docente, un grupo por estudiante y múltiples estudiantes posibles por grupo. La cuenta del docente existente DEBE ser la responsable, sin duplicar su identidad.
- **FR-011**: Esta feature NO DEBE permitir activación o reactivación de participantes, ni altas activas. La activación exige consentimiento vigente conforme a la constitución y queda reservada a la integración posterior con su gestión; estar registrado, ser consultable o ser corregible NO equivale a estar habilitado para participar.
- **FR-012**: Las operaciones DEBEN estar disponibles para consumo por el cliente del docente sin depender de controles de interfaz para hacer efectiva la autorización. Esta feature NO DEBE incorporar tareas, consentimientos, borrado definitivo, traslado entre grupos, gestión de grupos ni cambios al ciclo de vida de cuentas del personal.

### Key Entities *(include if feature involves data)*

- **Cuenta del docente**: Cuenta de personal existente con identidad, estado y rol vigentes. Es el usuario que realiza las operaciones, no una cuenta creada para un estudiante.
- **Grupo académico**: Agrupación identificada por nombre, grado y año escolar, con un único docente responsable; determina el ámbito permitido. Su creación y administración son una dependencia separada.
- **Estudiante**: Registro con identificador estable, código globalmente único, nombres, apellidos, grupo y estado activo/inactivo. No es un usuario del sistema. Su estado académico es independiente del estado de la cuenta del docente y de sus sesiones.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una matriz con al menos dos docentes y dos grupos por docente, el 100 % de altas, lecturas, correcciones e inactivaciones válidas queda restringido al ámbito correspondiente; el 100 % de intentos sobre registros ajenos se deniega sin exposición ni cambios.
- **SC-002**: El 100 % de altas y correcciones aceptadas mantiene código único, datos obligatorios válidos y relación con un grupo propio. En solicitudes simultáneas con un código idéntico, queda exactamente un estudiante con ese código.
- **SC-003**: El 100 % de correcciones e inactivaciones conserva el identificador del estudiante; las inactivaciones conservan sus datos y permiten consultarlos por el docente responsable. Repetir una inactivación no cambia estos resultados.
- **SC-004**: En todos los recorridos de aceptación se crean cero cuentas o accesos para estudiantes; el 100 % de altas queda inactivo y el 100 % de intentos de activar mediante alta o edición se rechaza.
- **SC-005**: El 100 % de casos de sesión inválida, cuenta no activa, rol no autorizado o responsabilidad no verificable queda sin datos protegidos ni cambios académicos.
- **SC-006**: La verificación funcional permite completar, sin intervención del estudiante, el recorrido registrar → consultar → corregir → inactivar → consultar, y en el 100 % de sus pasos los datos observados corresponden al mismo registro y al docente autorizado.

## Assumptions

- **Decisiones confirmadas**: En esta sesión el responsable estableció que el estudiante no interactúa con la plataforma, que el docente ejecuta todas las operaciones, que no se incluyen tareas y que debe respetarse el modelo original con los cambios mínimos necesarios. Estas decisiones reemplazan, para esta feature, la interpretación anterior de acceso del estudiante por código. El archivo fuente conserva un nombre histórico, pero la responsabilidad funcional es Académico, no autenticación estudiantil.
- **Fuente principal**: Se utilizó la versión refinada del documento adjunto `acceso-estudiante.md` de `/home/santino/Universidad/TrabajoCampo/Kudlab-backend/`. No se presupone que esa versión exista en todos los worktrees. La evidencia y las diferencias con la implementación se registran de forma portable en [source-context.md](source-context.md).
- **Dependencias**: Se reutiliza la autenticación y el estado de cuentas de las features 001–003; no se cambia su comportamiento. Deben existir grupos asociados a cuentas docentes antes de operar sobre estudiantes. Incorporar la representación de grupos no implica entregar su administración en esta feature; la preparación de grupos para uso real debe acordarse antes de desplegar.
- **Supuestos de esta propuesta**: Se incluyen alta, listado, detalle, corrección e inactivación por ser las operaciones del documento fuente. Campos obligatorios, eliminación de espacios externos, comparación sensible a mayúsculas, edición de estudiantes inactivos e inactivación repetible son defaults propuestos para revisión, no políticas institucionales previamente aprobadas.
- **Activación y consentimiento**: Para respetar el principio II de la constitución sin ampliar el alcance hacia consentimiento, se propone registrar inactivo y no ofrecer activación/reactivación. Esta interpretación conservadora debe revisarse con el responsable; no constituye excepción ni eliminación del requisito de consentimiento. Los registros activos usados para probar la inactivación son datos de prueba o provienen de una futura habilitación autorizada.
- **Límites**: No se incluyen interfaz, filtros avanzados, importaciones masivas, cuentas estudiantiles, borrado definitivo, cambios de grupo, administración de grupos, notas, tareas ni evidencias de consentimiento. Tampoco se define una política nueva de auditoría general ni se asimilan los estudiantes a las cuentas auditadas del personal.
- **Fuentes y estado**: El ERD y DBML originales son propuestas de análisis/diseño, no evidencias de implementación ni requisitos aprobados. Las cardinalidades, campos y unicidad se contrastaron directamente con los originales; no se adoptan otros RF V3 a partir de sus resúmenes. La regla de consentimiento procede de la constitución 1.1.0, principio II. Las referencias antiguas que describen estudiante como actor o acceso por código quedan identificadas como antecedentes no aplicables a esta feature, sin modificar silenciosamente esos artefactos.
- **Calidad**: Los criterios de éxito son verificaciones funcionales de esta propuesta. No se adoptan umbrales temporales ni cifras de capacidad institucional sin confirmación; su definición y medición corresponden a la planificación.
