# Feature Specification: Autenticar usuarios

**Feature Branch**: `003-autenticar-usuarios`

**Created**: 2026-10-13

**Status**: Reglas de inactividad y recuperación confirmadas por el responsable para esta iteración; RF-003 de V3 sigue siendo propuesta original

**Input**: User description: "Leer los artefactos del módulo Usuarios y trabajar en docs/agent-context/modules/usuarios/features/autenticacion.md"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Iniciar sesión como personal autorizado (Priority: P1)

Como docente o administrador con cuenta activa, quiero identificarme con mi correo institucional y contraseña para acceder al piloto conforme a mis permisos vigentes.

**Why this priority**: Sin identificación fiable, ninguna operación protegida puede atribuirse a una persona autorizada.

**Independent Test**: Activar una cuenta mediante la invitación prevista en cuentas, iniciar sesión con su correo y contraseña y comprobar acceso a una función permitida; repetir con contraseña equivocada y cuentas pendiente e inactiva para verificar ausencia de acceso.

**Acceptance Scenarios**:

1. **Given** una cuenta activa de docente o administrador con rol válido y contraseña establecida, **When** su titular indica correo y contraseña correctos, **Then** obtiene un acceso nuevo vinculado a esa cuenta y puede solicitar únicamente funciones que su rol y responsabilidad permiten.
2. **Given** una contraseña errónea o un correo desconocido, **When** se intenta iniciar sesión, **Then** no se concede acceso y el mensaje no confirma si existe la cuenta.
3. **Given** una cuenta pendiente de aceptación de invitación o inactiva, **When** se presentan sus credenciales, **Then** no se concede acceso ni se abre una sesión utilizable.
4. **Given** una falla que impide verificar cuenta, credencial o estado, **When** se intenta iniciar sesión, **Then** no se concede acceso y se informa que el intento no pudo completarse.

---

### User Story 2 - Mantener y finalizar un acceso seguro (Priority: P2)

Como miembro del personal con acceso abierto, quiero continuar trabajando mientras estoy activo y cerrar mi acceso cuando termino, para evitar que otra persona use mi sesión.

**Why this priority**: El acceso debe terminar tanto por voluntad del titular como por inactividad o retiro de permisos.

**Independent Test**: Iniciar sesión, realizar una solicitud protegida antes de 30 minutos de inactividad y otra después de 30 minutos sin actividad; cerrar sesión y comprobar que el acceso anterior ya no funciona, incluso si se intenta reutilizar.

**Acceptance Scenarios**:

1. **Given** un acceso vigente de una cuenta activa, **When** se realiza una solicitud protegida antes de acumular 30 minutos sin actividad, **Then** se verifica nuevamente la vigencia y la solicitud puede continuar hacia la comprobación de permisos.
2. **Given** una sesión sin actividad durante 30 minutos completos, **When** se intenta usarla, **Then** se rechaza antes de exponer información y se exige un nuevo inicio de sesión; intentar prolongar ese acceso sin identificarse otra vez no lo reabre.
3. **Given** una sesión vigente, **When** el titular cierra sesión, **Then** esa sesión deja de dar acceso desde la siguiente solicitud, sin cerrar otras sesiones independientes de la misma cuenta.
4. **Given** una cuenta inactivada mientras tenía accesos abiertos, **When** se usa cualquiera de ellos o se intenta iniciar uno nuevo, **Then** se deniega el acceso desde la primera solicitud posterior a la inactivación.
5. **Given** un rol modificado durante una sesión vigente, **When** se solicita una operación protegida, **Then** se aplican los permisos vigentes en ese momento; el acceso anterior no conserva privilegios del rol previo.

---

### User Story 3 - Recuperar acceso a una cuenta activa (Priority: P3)

Como titular de una cuenta activa que olvidó su contraseña, quiero establecer otra tras comprobar mi control del correo asociado para volver a acceder sin que otra persona pueda apropiarse de mi cuenta.

**Why this priority**: La recuperación permite continuar el uso del piloto sin habilitar cuentas inactivas o pendientes ni compartir contraseñas.

**Independent Test**: Solicitar recuperación para una cuenta activa, completar la verificación enviada a su correo, establecer contraseña válida y entrar con la nueva; repetir con verificación vencida, reutilizada o dirigida a cuenta inactiva y comprobar que no cambia la contraseña ni habilita el acceso.

**Acceptance Scenarios**:

1. **Given** una cuenta activa y control de su correo vigente, **When** el titular usa una verificación de recuperación válida y establece una contraseña conforme a la política acordada, **Then** puede volver a identificarse con la nueva contraseña; la anterior y los accesos abiertos dejan de funcionar.
2. **Given** una verificación inválida, vencida, ya usada o una contraseña que no cumple la política, **When** se intenta completar la recuperación, **Then** se rechaza sin cambiar la contraseña anterior ni consumir una verificación todavía válida por un error de formato.
3. **Given** un correo desconocido, una cuenta pendiente o una inactiva, **When** se solicita recuperación, **Then** se presenta la misma confirmación neutra al solicitante y no se activa ni se concede acceso a esas cuentas.

