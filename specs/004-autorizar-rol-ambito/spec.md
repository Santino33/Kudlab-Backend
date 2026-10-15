# Feature Specification: Autorizar por rol y responsabilidad

**Feature Branch**: `004-autorizar-rol-ambito`

**Created**: 2026-10-14

**Status**: Borrador para validación funcional; RF-004 de V3 es una propuesta, no un requisito institucional aprobado

**Input**: User description: "Para la feature 004 de autorización; trabajar en una rama aparte creada y activada antes de especificar"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acceder solo a funciones del rol vigente (Priority: P1)

Como miembro del personal con cuenta activa, quiero que cada solicitud se limite a las funciones de mi rol actual para que nadie gestione cuentas o consulte datos fuera de sus permisos.

**Why this priority**: El control por rol es la primera barrera antes de cualquier consulta o modificación protegida.

**Independent Test**: Con un administrador y un docente activos, solicitar gestión de cuentas y una operación docente permitida; repetir como el otro rol y sin sesión válida, comprobando que las denegaciones no revelan datos ni producen cambios.

**Acceptance Scenarios**:

1. **Given** un administrador activo con sesión vigente, **When** solicita una función de gestión de cuentas ya definida para su rol, **Then** puede continuar la operación conforme a las reglas de cuentas.
2. **Given** un docente activo, **When** intenta gestionar cuentas mediante la interfaz o una solicitud directa, **Then** la operación se deniega sin revelar cuentas ajenas ni modificar datos.
3. **Given** una sesión inexistente, vencida o cerrada, una cuenta pendiente o inactiva, o un rol inválido, **When** se solicita cualquier operación protegida, **Then** se deniega antes de mostrar datos o guardar cambios.
4. **Given** una cuenta cuyo rol cambia durante una sesión, **When** se realiza la siguiente solicitud, **Then** rigen solo los permisos del nuevo rol; el rol anterior no otorga acceso residual.

---

### User Story 2 - Consultar y modificar solo estudiantes asignados (Priority: P2)

Como docente, quiero consultar y modificar únicamente los registros de los estudiantes y grupos a mi cargo para hacer seguimiento pedagógico sin acceder a menores de otro docente.

**Why this priority**: El rol Docente por sí solo no identifica a los menores bajo su responsabilidad.

**Independent Test**: Preparar dos docentes activos con grupos y estudiantes distintos; comprobar que cada uno consulta y modifica solo su ámbito, y que usar el identificador del otro grupo o estudiante se rechaza sin efectos.

**Acceptance Scenarios**:

1. **Given** dos docentes con asignaciones vigentes a grupos distintos, **When** uno solicita consultar o modificar un estudiante de su grupo mediante una función docente habilitada, **Then** la operación continúa según las reglas de esa función y solo alcanza a ese estudiante.
2. **Given** esos mismos docentes, **When** uno envía un identificador de estudiante o grupo del otro, **Then** se deniega la solicitud individual sin confirmar la existencia del objetivo ni alterar datos.
3. **Given** un docente cuya asignación se retira mientras mantiene sesión, **When** intenta acceder de nuevo al estudiante o grupo, **Then** la primera solicitud posterior al cambio se deniega, aunque lo haya consultado antes.
4. **Given** una operación docente que requiere responsabilidad sobre un estudiante, **When** solo se conoce su identificador pero no puede comprobarse su pertenencia a un grupo asignado, **Then** se deniega sin presumir autorización por la identidad del solicitante.

---

### User Story 3 - Ver únicamente resultados del ámbito autorizado (Priority: P3)

Como docente, quiero que listados, filtros y resúmenes reflejen solo a mis grupos y estudiantes para evitar que una vista parcial exponga información de otros cursos.

**Why this priority**: Restringir solo la ficha individual deja abiertas filtraciones en listados, opciones y agregados.

**Independent Test**: Con registros de dos grupos asignados a distintos docentes, consultar listados y resultados con y sin filtros; comprobar que ninguno incluye nombres, detalles, cantidades o datos derivados del grupo ajeno, incluso al alterar el filtro.

**Acceptance Scenarios**:

1. **Given** una consulta de listado o resumen de un docente, **When** solicita datos sin filtro explícito, **Then** recibe únicamente los registros y agregados de su ámbito vigente.
2. **Given** un docente con acceso a un grupo, **When** filtra por estudiante, grupo o período, **Then** únicamente ve resultados y opciones de selección derivados de su ámbito; un filtro alterado no amplía el conjunto autorizado.
3. **Given** un filtro de grupo ajeno o una solicitud mixta que incluye objetivos propios y ajenos, **When** se solicita una consulta, **Then** no se entregan registros, cantidades ni indicios del objetivo ajeno; una consulta individual o modificación mixta se rechaza por completo y no produce cambios.
4. **Given** un cambio de asignación, **When** el docente repite la consulta o reutiliza un filtro anterior, **Then** el resultado se ajusta a la responsabilidad vigente y no recupera datos del ámbito retirado.

