# Feature Specification: Gestionar cuentas y roles

**Feature Branch**: `001-gestionar-cuentas-roles`

**Created**: 2026-10-12

**Status**: Especificada (reglas de cuentas confirmadas por el responsable del proyecto)

**Input**: User description: "Haz la especificacion para el desarrollo de la feature de gestionar cuentas y roles que está definida en el archivo cuentas.md de los archivos de resumen"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Crear y consultar cuentas (Priority: P1)

Como administrador con permiso de gestión, quiero dar de alta una cuenta para una persona del
piloto y consultar las cuentas existentes para que solo personal autorizado pueda participar.

**Why this priority**: Sin altas y consultas no es posible administrar el acceso al piloto.

**Independent Test**: Con un administrador autorizado, registrar una cuenta de docente,
comprobar que queda pendiente y aparece en el listado, aceptar la invitación como titular
y comprobar que se activa; repetir con correo duplicado y con un docente sin permiso de
gestión para verificar rechazo sin cambios.

**Acceptance Scenarios**:

1. **Given** un administrador activo y autorizado y un correo institucional no registrado,
   **When** registra nombre completo, correo terminado en `.edu.co` y rol Docente,
   **Then** se crea una cuenta pendiente con ese único rol, se emite una invitación y aparece
   en las consultas y queda constancia de quién la creó y cuándo.
2. **Given** un correo ya asignado a una cuenta activa o inactiva, **When** se intenta crear
   otra cuenta con ese correo, **Then** se rechaza la creación, se informa el conflicto y
   la cuenta original permanece intacta.
3. **Given** una persona no autenticada o un docente autenticado, **When** intenta crear o
   consultar cuentas, **Then** se deniega la operación sin exponer datos de otras cuentas.
4. **Given** una cuenta pendiente con invitación de menos de siete días, **When** su titular
   establece una contraseña válida, **Then** la cuenta pasa a activa y puede acceder con los
   permisos de su único rol; antes de ello se le deniega el acceso.
5. **Given** el primer arranque con una base sin cuentas, **When** inicia la aplicación con
   credenciales iniciales configuradas de manera segura, **Then** existe un administrador
   activo listo para gestionar invitaciones; un reinicio no crea otro administrador.

---

### User Story 2 - Actualizar datos y solicitar ascenso (Priority: P2)

Como administrador autorizado, quiero corregir datos y decidir solicitudes de ascenso; como
docente activo, quiero pedir el rol Administrador para que un administrador existente evalúe
la solicitud antes de otorgarme permisos adicionales.

**Why this priority**: Los cambios de responsabilidad deben reflejarse sin mantener
privilegios antiguos.

**Independent Test**: Modificar nombre/correo de una cuenta; como docente pedir ascenso y
comprobar que sigue siendo TEACHER mientras está pendiente. Un ADMIN distinto lo aprueba,
se comprueba el nuevo rol y la traza; probar rechazo, autoaprobación, correo duplicado y rol inválido.

**Acceptance Scenarios**:

1. **Given** una cuenta existente y un administrador autorizado, **When** actualiza un dato
   editable válido, **Then** el dato nuevo se consulta de inmediato, el resto permanece
   igual y queda registrado quién hizo el cambio, qué cambió y cuándo.
2. **Given** una cuenta activa de docente, **When** solicita el rol Administrador,
   **Then** la petición queda pendiente y no gana permisos de administración.
3. **Given** una solicitud de ascenso pendiente, **When** un administrador activo distinto del
   solicitante la aprueba, **Then** se reemplaza TEACHER por ADMIN, se registran solicitante,
   aprobador y fecha, y los permisos actuales rigen desde la siguiente solicitud.
4. **Given** una solicitud de ascenso pendiente, **When** un administrador la rechaza,
   **Then** la cuenta conserva el rol TEACHER y la decisión queda registrada.
5. **Given** un correo duplicado, un rol no habilitado, una autoaprobación o una modificación no autorizada,
   **When** se intenta guardar, **Then** se rechaza toda la operación y los datos y permisos
   previos permanecen vigentes.

---

### User Story 3 - Inactivar y reactivar cuentas (Priority: P3)

Como administrador autorizado, quiero retirar y, si procede, restituir el acceso de una
persona sin borrar su historia, para gestionar cambios de personal con trazabilidad.

**Why this priority**: Revocar acceso es necesario ante un retiro, sin perder autoría de
acciones pasadas; V3 incluye activar cuentas, aunque su flujo requiere validación.

**Independent Test**: Inactivar una cuenta con acceso vigente, verificar que deja de poder
usar su acceso anterior o iniciar otro y que los registros históricos subsisten; cancelar
otra inactivación y comprobar que no cambia; reactivar y comprobar que los accesos previos
no se restauran automáticamente.

