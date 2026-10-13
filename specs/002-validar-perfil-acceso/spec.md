# Feature Specification: Validar perfil y acceso

**Feature Branch**: `002-validar-perfil-acceso`

**Created**: 2026-10-12

**Status**: Borrador para revisión funcional; RF-002 de V3 es una propuesta, no una aprobación

**Input**: User description: "La feature descrita en docs/agent-context/modules/usuarios/features/validacion-acceso.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrar un perfil válido (Priority: P1)

Como administrador activo con permiso de gestión de cuentas, quiero saber si los datos de una nueva cuenta son válidos antes de registrarla para evitar perfiles incompletos, correos improcedentes y duplicados.

**Why this priority**: La calidad de los datos y la unicidad de la identidad condicionan el alta segura del personal.

**Independent Test**: Intentar registrar una cuenta docente con nombre completo, correo institucional nuevo y rol válido; comprobar que se acepta como pendiente según la feature de cuentas. Repetir omitiendo cada campo, usando correo mal formado, otro dominio y un correo ocupado por cuenta activa, pendiente o inactiva; comprobar rechazo sin crear cuentas.

**Acceptance Scenarios**:

1. **Given** un administrador activo autorizado y un correo institucional disponible, **When** presenta nombre completo no vacío, correo de dominio `.edu.co` y rol Docente, **Then** los datos superan la validación y el alta conserva el estado pendiente de activación previsto para cuentas.
2. **Given** un nombre, correo o rol obligatorio ausente o compuesto solo de espacios donde corresponde texto, **When** se solicita el alta, **Then** se indica qué dato debe corregirse y no se crea la cuenta.
3. **Given** un correo sin formato válido, con dominio distinto de `.edu.co` o ya perteneciente a cualquier cuenta, **When** se intenta el alta, **Then** se informa el motivo al administrador autorizado y no se duplica ni modifica ninguna cuenta.

---

### User Story 2 - Corregir un perfil sin alterar otros datos (Priority: P2)

Como administrador activo con permiso de gestión, quiero corregir el nombre o correo de una cuenta y recibir una explicación ante datos inválidos, para mantener la identidad de la persona sin perder su historial.

**Why this priority**: Los cambios de identificación requieren las mismas garantías que un alta.

**Independent Test**: Cambiar solo el nombre o el correo de una cuenta y comprobar que se conserva el resto; intentar dejar vacío el nombre, cambiar el correo por uno duplicado o enviar dos cambios donde uno es inválido y comprobar que no se guarda ninguno.

**Acceptance Scenarios**:

1. **Given** una cuenta existente y un administrador autorizado, **When** cambia el nombre a uno no vacío o solicita cambiar el correo a uno institucional disponible, **Then** el nombre se actualiza y el correo de una cuenta pendiente se cambia con una nueva invitación; para una cuenta activa, el correo anterior sigue vigente hasta que el titular confirme el nuevo. No se alteran estado, rol ni historial.
2. **Given** una cuenta existente, **When** el administrador intenta cambiar el correo por el que ya usa otra cuenta, **Then** se rechaza toda la edición y el perfil anterior permanece intacto.
3. **Given** una edición que cambia nombre y correo a la vez, **When** uno de los valores es inválido, **Then** se explican los errores al administrador y ninguno de los dos cambios se guarda.

---

### User Story 3 - Proteger operaciones sin depender de la interfaz (Priority: P3)

Como miembro del personal autorizado, quiero que solo se permitan acciones acordes con mi cuenta, rol y responsabilidad, para que una solicitud directa o manipulada no revele datos ni cambie cuentas ajenas.

**Why this priority**: La ocultación de opciones en pantalla no garantiza por sí sola la protección de cuentas ni de datos de menores.

**Independent Test**: Intentar altas y ediciones de cuentas como docente y sin acceso válido; intentar consultar y modificar un estudiante de otro grupo como docente, incluidos identificadores y filtros alterados, con y sin usar la interfaz. Verificar denegación sin cambios ni datos del ámbito ajeno.

**Acceptance Scenarios**:

1. **Given** una persona no autenticada, una cuenta inactiva o un docente, **When** solicita directamente gestionar cuentas, **Then** se deniega la operación sin cambios ni datos de cuentas ajenas.
2. **Given** dos docentes asignados a grupos distintos, **When** uno intenta consultar o modificar datos de un estudiante o grupo del otro mediante identificadores o filtros alterados, **Then** se deniega esa solicitud sin mostrar datos ajenos ni realizar modificaciones.
3. **Given** una solicitud cuyo permiso o asignación no puede comprobarse, **When** se pide una operación protegida, **Then** se deniega sin revelar información protegida ni guardar cambios.

