# Feature Specification: Correo transaccional SMTP

**Feature Branch**: `feat/configure-smtp`

**Created**: 2026-10-23

**Status**: Draft — requisitos nuevos propuestos para revisión del responsable

**Input**: User description: "smtp mailing feature"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recibir una invitación de acceso (Priority: P1)

Como docente invitado por un administrador autorizado, quiero recibir un correo de Kudlab con instrucciones claras para activar mi cuenta, sin compartir contraseñas.

**Why this priority**: La invitación es el punto de entrada del personal nuevo al piloto.

**Independent Test**: Crear una cuenta ficticia mediante el flujo autorizado, recibir su invitación en un buzón controlado y completar la activación mediante el enlace recibido.

**Acceptance Scenarios**:

1. **Given** una configuración de correo válida y un alta autorizada, **When** se emite la invitación, **Then** el destinatario asociado recibe un mensaje en español, con remitente identificable como Kudlab, propósito de activación y enlace correspondiente a esa invitación.
2. **Given** una invitación enviada, **When** el proveedor acepta el mensaje, **Then** el sistema informa aceptación del envío sin afirmar llegada a la bandeja de entrada ni activar la cuenta automáticamente.
3. **Given** un rechazo explícito del proveedor, **When** se intenta enviar la invitación, **Then** el administrador recibe un aviso de fallo comprensible, la cuenta permanece pendiente y no se crea una segunda cuenta.

---

### User Story 2 - Recibir verificaciones de correo y recuperación (Priority: P1)

Como titular de una cuenta, quiero identificar si un mensaje sirve para confirmar mi nuevo correo o recuperar mi acceso, y recibir el enlace correcto para esa acción.

**Why this priority**: Confundir acciones de seguridad dificulta recuperar acceso y verificar el correo correcto.

**Independent Test**: Con cuentas ficticias independientes, solicitar un cambio de correo autorizado y una recuperación de acceso; comprobar destinatario, contenido y funcionamiento de cada enlace.

**Acceptance Scenarios**:

1. **Given** un cambio de correo permitido para una cuenta activa, **When** se solicita su verificación, **Then** el mensaje llega al nuevo correo, identifica la acción y el correo vigente no se sustituye hasta completar la confirmación.
2. **Given** una cuenta activa apta para recuperación, **When** se solicita recuperar acceso, **Then** se envía al correo vigente un mensaje específico de recuperación, sin contraseña, con el enlace emitido por ese flujo.
3. **Given** un correo desconocido o una cuenta pendiente o inactiva, **When** se solicita recuperación, **Then** se conserva la misma confirmación pública neutra y no se envía una recuperación utilizable para esa cuenta.
4. **Given** un fallo de envío durante recuperación, **When** el solicitante recibe respuesta, **Then** se mantiene la confirmación neutra, sin afirmar entrega ni revelar la existencia de la cuenta; el fallo es diagnosticable por operación autorizada.
5. **Given** un enlace vencido, usado o invalidado, **When** se intenta completar su acción, **Then** se rechaza según las reglas del flujo de origen; haber enviado el mensaje no extiende su vigencia.

---

### User Story 3 - Configurar y verificar el envío seguro (Priority: P2)

Como responsable del despliegue, quiero configurar el proveedor de correo y reconocer problemas de configuración o envío sin exponer secretos ni enviar mensajes reales durante pruebas aisladas.

**Why this priority**: El correo debe funcionar fuera de las pruebas sin ocultar fallos ni comprometer credenciales.

**Independent Test**: Verificar configuraciones válida, incompleta y sin conexión segura; ejecutar los tres recorridos en un entorno aislado y comprobar que no llegan mensajes a destinatarios externos.

**Acceptance Scenarios**:

1. **Given** una configuración incompleta o inválida, **When** se inicia el servicio en un entorno con envío real, **Then** se impide el arranque y se identifica qué ajuste debe corregirse sin mostrar secretos.
2. **Given** un proveedor que no puede establecer una conexión cifrada con identidad verificable, **When** se intenta enviar, **Then** se rechaza el envío sin recurrir a una conexión insegura.
3. **Given** un entorno de pruebas aislado, **When** se ejecutan los recorridos de correo, **Then** los mensajes se pueden inspeccionar localmente y no se entregan a destinatarios externos; ese modo no se admite fuera de pruebas.
4. **Given** un fallo de autenticación, rechazo o interrupción del proveedor, **When** se revisa el diagnóstico autorizado, **Then** se identifica la operación y el resultado sin contraseña, enlace completo ni código de verificación.

### Edge Cases