**Acceptance Scenarios**:

1. **Given** una cuenta activa, **When** el administrador solicita inactivarla y cancela
   la confirmación, **Then** la cuenta y sus accesos permanecen como estaban.
2. **Given** una cuenta activa y una confirmación explícita, **When** el administrador la
   inactiva, **Then** pierde de inmediato el acceso incluso si lo tenía abierto, se impiden
   nuevos accesos y se conserva su historial y el registro del cambio.
3. **Given** una cuenta ya inactiva, **When** se intenta inactivarla de nuevo, **Then** se
   informa su estado sin crear otra transición de estado.
4. **Given** una cuenta inactiva con rol permitido y un administrador autorizado, **When**
   se confirma su reactivación, **Then** vuelve a figurar activa, queda trazada la acción
   y necesita una nueva validación de identidad antes de acceder.

### Edge Cases

- Dos administradores intentan crear simultáneamente el mismo correo: como máximo se crea
  una cuenta; la otra operación informa duplicidad.
- Se intenta reutilizar el correo de una cuenta inactiva: se rechaza la nueva alta y se
  informa que debe gestionarse la cuenta existente.
- Se cambia el rol o se inactiva la propia cuenta administradora mientras hay acceso
  abierto: en la siguiente operación se vuelven a verificar sus permisos actuales;
  no puede autoconcederse privilegios por una solicitud directa.
- Una invitación es utilizada por alguien distinto de su titular o después de dejar
  de ser válida: no se activa la cuenta y se informa que requiere una nueva invitación.
- Un administrador intenta crear directamente una segunda cuenta ADMIN o un docente intenta
  aprobar su propia solicitud: se rechaza el ascenso sin cambio de rol.
- Un docente inactivo o con una solicitud de ascenso ya pendiente intenta solicitar de nuevo:
  se rechaza o se informa el estado existente sin duplicar la petición.
- Se reinicia el servicio con el administrador inicial ya creado: no se duplica ni se
  restablecen sus credenciales; tampoco se reactivan cuentas previamente inactivadas.
- Se intenta degradar o inactivar al último administrador activo: se deniega la operación
  para no dejar solicitudes de ascenso sin una persona capaz de decidirlas.
- Se intenta dejar una cuenta activa sin rol: se rechaza sin cambiar su estado.
- Si falla el registro de la operación o la actualización de permisos/estado, no se
  confirma un cambio parcial de cuenta; se informa el fallo y se conserva el estado anterior.
- Si la identidad o el permiso del administrador no puede verificarse, se deniega la
  operación; no se muestran datos de usuarios.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE restringir la creación, consulta y actualización de otras cuentas,
  aprobación de ascensos, cambios de rol, inactivación y reactivación a administradores activos
  con permiso vigente de gestión; DEBE validar ese permiso en cada operación. Un docente activo
  solo puede presentar y consultar su propia solicitud de ascenso, nunca gestionarla.
- **FR-002**: El sistema DEBE crear cuentas con nombre completo, correo institucional y
  exactamente un rol. Las altas ordinarias empiezan exclusivamente como Docente; solo el
  arranque inicial crea un Administrador sin solicitud previa. No se ofrecen roles de
  estudiante, acudiente ni psicopedagogo en esta feature.
- **FR-003**: El sistema DEBE validar campos obligatorios, correo con formato válido,
  dominio de correo terminado en `.edu.co` (comprobado sobre el dominio después de `@`,
  sin distinguir mayúsculas/minúsculas) y unicidad del correo frente a cuentas activas,
  pendientes e inactivas, también ante altas o ediciones simultáneas.
- **FR-004**: Una cuenta recién creada DEBE quedar pendiente de activación y DEBE
  emitir una invitación vinculada al correo de esa cuenta. Solo el titular que
  complete la invitación dentro de los siete días posteriores a su emisión y
  establezca una contraseña que cumpla FR-015 DEBE pasar a estado activo; antes
  de ello DEBE carecer de acceso. Una invitación vencida, inválida, usada o
  destinada a otra cuenta DEBE rechazarse sin activarla.
- **FR-005**: El sistema DEBE permitir al administrador consultar el listado y el detalle
  de cuentas, incluyendo nombre, correo, rol y estado, sin exponer credenciales o datos
  de estudiantes.
- **FR-006**: El sistema DEBE permitir editar nombre y correo de una cuenta, volver a
  validar los datos cambiados y conservar sin modificación los campos no editables,
  el historial y la identidad de la cuenta.