### Edge Cases

- En el instante en que se cumplen los 30 minutos desde la última actividad aceptada, la sesión deja de ser válida; una solicitud rechazada no reinicia el plazo.
- Dos sesiones del mismo usuario mantienen actividad y cierre por separado; cerrar una no reanima otra vencida.
- Una petición directa a una función protegida sin acceso válido, incluso con identificadores de otra persona, se rechaza sin datos protegidos.
- Tras una inactivación, una reactivación posterior no recupera sesiones anteriores; se exige identificación nueva.
- Si no se puede verificar el estado de una sesión o de su cuenta durante una interrupción del servicio, se deniega el acceso en lugar de aceptar información antigua.
- La recuperación solicitada mientras una sesión está abierta invalida los accesos previos solo al completar correctamente el cambio de contraseña.
- Una verificación de recuperación utilizada simultáneamente solo puede completar una recuperación; los demás intentos no cambian la credencial.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir iniciar sesión al personal del piloto con correo institucional y contraseña de una cuenta activa, con exactamente un rol válido de Administrador o Docente; una cuenta pendiente, inactiva o sin rol válido NO DEBE recibir acceso.
- **FR-002**: El sistema DEBE rechazar contraseñas incorrectas y correos no reconocidos sin crear acceso ni revelar si la cuenta existe; NO DEBE mostrar ni devolver contraseñas durante los flujos de autenticación.
- **FR-003**: Tras validar la identidad, el sistema DEBE asociar cada sesión nueva a una única cuenta y permitir su uso para operaciones protegidas solo mientras esa sesión y la cuenta sigan vigentes; el acceso por sí mismo NO DEBE ampliar los permisos del rol ni el ámbito docente.
- **FR-004**: El sistema DEBE comprobar en cada solicitud protegida la vigencia de la sesión, el estado activo de la cuenta y el rol vigente antes de entregar datos o permitir cambios; sin sesión válida o si alguna verificación no puede completarse, DEBE denegar la operación sin exponer datos protegidos.
- **FR-005**: Cada sesión DEBE vencer al completar 30 minutos sin una solicitud protegida aceptada para esa sesión. Solo una solicitud aceptada antes del vencimiento DEBE reiniciar su plazo de inactividad; una sesión vencida NO DEBE poder renovarse sin un nuevo inicio de sesión.
- **FR-006**: El titular DEBE poder cerrar su sesión actual; desde la primera solicitud posterior al cierre esa sesión DEBE ser inválida. El cierre de una sesión NO DEBE cerrar otras sesiones independientes de la misma cuenta.
- **FR-007**: Al inactivar una cuenta, el sistema DEBE impedir nuevos inicios de sesión y el uso de todas sus sesiones previas desde la primera solicitud posterior; una reactivación NO DEBE restablecerlas.
- **FR-008**: El sistema DEBE aplicar en cada nueva solicitud los permisos correspondientes al rol vigente. La definición detallada de operaciones y ámbito permitido corresponde a la feature de autorización; un cambio de rol NO DEBE conservar los privilegios anteriores.
- **FR-009**: Para una cuenta activa que haya olvidado su contraseña, el sistema DEBE ofrecer recuperación mediante verificación del control de su correo vigente, utilizable una sola vez dentro de los 30 minutos de su emisión; sin verificación válida NO DEBE cambiar la contraseña.
- **FR-010**: Una nueva contraseña aceptada en recuperación DEBE cumplir al menos ocho caracteres, una letra mayúscula, una minúscula y un número; al completarse la recuperación DEBE dejar de servir la contraseña anterior e invalidar todas las sesiones abiertas de esa cuenta. Un intento inválido NO DEBE cambiar la contraseña ni consumir una verificación aún válida por un error de formato.
- **FR-011**: La solicitud de recuperación DEBE responder de forma indistinguible para correo inexistente y cuentas activas, pendientes o inactivas; NO DEBE convertir una cuenta pendiente o inactiva en activa ni permitir su acceso.
- **FR-012**: Ante fallo al verificar identidad, estado, sesión o recuperación, el sistema DEBE denegar el acceso y ofrecer un mensaje comprensible que no exponga credenciales, detalles de otras cuentas ni datos de estudiantes.

### Key Entities *(include if feature involves data)*