### Edge Cases

- Dos altas o cambios de correo simultáneos reclaman el mismo correo: como máximo una operación obtiene ese correo; la otra se rechaza sin efectos parciales.
- La edición reenvía el mismo correo de la cuenta objetivo: no se considera duplicado de otra cuenta; para una cuenta activa se informa que no hay cambio y, para una pendiente, se puede emitir una nueva invitación sin duplicar la cuenta.
- La cuenta administradora pierde su estado activo o su permiso mientras mantiene abierto el acceso: su siguiente solicitud de gestión se deniega.
- Un correo de cuenta inactiva o pendiente sigue ocupado; cambiar mayúsculas/minúsculas del dominio no permite eludir la regla institucional.
- Una petición altera un identificador de estudiante o un filtro de grupo después de mostrar opciones válidas: se vuelve a comprobar el ámbito de lo solicitado.
- Una contraseña no cumple las reglas al aceptar una invitación, cambiarse o restablecerse: la operación se rechaza sin consumir la invitación ni modificar la credencial anterior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Antes de registrar una cuenta, el sistema DEBE exigir nombre completo no vacío, correo institucional válido y rol Docente; ningún dato obligatorio puede consistir solo en espacios.
- **FR-002**: El correo DEBE tener formato de dirección de correo y un dominio que termine exactamente en `.edu.co`, comparado sin distinguir mayúsculas/minúsculas; un dominio diferente o un sufijo añadido después de `.edu.co` DEBE rechazarse.
- **FR-003**: Antes de crear una cuenta o cambiar su correo, el sistema DEBE comprobar que ese correo no está asignado a otra cuenta activa, pendiente o inactiva, sin considerar diferencias de mayúsculas/minúsculas. Ante solicitudes simultáneas, no DEBE quedar asignado a dos cuentas; conservar el correo propio en una edición es válido.
- **FR-004**: En una edición de nombre o correo el sistema DEBE volver a validar los datos afectados y preservar la identidad, rol, estado e historial de la cuenta. El correo de una cuenta activa DEBE permanecer vigente hasta que su titular confirme el nuevo; una cuenta pendiente DEBE recibir una nueva invitación si cambia su correo. Si algún dato es inválido, DEBE rechazar la edición completa sin guardar cambios parciales.
- **FR-005**: Al establecer, cambiar o restablecer una contraseña para estas cuentas, el sistema DEBE exigir al menos ocho caracteres, una mayúscula, una minúscula y un número; si no cumple, DEBE conservar el estado y la credencial anterior y, cuando corresponda, no consumir la invitación de activación.
- **FR-006**: El sistema DEBE comprobar en cada alta o edición de cuentas que quien solicita la operación conserva una cuenta activa y permiso vigente de gestión; un docente o una persona sin acceso válido DEBE recibir una denegación sin cambio ni datos de otras cuentas, incluso al omitir la interfaz.
- **FR-007**: Antes de atender una consulta o modificación protegida de un estudiante o grupo, el sistema DEBE comprobar identidad, estado de cuenta, rol y responsabilidad vigente sobre el ámbito solicitado. DEBE aplicar esta regla también a identificadores y filtros suministrados directamente, de acuerdo con la feature de autorización por rol y ámbito.
- **FR-008**: Si no se puede comprobar una condición requerida para autorizar la operación, el sistema DEBE denegarla sin devolver información del ámbito protegido ni realizar cambios.
- **FR-009**: Ante datos incompletos, formato o política incumplidos o duplicidad, el sistema DEBE indicar al administrador autorizado el campo o conflicto a corregir; ante denegación de acceso DEBE comunicarla sin exponer datos de terceros ni credenciales.

### Key Entities *(include if feature involves data)*