### Edge Cases

- Si no se puede verificar la cuenta, sesión, rol o asignación vigente, se deniega la solicitud completa sin reutilizar decisiones anteriores ni mostrar datos protegidos.
- Si un grupo está asignado pero el estudiante objetivo pertenece a otro, la autorización del grupo solicitado no autoriza a ese estudiante.
- Los identificadores y filtros recibidos directamente se verifican igual que los seleccionados en una pantalla; parámetros adicionales o inconsistentes no amplían el ámbito.
- El acceso del administrador a funciones de gestión de cuentas no concede automáticamente consulta de datos individuales de estudiantes ni permiso para actuar como docente.
- La falta de registros autorizados se comunica como ausencia de resultados; una denegación por objetivo ajeno no confirma si el registro existe.
- Una petición denegada no se considera actividad aceptada para renovar la sesión, conforme a la regla confirmada en la feature de autenticación.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Antes de ejecutar cada operación protegida, el sistema DEBE verificar que la sesión sea vigente, la cuenta esté activa y tenga exactamente un rol vigente válido; si alguna condición falta o no puede comprobarse, DEBE denegar sin devolver información protegida ni realizar cambios.
- **FR-002**: El sistema DEBE autorizar cada operación conforme a su rol y propósito: el administrador puede ejercer únicamente funciones de gestión de cuentas ya definidas para él; el docente NO DEBE ejercerlas. Ni el rol administrador ni el rol docente conceden por sí solos acceso irrestricto a datos de estudiantes.
- **FR-003**: Para cualquier consulta o modificación docente sobre un estudiante o grupo, el sistema DEBE comprobar una responsabilidad vigente sobre el objetivo solicitado antes de entregar datos o realizar cambios; el identificador de un estudiante debe corresponder efectivamente al ámbito asignado. Sin asignación comprobable DEBE denegar.
- **FR-004**: El sistema DEBE aplicar el ámbito vigente a listados, filtros, opciones de selección y resultados agregados; NO DEBE incluir datos, cantidades ni detalles derivados exclusivamente de objetivos ajenos, incluso cuando no se proporciona filtro o se manipula uno.
- **FR-005**: Una consulta individual de objetivo ajeno, una modificación ajena o una modificación con objetivos propios y ajenos DEBE rechazarse íntegramente, sin cambios parciales ni confirmación pública de la existencia de los objetivos ajenos. En una consulta de listado, solo se podrán entregar elementos autorizados, aun cuando se soliciten también objetivos ajenos.
- **FR-006**: En cada nueva solicitud protegida, el sistema DEBE usar el rol y las asignaciones vigentes; al perder un rol o una responsabilidad, el acceso correspondiente DEBE desaparecer desde la primera solicitud posterior, sin conservar privilegios por vistas, filtros o accesos previos.
- **FR-007**: Si falla la comprobación de rol, sesión o responsabilidad, el sistema DEBE denegar toda la operación afectada sin recurrir a declaraciones del solicitante ni a una autorización anterior y sin exponer información de otro ámbito.
- **FR-008**: La verificación DEBE regir para solicitudes directas y para operaciones iniciadas desde cualquier vista; ocultar opciones en la interfaz NO DEBE ser el único control de autorización.

### Key Entities *(include if feature involves data)*