- **Cuenta de personal**: Identidad del administrador o docente, con correo institucional, estado pendiente/activo/inactivo, rol único y credencial vigente; su ciclo de vida se gestiona en la feature de cuentas.
- **Sesión de usuario**: Acceso individual ligado a una cuenta, con momento de última actividad aceptada y estado vigente, cerrado o vencido; es distinta de una sesión de tarea del estudiante.
- **Verificación de recuperación**: Comprobación temporal y de un solo uso asociada a la cuenta y a su correo vigente para autorizar un cambio de contraseña, sin habilitar por sí sola una sesión.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una matriz con cuentas activas, pendientes e inactivas y credenciales correctas, incorrectas o de correo inexistente, el 100 % de accesos válidos llega a las funciones que correspondan al rol, y el 100 % de accesos no válidos queda sin sesión utilizable ni datos protegidos.
- **SC-002**: En pruebas de frontera con 29 minutos 59 segundos y 30 minutos sin actividad, el 100 % de sesiones aún vigentes continúa y el 100 % de las que alcanzaron 30 minutos exige identificarse de nuevo, incluso tras un intento de prolongarlas.
- **SC-003**: En una prueba con dos sesiones simultáneas por cuenta, el 100 % de cierres invalida solo la sesión cerrada; tras inactivación o recuperación completada, el 100 % de solicitudes con accesos previos se deniega desde la primera solicitud posterior.
- **SC-004**: En casos de indisponibilidad de verificación de cuenta o sesión y de peticiones directas sin sesión, el 100 % de intentos de acceder a información protegida se deniega sin mostrar datos de terceros.
- **SC-005**: En una prueba guiada con al menos cinco miembros activos del personal piloto, al menos el 90 % logra iniciar y cerrar sesión sin ayuda en menos de 2 minutos por recorrido.
- **SC-006**: En una matriz de recuperación válida, vencida, reutilizada, simultánea y dirigida a cuentas no activas, el 100 % de cambios no autorizados se rechaza; un cambio autorizado invalida la contraseña anterior y todos los accesos previos.

## Assumptions

- **Alcance y dependencias**: Esta feature cubre identificación del personal ADMIN/TEACHER, vigencia, cierre y recuperación de acceso. El alta, invitación, activación, inactivación y reactivación proceden de [Gestionar cuentas y roles](../001-gestionar-cuentas-roles/spec.md); la validación de contraseña procede de [Validar perfil y acceso](../002-validar-perfil-acceso/spec.md). La matriz de permisos y las asignaciones de grupos pertenecen a [Autorización por rol y responsabilidad](../../docs/agent-context/modules/usuarios/features/autorizacion.md) y Académico. El acceso del estudiante mediante código queda pendiente en otra feature.
- **Decisiones ya registradas**: `specs/001-gestionar-cuentas-roles/spec.md` consigna decisiones expresas del responsable: invitación antes de activar al titular, una cuenta con un rol ADMIN/TEACHER, correo `.edu.co` y contraseña de ocho caracteres con mayúscula, minúscula y número. No se reinterpreta una invitación como inicio de sesión.
- **Recuperación**: El responsable confirmó el 2026-10-13 recuperar acceso a cuenta activa mediante enlace de un solo uso enviado al correo vigente, válido 30 minutos y con revocación de todas las sesiones al cambiar la contraseña. Estas reglas proceden de esa confirmación, no de V3 ni del análisis. Una contraseña inválida no consume una verificación vigente.
- **Actividad de sesión**: El responsable confirmó el 2026-10-13 que solo una solicitud protegida aceptada reinicia la inactividad; la sesión vence al cumplir 30 minutos desde ese éxito. Consultar sesión, intentos denegados y uso de interfaz no cuentan como actividad. La meta de facilidad de uso sigue siendo propuesta, no una cifra aprobada en las fuentes.
- **Límites de diseño**: El diseño D §6 pp. 14–16 y el PUML de Usuarios proponen Google, Better Auth e intercambio de token opaco por JWT; D §3.2 p. 10 también propone JWT directo. No se da por aprobado ninguno ni se incorpora acceso con Google, vinculación automática de cuentas o emisión concreta a este contrato funcional; elegir un mecanismo y registrar sus contratos corresponde al plan tras validación institucional. No se presupone una ruta de servicio concreta.
- **Evidencia y estado**: `docs/original/requisitos_V3.xlsx`, hoja «RF corregidos», fila 4, RF-003 V3, estado «Propuesto - corregido para validación», pide autenticar cuentas activas, invalidar sesiones y permitir cierre controlado. `docs/original/3 ANALISIS DEL PROYECTO.docx.pdf`, §6.1.1 CU02 p. 31 y secuencia §7.3 pp. 44–45, describe cuenta activa, contraseña, sesión, rol, errores y vencimiento por 30 minutos; §3.2 pp. 17–18 expresa la meta de inactividad. `docs/original/DESCRIPCIÓN DE DISEÑO DE SOFTWARE.docx.pdf`, §§3.1–3.2 pp. 8–12 y §6 pp. 14–16, propone modelo de sesiones y alternativas técnicas; `docs/original/C4/UML/users-jwt-code-diagram.puml`, líneas 47–57, propone actividad independiente por sesión y que renovar credenciales no revive una sesión vencida. El DBML `docs/original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml`, líneas 26–42, propone cuenta y sesiones. Son fuentes de análisis/diseño, no prueba de aprobación o implementación. El análisis usa RF-025 y RF-026 para autenticación en pasajes distintos mientras V3 la llama RF-003; sus IDs no se consideran equivalentes.