- **FR-007**: Cada cuenta DEBE tener exactamente un rol entre ADMIN y TEACHER; cambiarlo
  DEBE reemplazar el anterior, sin acumular privilegios. El cambio TEACHER→ADMIN solo
  se permite tras solicitud del titular y aprobación de un ADMIN activo distinto.
  No se permite la autoaprobación ni crear cuentas ADMIN por el alta ordinaria.
- **FR-008**: Toda cuenta activa DEBE conservar su rol válido; una solicitud que la
  deje sin rol DEBE rechazarse sin modificar sus permisos.
- **FR-009**: Después de cambiar un rol, el sistema DEBE aplicar los permisos actuales
  a toda solicitud posterior, incluso si el usuario tenía acceso abierto antes del cambio;
  el rol Docente por sí solo no permite administrar cuentas ni ver datos de estudiantes
  fuera de su responsabilidad.
- **FR-010**: El sistema DEBE exigir confirmación explícita antes de inactivar una
  cuenta y permitir cancelar sin efecto alguno.
- **FR-011**: Al inactivar una cuenta, el sistema DEBE bloquear nuevos accesos y los
  accesos ya abiertos, sin borrar su cuenta, historial ni autoría previa.
- **FR-012**: El sistema DEBE permitir la reactivación explícita por administrador de
  una cuenta inactiva que aún tenga rol válido y credenciales vigentes; no DEBE
  restaurar accesos anteriores y el titular DEBE volver a identificarse. Si ya
  está activa/inactiva en una operación repetida, DEBE informar el estado actual
  sin crear otra transición.
- **FR-013**: Cada alta, edición, cambio de rol y cambio de estado exitosos DEBEN
  quedar trazados con actor, cuenta afectada, acción, fecha y valores de estado/rol
  anteriores y nuevos cuando corresponda; las solicitudes y decisiones de ascenso
  DEBEN conservar solicitante, aprobador o rechazador y fecha. Solo usuarios
  autorizados pueden consultar esa traza y ninguna persona gestora puede editarla.
- **FR-014**: Si falla la validación, la autorización o el registro de un cambio,
  el sistema DEBE informar el motivo apropiado y conservar íntegros cuenta, rol,
  estado y permisos previos sin mostrar datos privados al actor no autorizado.
- **FR-015**: Toda contraseña aceptada para estas cuentas (alta, bootstrap,
  cambio o restablecimiento) DEBE tener al menos ocho caracteres, incluir por
  lo menos una letra mayúscula, una minúscula y un número; si no los cumple,
  DEBE rechazarse sin activar la cuenta ni consumir la invitación.
- **FR-016**: En el primer arranque sobre una base sin cuentas, el sistema DEBE
  crear una única cuenta ADMIN activa a partir de credenciales aportadas mediante configuración
   segura que cumplan FR-003 y FR-015. DEBE impedir el arranque sin ellas cuando
   la base esté vacía; reinicios posteriores NO DEBEN crear duplicados,
   sobrescribir credenciales ni reactivar cuentas inactivas.
- **FR-017**: Un TEACHER activo DEBE poder solicitar su ascenso a ADMIN; la
  petición queda pendiente sin cambiar privilegios. Un ADMIN activo diferente
  DEBE poder aprobarla o rechazarla una sola vez; solo la aprobación cambia el
  rol y la decisión queda auditada. Una cuenta inactiva o una solicitud ya
  resuelta no DEBE poder aprobarse.
- **FR-018**: Los registros de cuentas, historial de invitaciones, auditoría,
  solicitudes y decisiones de ascenso DEBEN conservarse indefinidamente,
  aun si se inactiva la cuenta;
  no habrá eliminación automática por antigüedad ni borrado desde esta feature.
- **FR-019**: El sistema DEBE impedir que un cambio de rol o inactivación deje
  al piloto sin ningún administrador activo; el intento DEBE conservar el rol,
  el estado y el acceso anteriores.

### Key Entities *(include if feature involves data)*

- **Cuenta de usuario**: Persona administradora o docente, identidad estable, nombre,
  correo institucional único, un rol asignado y estado pendiente/activo/inactivo.
- **Rol permitido**: Administrador o Docente, que delimita operaciones disponibles;
  sustituirlo no conserva los permisos del rol anterior.
- **Invitación de activación**: Derecho de uso único asociado a una cuenta y al correo
  de su titular, vigente durante siete días desde su emisión o hasta completarse.
- **Solicitud de ascenso**: Petición de un docente activo para recibir el rol ADMIN,
  con estado pendiente, aprobada o rechazada y decisión de un administrador diferente.
- **Sesión de usuario**: Acceso vigente a funciones protegidas, asociado a una cuenta;
  la inactivación o pérdida de privilegios impide continuar usándolo.