- **Cuenta de personal**: Identidad con estado y un rol vigente de Administrador o Docente; su creación y cambio de rol pertenecen a la feature de cuentas.
- **Sesión de usuario**: Acceso vigente ligado a la cuenta; su vencimiento y revocación se rigen por la feature de autenticación.
- **Responsabilidad docente**: Asignación actual de un docente a grupos y, cuando corresponda, estudiantes pertenecientes a ellos; Académico debe ser su fuente autoritativa.
- **Objetivo protegido**: Cuenta, grupo, estudiante o conjunto de registros pedido para una operación concreta; exige comprobar rol y, para datos de menores, el ámbito correspondiente.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una matriz de solicitudes con un administrador, dos docentes, cuentas activas e inactivas y sesiones vigentes o vencidas, el 100 % de las operaciones fuera del rol o sin acceso válido se deniega sin datos protegidos ni cambios; todas las permitidas pasan a las reglas de su función.
- **SC-002**: Con dos docentes y dos grupos de prueba distintos, el 100 % de las consultas y modificaciones individuales ajenas, incluidas las realizadas con identificadores cambiados y solicitudes directas, se deniega sin efectos; el 100 % de las operaciones sobre objetivos propios correctamente asignados pasa a su función.
- **SC-003**: En consultas de listado y resumen con filtros ausentes, propios, ajenos y mixtos, el 100 % de las respuestas visibles al docente omite registros, cantidades y opciones ajenas; ninguna modificación mixta produce cambios parciales.
- **SC-004**: Tras cada revocación de rol o reasignación probada, el 100 % de las primeras solicitudes posteriores refleja los permisos y el ámbito vigentes; ante fallas simuladas de comprobación, el 100 % de las solicitudes afectadas se deniega sin datos protegidos.
- **SC-005**: Como meta propuesta para medir tras integrar el consumidor real, con 30 sesiones concurrentes de prueba, al menos el 95 % de las consultas autorizadas y denegadas del recorrido de ámbito termina en menos de 2 segundos; registrar entorno y medición antes de considerarla aceptada institucionalmente.
- **SC-006**: En una revisión guiada con al menos cinco integrantes adultos del personal piloto y datos ficticios, al menos el 90 % identifica correctamente cuál de dos grupos puede consultar y entiende una denegación por falta de permiso sin ayuda, en menos de 2 minutos por intento; meta propuesta, pendiente de validación.

## Assumptions

- **Alcance**: Esta feature define la decisión de autorización por rol y responsabilidad sobre solicitudes del personal. Las operaciones ya existentes de cuentas son un consumidor actual; los escenarios completos de estudiantes, grupos y panel requieren consumidores reales de Académico y Seguimiento. No se afirma que esos módulos ya existan en el backend ni se promete un endpoint nuevo en esta fase de especificación. Tareas deberá aplicar estas reglas en sus operaciones de personal al integrarse; el acceso del estudiante por código, el consentimiento, la exportación y los permisos detallados del administrador sobre datos estudiantiles requieren sus propias decisiones y contratos.
- **Matriz mínima y criterio conservador**: Solo se reconocen ADMIN/TEACHER y la gestión de cuentas ADMIN acordada en [001](../001-gestionar-cuentas-roles/spec.md). Se asume que las operaciones docentes de lectura/modificación habilitadas por sus futuras features requieren asignación vigente; no se inventan permisos para el administrador sobre datos de menores ni se supone que todo docente pueda modificar cualquier clase de dato. Antes de activar cada consumidor se debe aprobar su operación concreta y su matriz de permisos; hasta entonces permanece denegada.
- **Dependencias reales**: [002](../002-validar-perfil-acceso/quickstart.md) dejó US3/SC-003 bloqueadas: `src/modules/usuarios/scope-authorization.ts` permite probar el límite con un doble, pero no sustituye un proveedor autoritativo de asignaciones ni rutas consumidoras. [003](../003-autenticar-usuarios/quickstart.md) registra controles de sesión y rol verificados localmente; sus resultados no prueban aislamiento entre docentes en un consumidor real. La regla de actividad de sesión aceptada procede de la confirmación del responsable en [003](../003-autenticar-usuarios/spec.md).
- **Trazabilidad y estados**: `docs/original/requisitos_V3.xlsx`, hoja «RF corregidos», fila 5, RF-004 de **V3**, dice autorizar cada operación por rol/alcance, restringir consulta y modificación docente a estudiantes y grupos asignados, y comprobar restricciones en el servidor; su estado es «Propuesto - corregido para validación». En «Decisiones y pendientes», fila 9, D-08 propone RBAC y ámbito y continúa «Propuesto». `docs/original/3 ANALISIS DEL PROYECTO.docx.pdf`, **análisis** §6.1.1 CU03 p. 32 y §7.3 pp. 44–45, describe denegación sin sesión/permiso, verificación de responsabilidad y fallo cerrado; CU04/CU05 pp. 33–35 describen consultas y filtros limitados. En ese análisis «RF-004» designa consulta de estudiantes (p. 19) y la tabla de usuarios «RF-026» restricción por rol (p. 23), mientras CU03 cita «RF-027» (p. 32): no son equivalentes a RF-004 V3. Ninguna de estas fuentes acredita aprobación o implementación.
- **Objetivos de calidad**: A §3.2 p. 17 documenta 30 concurrentes y 95 % de solicitudes dentro de 2 s como referencias generales. SC-005 y SC-006 son propuestas medibles de esta especificación, no métricas aprobadas ni resultados alcanzados. El flujo de autorización debe verificarse también con fallas de integración y con cambios de asignación, sin reemplazar esas pruebas por dobles como evidencia final.