- El proveedor acepta el mensaje pero falla el registro local posterior: indicar resultado incierto, no un rechazo confirmado, y no reenviar automáticamente.
- La conexión se interrumpe sin respuesta concluyente: tratar el resultado como incierto y no afirmar entrega ni rechazo definitivo.
- El proveedor rechaza al destinatario: el intento no cuenta como aceptado aunque la conexión haya sido exitosa.
- Se cambia el correo o se emite una verificación sustitutiva antes de abrir un mensaje anterior: el enlace anterior conserva las restricciones del flujo de origen.
- El asunto, nombre visible o destinatario contienen caracteres especiales: conservar los valores válidos sin permitir destinatarios adicionales ni alteración de los encabezados.
- Un actor no autorizado intenta aprovechar el envío para escribir a terceros: denegar la operación de origen; no existe un envío libre o masivo en esta feature.
- El mensaje es aceptado pero termina en spam o rebota después: no convertir aceptación en prueba de lectura o llegada; el seguimiento posterior queda fuera de alcance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE enviar mensajes transaccionales para invitación, confirmación de cambio de correo y recuperación de acceso, únicamente cuando el flujo de origen autorice y emita la verificación. NO DEBE ofrecer envío libre a destinatarios arbitrarios.
- **FR-002**: Cada mensaje DEBE identificar a Kudlab y su propósito mediante asunto y contenido en español, incluir instrucciones para completar la acción, el enlace correspondiente y una indicación de ignorarlo si no se reconoce la solicitud. Su contenido DEBE poder leerse sin imágenes ni formato enriquecido.
- **FR-003**: El destinatario DEBE proceder del flujo autorizado: correo de la invitación, nuevo correo por verificar o correo vigente para recuperación. El mensaje NO DEBE incluir contraseñas, credenciales del proveedor, datos de estudiantes, notas ni observaciones pedagógicas.
- **FR-004**: El enlace DEBE usar la dirección pública configurada para la acción y la verificación emitida por su flujo, sin mezclar acciones. El envío NO DEBE cambiar vigencia, uso único, invalidación, permisos ni condiciones de activación o confirmación existentes.
- **FR-005**: El responsable del despliegue DEBE poder configurar servidor, puerto, credenciales y dirección remitente sin modificar el código ni incorporar secretos al repositorio. Una configuración incompleta o inválida DEBE impedir el arranque en modo de envío real, indicando el ajuste afectado sin revelar valores secretos.
- **FR-006**: Los envíos reales DEBEN utilizar una conexión cifrada que verifique la identidad del proveedor. Si no puede establecerse, DEBE rechazarse el envío sin degradación a una conexión insegura.
- **FR-007**: Un intento DEBE distinguir aceptación del destinatario por el proveedor, rechazo confirmado y resultado incierto. La aceptación NO DEBE presentarse como llegada al buzón, lectura ni finalización de la acción del usuario.
- **FR-008**: Ante rechazo confirmado de invitación o cambio de correo, el actor autorizado DEBE recibir un aviso comprensible de fallo. Ante incertidumbre, DEBE recibir un aviso que no afirme rechazo ni entrega. Ninguno de estos resultados DEBE activar cuentas, confirmar correos o crear cuentas duplicadas.
- **FR-009**: La recuperación DEBE conservar la confirmación pública neutra para cuentas existentes o desconocidas, con independencia del resultado del envío. Los fallos DEBEN ser diagnosticables por operación autorizada sin exponer la existencia de una cuenta al solicitante.
- **FR-010**: Los diagnósticos de envío DEBEN permitir distinguir propósito, momento, referencia interna de la operación y resultado o categoría de fallo. NO DEBEN incluir contraseñas, códigos de verificación, enlaces completos ni contenido del mensaje; su consulta DEBE restringirse al personal autorizado de operación.
- **FR-011**: En pruebas aisladas DEBE poder inspeccionarse el destinatario, propósito y enlace sin envío externo. El modo de captura DEBE rechazarse fuera de pruebas; los mensajes capturados solo DEBEN usar datos ficticios.
- **FR-012**: Un único intento NO DEBE provocar reenvíos automáticos, incluidos resultados inciertos. Las nuevas solicitudes explícitas DEBEN respetar las reglas de sustitución e invalidación del flujo de origen, sin ampliar permisos ni reactivar verificaciones anteriores.
- **FR-013**: La configuración y el procedimiento de comprobación DEBEN documentar ajustes requeridos, protección de secretos, verificación de los tres recorridos y diferencia entre aceptación del proveedor y recepción. La comprobación operativa DEBE realizarse con buzones controlados, sin crear una función pública de envío de prueba.
- **FR-014**: El sistema DEBE rechazar entradas que permitan alterar destinatarios o encabezados del mensaje mediante caracteres de control, sin enviar mensajes adicionales.

### Key Entities *(include if feature involves data)*