- **Cuenta del personal**: Identidad estable de administrador o docente con nombre completo, correo único, un rol y estado pendiente, activo o inactivo.
- **Credencial**: Prueba de acceso de la persona titular, sujeta a las reglas acordadas al establecerla o cambiarla; su valor no forma parte de las respuestas de validación.
- **Responsabilidad docente**: Relación vigente entre un docente y los grupos o estudiantes que puede consultar o modificar.
- **Solicitud protegida**: Intento de alta, edición, consulta o modificación con actor, operación y, cuando aplique, cuenta o ámbito objetivo; solo produce efectos si satisface todas las condiciones correspondientes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una matriz de casos que omite por separado cada dato obligatorio y prueba correo mal formado, dominio ajeno, correo duplicado y contraseña contraria a cada regla, el 100 % de las solicitudes inválidas se rechaza sin crear ni modificar cuentas o credenciales.
- **SC-002**: En una prueba con 20 altas y 20 ediciones válidas realizadas por administradores autorizados, el 100 % deja el nombre esperado y el correo esperado tras completar la verificación cuando corresponde, sin modificar otros datos; las altas conservan el estado pendiente acordado.
- **SC-003**: En pruebas con dos docentes de grupos distintos, administradores, cuentas inactivas y personas sin acceso, el 100 % de intentos de gestión o de consulta/modificación fuera del permiso se deniega, incluso con solicitudes directas e identificadores o filtros alterados, sin revelar información del otro grupo.
- **SC-004**: En 10 pares de intentos concurrentes por el mismo correo, nunca quedan dos cuentas con ese correo; cada intento perdedor conserva el estado anterior y recibe una indicación de conflicto.
- **SC-005**: En una prueba guiada con al menos cinco administradores del piloto, al menos el 90 % de los intentos de corregir un perfil rechazado se completa sin ayuda adicional y en menos de 3 minutos tras recibir el motivo del error.

## Assumptions

- **Alcance y dependencias**: Esta feature valida perfiles, credenciales y condiciones de acceso; el ciclo de vida de cuentas e invitaciones se rige por [Gestionar cuentas y roles](../001-gestionar-cuentas-roles/spec.md). La definición detallada de permisos por operación y responsabilidad, y las asignaciones de grupos, corresponden a RF-004 V3 y al módulo Académico. Aquí se exige su verificación antes de completar operaciones protegidas, sin ampliar la matriz de permisos.
- **Reglas previamente decididas para cuentas**: `specs/001-gestionar-cuentas-roles/spec.md` declara decisiones expresas del responsable del proyecto: nombre completo, correo `.edu.co`, un único rol, alta ordinaria Docente pendiente de invitación y contraseña mínima de ocho caracteres con mayúscula, minúscula y número. Se reutilizan como reglas de validación, no se atribuyen a V3.
- **Coherencia con el contrato de cuentas existente**: El cambio de correo de cuenta activa requiere confirmación del titular antes de hacerse efectivo; en cuenta pendiente se sustituye la invitación. El contrato de 001 distingue esta solicitud de la modificación inmediata del nombre. Esta aclaración no añade un segundo recorrido de edición.
- **Comportamiento ante errores**: Los errores de formato se explican al administrador autorizado; una solicitud sin permiso se deniega sin detallar la existencia de cuentas o registros ajenos. No se presupone una ruta, un código de respuesta ni un mecanismo de autenticación concreto.
- **Metas de calidad**: El objetivo de facilidad de corrección de SC-005 es una meta propuesta para validar con administradores, no una cifra aprobada en las fuentes originales; no se adopta aquí un objetivo de rendimiento o concurrencia de otros módulos sin confirmación para este recorrido.
- **Trazabilidad y discrepancias de fuentes**: `docs/original/requisitos_V3.xlsx`, hoja «RF corregidos», fila 3, RF-002 V3, registra como *Propuesto - corregido para validación* validación de perfil, credenciales según política y acceso protegido con control adicional a la interfaz; fila 5, RF-004 V3, propone rol y ámbito. Hoja «Decisiones y pendientes», fila 9 (D-08), sigue *Propuesto*. `docs/original/3 ANALISIS DEL PROYECTO.docx.pdf`, §6.1.1, CU01-S1/S2, pp. 27–29, exige datos obligatorios, identificador único, rechazo sin guardar y validación en edición; CU03 p. 32 deniega acceso fuera del ámbito o ante verificación imposible. El análisis propone crear cuentas activas y aplicar una política de contraseña sin concretarla: el estado pendiente y la regla concreta proceden exclusivamente de la decisión posterior consignada en `specs/001-gestionar-cuentas-roles/spec.md`. Los RF del análisis son homónimos de los de V3 y no se consideran equivalentes ni aprobados.