- **Registro de gestión**: Evidencia de actor, cuenta afectada, operación, momento y
  cambio realizado; se conserva aun cuando la cuenta pase a inactiva.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una revisión de los recorridos (crear/invitar/activar/consultar,
  editar, solicitar/decidir ascenso e inactivar/reactivar), el 100 % de los casos válidos produce
  el estado esperado y la confirmación correspondiente.
- **SC-002**: En los escenarios de prueba con administrador, docente, acceso vencido
  y ausencia de autenticación, el 100 % de las acciones de gestión no autorizadas
  son rechazadas sin cambios ni exposición de datos de otras cuentas.
- **SC-003**: Tras cada inactivación o reducción de privilegios, el 100 % de los
  intentos de usar un acceso previo para una operación que ya no corresponde son
  denegados desde la primera solicitud posterior al cambio.
- **SC-004**: El 100 % de las altas, ediciones, cambios de rol y transiciones de
  estado exitosas es rastreable hasta la persona que las realizó, la cuenta
  afectada y el momento, sin perder registros al inactivar una cuenta.
- **SC-005**: En una prueba guiada con administradores que conocen el piloto, al
  menos el 90 % puede crear una cuenta válida y reconocer un error de duplicidad
  sin ayuda adicional en un máximo de 3 minutos por intento.
- **SC-006**: En el 100 % de los escenarios de correo, contraseña e invitación,
  se rechazan dominios distintos de `.edu.co`, contraseñas sin los tres tipos
  de caracteres o con menos de ocho, e invitaciones usadas o con siete días
  cumplidos; una invitación válida activa exactamente una cuenta.
- **SC-007**: En el 100 % de los ascensos ensayados, ningún TEACHER obtiene permisos
  ADMIN antes de la aprobación de otro ADMIN, ni después de un rechazo.
- **SC-008**: En tres arranques consecutivos con la misma base, existe solo una
  cuenta ADMIN creada por bootstrap, conserva sus credenciales originales y todos los
  registros de auditoría siguen consultables, incluidos los de cuentas inactivas.
- **SC-009**: En el 100 % de los intentos de degradar o inactivar al último ADMIN
  activo, el sistema conserva un administrador activo y rechaza el cambio.

## Assumptions

- **Alcance**: Se gestiona personal adulto con un único rol Administrador o Docente; alta de
  estudiantes, acceso de acudientes y permisos concretos por estudiante/grupo pertenecen
  a otras features. El correo de una cuenta inactiva no queda disponible para otra alta.
- **Reactivación**: V3 RF-001 menciona activar cuentas sin describir el flujo; se
  propone reactivación por administrador con confirmación, rol válido y nuevo
  inicio de sesión, sujeta a validación institucional. Si las credenciales ya no
  son válidas, la recuperación de acceso se trata en la feature de autenticación.
- **Decisiones de alcance de esta especificación**: El responsable del proyecto
  eligió invitación con activación por el titular, un solo rol por cuenta, correos
  `.edu.co`, contraseña mínima de ocho con mayúscula/minúscula/número, invitación
  de siete días, ascenso solicitado y aprobado por otro administrador, ADMIN
  inicial automático y conservación indefinida de registros. Son decisiones
  explícitas del usuario, no requisitos aprobados en V3.
- **Precondiciones**: Existe un medio aprobado para comprobar identidad y sesión del
  administrador; especificar el mecanismo de autenticación y su política concreta
  corresponde a las features de validación y autenticación, no a este documento.
- **Configuración operativa**: Las credenciales del ADMIN inicial se suministran
  fuera del código y del repositorio. La invitación se entrega al correo indicado;
  el proveedor de envío, remitente y URL pública se configuran al desplegar.
  Las reglas funcionales anteriores ya están definidas.
- **Fuentes y estado**: La solicitud se basa en V3 `requisitos_V3.xlsx`, hoja «RF
  corregidos», fila 2 (RF-001, «Propuesto - corregido para validación»); hoja
  «Decisiones y pendientes», fila 8 (D-07 pendiente) y fila 9 (D-08 propuesto).
  El análisis anterior `3 ANALISIS DEL PROYECTO.docx.pdf`, pp. 27–30,
  CU01-S1…S4, usa RF-024 para usuarios (en su §4.2 el ID está duplicado con
  Tareas). El modelo `esquema.dbml`, líneas 5–7, 26–42 y 89–98, propone un solo
  rol, sesiones y auditoría. El diseño `DESCRIPCIÓN DE DISEÑO DE SOFTWARE.docx.pdf`,
  §5 p. 13, declara ADR-04 adoptada, sin que ello apruebe todavía RF-001 V3 ni
  garantice técnicamente la inmutabilidad. Las citas identifican propuesta y
  conflicto; no afirman implementación existente.