- **Mensaje transaccional**: Comunicación de un propósito permitido, con remitente, destinatario, asunto, instrucciones y enlace asociado a una verificación existente. No implica almacenar una copia permanente.
- **Configuración del proveedor**: Ajustes privados del servicio de correo y dirección remitente, administrados por despliegue, no por el solicitante del mensaje.
- **Resultado de intento**: Aceptado, rechazado o incierto, asociado al propósito y referencia de la operación para diagnóstico; no representa lectura ni recepción final.
- **Verificación existente**: Autorización temporal emitida por invitaciones, cambio de correo o recuperación. Su ciclo de vida sigue perteneciendo al flujo de origen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una prueba con cinco mensajes por cada uno de los tres propósitos, el 100 % llega al buzón controlado correcto y permite identificar y completar la acción correspondiente; al menos el 95 % llega en menos de 60 segundos desde la solicitud con el proveedor disponible. Es una meta propuesta de validación, no una garantía frente a proveedores externos.
- **SC-002**: En la matriz de configuración incompleta, credenciales incorrectas, conexión insegura, rechazo y desconexión incierta, el 100 % de los casos produce el resultado definido sin afirmar una entrega no comprobada ni modificar indebidamente la cuenta.
- **SC-003**: En todas las pruebas de recuperación con cuentas activas, pendientes, inactivas y desconocidas, la confirmación pública conserva el mismo contenido y no expone resultados privados del envío.
- **SC-004**: En la revisión de mensajes y diagnósticos de los tres recorridos, se encuentran cero contraseñas o datos de estudiantes; en diagnósticos se encuentran además cero códigos de verificación o enlaces completos.
- **SC-005**: En pruebas aisladas de los tres recorridos, se producen cero entregas externas; el 100 % de intentos de habilitar captura fuera de pruebas se rechaza.
- **SC-006**: Al menos cuatro de cinco personas de prueba identifican correctamente la acción de los tres mensajes y encuentran cómo continuar sin ayuda. Los participantes utilizan cuentas ficticias, sin involucrar menores.

## Assumptions

- **Alcance propuesto**: Se interpreta la solicitud como consolidar el correo transaccional existente, no crear marketing, campañas, adjuntos, notificaciones académicas, editor de plantillas, interfaz administrativa de correo, colas persistentes, reintentos automáticos ni seguimiento de rebotes o lectura. No se cambia el acceso de estudiantes ni se agregan roles.
- **Dependencias**: Se requiere un proveedor SMTP accesible, credenciales y remitente autorizados, buzones controlados para validación y pantallas públicas existentes que entiendan los enlaces de cada acción. Elegir proveedor y resolver su autorización de remitente corresponde al despliegue; implementar pantallas nuevas no forma parte de esta feature.
- **Reglas conservadas**: [Cuentas y roles](../001-gestionar-cuentas-roles/spec.md), FR-004, establece invitaciones de siete días y activación posterior a su aceptación. [Autenticación](../003-autenticar-usuarios/spec.md), FR-009–011, establece recuperación de un solo uso durante 30 minutos y respuesta neutra. Se usan como decisiones registradas en especificaciones existentes, no como aprobación nueva ni como reglas deducidas de V3.
- **Base observada**: En la revisión del 2026-10-23 ya existen envío de invitaciones, cambio de correo y recuperación. Se observaron sus consumidores en `src/modules/usuarios/invitations/invitations.service.ts`, `email-changes/email-changes.service.ts` y `recovery/recovery.service.ts`, y configuración en `src/config/env.ts`. Es evidencia de implementación, no de que los nuevos requisitos estén satisfechos. El plan deberá contrastar las diferencias sin asumir una implementación desde cero.
- **Fuentes y limitación documental**: Se consultaron el índice, contexto, arquitectura, decisiones, pendientes y resúmenes de Usuarios. `docs/original/3 ANALISIS DEL PROYECTO.docx.pdf` no está disponible en este worktree; no se pudo revalidar su CU01/CU02 ni se atribuyen a esa fuente requisitos nuevos de correo. No se adopta ningún RF/RNF de los resúmenes como aprobado. Si se pretende cambiar una regla de dominio sustentada en originales, se deberá recuperar el pasaje y solicitar decisión antes de hacerlo.
- **Estado y trazabilidad**: FR-001–014 y SC-001–006 son propuestas v1 de esta especificación, basadas en la solicitud y en supuestos explícitos de seguridad y alcance. Requieren revisión del responsable antes de ser compromisos aprobados. No se fijan políticas nuevas de retención ni se exige almacenar mensajes o verificaciones adicionales. Las metas de tiempo y facilidad de uso son propuestas propias, no cifras tomadas del análisis institucional.
- **Interpretación de entrega**: La responsabilidad de envío termina en la aceptación del destinatario por el proveedor. La recepción real se comprueba solo en los buzones controlados del ensayo; no se promete entrega final de todos los mensajes de producción.
