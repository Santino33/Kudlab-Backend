# Tasks: Correo transaccional SMTP

**Input**: Documentos en `specs/005-smtp-mailing/`.
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/mail.md](contracts/mail.md), [quickstart.md](quickstart.md).
**Tests**: Incluidos por las pruebas aisladas, matrices y verificaciones explícitas de spec (FR-011 y SC-002–005), además de las obligaciones constitucionales sobre contratos y permisos. Escribir primero los casos y comprobar su fallo pertinente antes de implementar; no considerar un fallo de infraestructura como prueba roja válida.
**Organization**: Historias de usuario con base compartida. Solo se genera esta lista, no se ejecuta implementación. Los requisitos nuevos siguen propuestos para revisión; ninguna casilla significa aprobación institucional.

## Format: `[ID] [P?] [Story] Description`

Cada línea accionable tiene casilla, ID secuencial y ruta exacta. `[P]` permite trabajar sobre archivos distintos una vez satisfechas sus dependencias; no implica ejecutar suites concurrentemente sobre la misma base o process.env. Las etiquetas US1–US3 corresponden a spec.

## Path Conventions

Rutas relativas a la raíz de este worktree; `src/` y `tests/` existentes. No crear proyectos, paquetes, tablas o migraciones nuevos. Los archivos de prueba nuevos se ubican dentro de los directorios descubiertos por `vitest.config.ts`.

## Commits al terminar cada fase

**Instrucción del usuario**: Al completar cada una de las fases 1–6, el agente DEBE crear un commit en la rama de esta feature antes de iniciar la siguiente fase. Revisar el diff, ejecutar las verificaciones pertinentes y actualizar las casillas de tareas realmente completadas antes del commit. Incluir únicamente cambios correspondientes a la fase y hechos por el agente, sin secretos, archivos locales ni cambios ajenos; no usar staging indiscriminado ni descartar trabajo existente.

El mensaje debe identificar la fase y su resultado, por ejemplo `feat(smtp): complete phase 3 invitation delivery`. Informar al usuario el hash corto, mensaje y verificaciones realizadas. No hacer push salvo petición explícita. Si una fase está bloqueada o incompleta, no presentarla como terminada ni crear un commit de cierre ficticio; explicar el bloqueo y seguir las reglas de pausa. Si Git impide el commit, informar el error y solicitar lo necesario para resolverlo sin saltarse hooks ni modificar identidad/configuración de Git sin autorización.

Esta regla aplica a la ejecución de las fases, no ordena crear ahora un commit por la edición de este documento. Para cumplir el orden de commits, ejecutar las fases secuencialmente; las oportunidades `[P]` se mantienen dentro de cada fase, no para empezar una fase posterior antes de cerrar la anterior.

## Intervención del usuario y pausas de ejecución

**Proveedor elegido por el usuario: Gmail.** No se presupone que ya configuraste Google. La implementación y las pruebas locales usan captura y un servidor SMTP ficticio; no requieren tu cuenta de correo ni credenciales reales. Estas pausas aplican al ejecutar la lista, no al generarla. La integración conserva SMTP estándar, sin añadir OAuth o servicios de Google fuera del alcance acordado.

**Instrucción obligatoria para el agente en cada intervención**: Antes de pedir que el usuario actúe en cualquiera de los momentos de la tabla, explicar en español los pasos concretos y numerados que debe realizar, para qué sirven, dónde realizarlos y qué resultado debe comprobar. No limitarse a decir «configura Gmail», «prepara la base» o «ejecuta el ensayo», ni asumir conocimientos previos o pasos ya completados. Adaptar la guía al estado confirmado del entorno y, para Google, a las opciones vigentes de su cuenta; preguntar solo los datos no sensibles necesarios para elegir el recorrido. Indicar qué confirmación no sensible necesita recibir el agente para continuar y esperar esa confirmación cuando la tabla exige pausa. Si surge un bloqueo, explicar cómo reconocerlo y la alternativa segura, sin pedir contraseñas, códigos de acceso, códigos de recuperación ni contraseñas de aplicación por el chat. Esta obligación incluye revisión inicial, infraestructura, configuración Gmail, comprobación de buzones, participantes y decisiones de cierre.

| Momento | Qué puede hacer el agente | Qué necesitas hacer tú | Regla de pausa |
| --- | --- | --- | --- |
| T001, antes de implementar | Presentar alcance, metas y cambio de configuración para revisión | Confirmar alcance y metas o indicar cambios | Esperar confirmación explícita si todavía no consta; no inferirla de la generación de documentos |
| T002–T025, implementación y pruebas locales | Crear certificados ficticios, código, pruebas y documentación; usar captura/SMTP local sin correo externo | Normalmente nada. Si falta una base aislada o un permiso que el agente no pueda obtener, habilitarlo o autorizar su preparación | Pausar solo las verificaciones afectadas si falta infraestructura; continuar trabajo independiente y no marcar pruebas no ejecutadas como aprobadas |
| T026, regresión completa | Ejecutar typecheck y suites sobre PostgreSQL aislado | Solo intervenir si la base o el entorno de pruebas no están disponibles y no pueden prepararse con los permisos existentes | No ejecutar helpers destructivos sobre una base de propósito desconocido; pedir confirmación del entorno aislado si hay duda |
| T027, antes del primer envío real | Comprobar configuración sin mostrar secretos y preparar el ensayo de recepción | Elegir/habilitar proveedor y remitente; configurar secretos en privado; autorizar destinatarios y envío; disponer de las tres pantallas SPA | Esperar autorización explícita y recursos disponibles antes de enviar. Si falta algo, dejar T027 pendiente y documentar bloqueo |
| T027, durante la comprobación de recepción | Correlacionar resultados y tiempos sin guardar tokens | Revisar buzones y completar acciones de los enlaces cuando el agente no tenga acceso autorizado al buzón o cliente | Esperar evidencia de recepción/acción; la aceptación SMTP no sustituye tu comprobación |
| T028, comprensión de mensajes | Preparar instrucciones y registrar resultados agregados | Coordinar cinco adultos de prueba y facilitar su participación | Mantener T028 pendiente hasta realizar el ensayo; no simular participantes ni resultados |
| T029–T030, cierre | Revisar código y resumir resultados/bloqueos aun si faltan ensayos externos | Revisar decisiones pendientes cuando corresponda | Puede emitirse informe parcial; no declarar aceptación completa con T027/T028 pendientes |

**Preparación de Gmail para T027**: El agente debe guiar paso a paso al usuario para identificar si usa Gmail personal o Google Workspace, iniciar sesión en la cuenta remitente, habilitar la verificación en dos pasos y crear una contraseña de aplicación cuando su cuenta o administrador lo permita. Después debe explicar cómo configurar en privado MAIL_HOST=smtp.gmail.com, MAIL_PORT=465 (TLS implícito) o 587 (STARTTLS obligatorio), MAIL_USER con la dirección completa de la cuenta, MAIL_PASSWORD con la contraseña de aplicación y MAIL_FROM con esa misma dirección para el primer ensayo; no usar la contraseña habitual de Google. Explicar también dónde configurar MAIL_MODE=smtp y las tres URLs SPA, cómo verificar los ajustes sin mostrar secretos y cómo autorizar el primer ensayo con buzones controlados. Si no está disponible la contraseña de aplicación, detener el ensayo real, explicar las restricciones que debe comprobar con Google o el administrador y solicitar una decisión antes de cambiar proveedor o ampliar alcance a OAuth. Estas acciones externas no se consideran realizadas de antemano ni están autorizadas por implementar código.

**Secretos**: Introducirlos en el `.env` local ignorado o gestor de secretos del despliegue, nunca en el chat, Git o documentos. El agente puede comprobar presencia y formato sin imprimir valores. Puedes preparar proveedor, pantallas y participantes mientras avanza la implementación; solo son prerrequisitos para los ensayos externos, no para escribir o probar el código localmente.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Preparar la ejecución y los recursos exclusivamente ficticios, sin repetir inicialización del backend.

- [X] T001 Revisar alcance, metas propuestas, cambio de configuración EMAIL_CHANGE_BASE_URL y limitación de originales con el responsable; registrar decisión y cualquier bloqueo en `specs/005-smtp-mailing/plan.md` antes de implementar, sin declarar fuentes ausentes aprobadas ni alterar políticas de dominio.
- [X] T002 Preparar CA y certificado de servidor para localhost con claves exclusivamente ficticias en `tests/fixtures/smtp/ca.pem`, `tests/fixtures/smtp/server-cert.pem` y `tests/fixtures/smtp/server-key.pem`, y documentar generación/confianza en `tests/fixtures/smtp/README.md`; no usar certificados o claves reales ni desactivar verificación.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Configuración y transporte compartidos por las tres historias. No iniciar fases de historias hasta completar esta base.

- [X] T003 [P] Crear pruebas de configuración en `tests/unit/mail-env.test.ts`: reproducir literalmente las restricciones «host DNS y usuario no vacíos tras comprobar espacios», «contraseña no vacía sin modificar su valor», «puerto entero 1–65535», «dirección remitente única válida» y «capture solo NODE_ENV=test» de `specs/005-smtp-mailing/data-model.md`; cubrir URLs del origen SPA, HTTPS salvo loopback HTTP, sin usuario/contraseña/query/hash, invitación distinta de cambio de correo y errores sin valores secretos.
- [X] T004 [P] Crear pruebas del módulo en `tests/unit/transactional-mail.test.ts` para «Uno de invitation, email-change, password-recovery», «UUID de la invitación o verificación existente; nunca token/digest», «Una dirección institucional validada del flujo emisor; no listas ni CR/LF/NUL», «URL absoluta validada del propósito con token emitido por el flujo», «Dirección configurada; nombre visible fijo Kudlab» y «Generados por propósito, no proporcionados por el solicitante»; verificar texto español/asunto fijo por propósito, caracteres válidos, rechazo de controles, accepted/rejected/unknown y ausencia de reintentos conforme a `specs/005-smtp-mailing/contracts/mail.md`.
- [X] T005 Implementar validación redactada en `src/config/env.ts` según T003, agregando EMAIL_CHANGE_BASE_URL obligatoria y conservando MAIL_PORT=587 y MAIL_MODE=smtp por defecto; validar el NODE_ENV del source recibido sin permitir captura fuera de pruebas y actualizar `tests/setup.ts` con URL ficticia distinta para cambio de correo, sin secretos nuevos ni cambios a reglas de cuentas.
- [X] T006 Hacer que configuración inválida termine el arranque antes de bootstrap/listen en `src/index.ts`, sin filtrar configuración por errores de importación; si se requiere separar importaciones para validar primero, mantener intacta la inicialización de aplicación y no exigir disponibilidad SMTP al arrancar.
- [X] T007 Implementar `src/modules/usuarios/shared/transactional-mail.ts` según T004: mensajes de texto de tres propósitos, objeto de dirección única y sobre explícito, accepted/rejected/unknown conservadores, TLS mínimo 1.2 con certificado verificado, 465 implícito/otros requireTLS, sin pooling ni accesos a archivos/URLs; timeouts DNS/conexión/saludo=30000 ms y socket=600000 ms; nunca deducir rechazo de CONN/timeout/messageId, usar err.message como evidencia, reintentar ni usar Promise.race sin cancelación real.
- [X] T008 Integrar captura y diagnóstico en `src/modules/usuarios/shared/transactional-mail.ts` y adaptar/reexportar `capturedMail` desde `src/modules/usuarios/invitations/invitations.mailer.ts` para preservar tests existentes y consumidores aún no migrados: conservar to/url y añadir purpose/subject/text/operationId; captura solo ficticia sin red; diagnósticos con «event fijo mail_attempt, occurredAt ISO, operationId, purpose, outcome y category opcional», categorías cerradas validation/configuration/dns/connection/tls/auth/recipient/message/timeout/network/inconsistent/persistence y responseCode numérico opcional, nunca error/info/configuración completos, direcciones, tokens, digest, enlaces o cuerpos; desactivar logger/debug/transactionLog y no dejar transportes duplicados. Los consumidores antiguos deben aportar propósito/referencia o migrarse junto con sus tareas posteriores; no inventar IDs de verificación para satisfacer el contrato.
- [X] T009 Crear helper de servidor SMTP cifrado en `tests/fixtures/smtp/server.ts` usando los certificados de T002 y smtp-server existente, con modos de STARTTLS/TLS implícito, rechazo de auth/RCPT/DATA y desconexión después del cuerpo antes de confirmación final; habilitar confianza de CA explícita solo en pruebas (proceso hijo si se usa NODE_EXTRA_CA_CERTS), limpiar sockets/servidor y no cambiar seguridad del transporte productivo.

**Checkpoint**: T003/T004 pasan para el módulo base; rutas antiguas siguen disponibles. La base no se considera entregable desplegable hasta migrar coherentemente sus consumidores; no introducir referencias ficticias para operación real.

## Phase 3: User Story 1 - Recibir una invitación de acceso (Priority: P1) — MVP

**Goal**: Invitar con mensaje reconocible, enlace correcto y resultado honesto, sin activar la cuenta ni duplicarla por fallos de entrega.
**Independent Test**: Con administrador ficticio autorizado, crear una cuenta, inspeccionar mensaje/aceptación y completar el enlace; repetir con rechazo y unknown, verificando estado pendiente y un solo intento.

### Tests for User Story 1

- [X] T010 [P] [US1] Crear contrato en `tests/contract/mail-invitation.test.ts` para POST /api/v1/accounts y PATCH de cuenta pendiente: accepted devuelve 201/200 con ENVIADA, rejected devuelve 503 DELIVERY_FAILED y unknown o persistencia fallida devuelve 503 DELIVERY_STATUS_UNKNOWN; no filtrar token/contenido ni datos al actor no autorizado.
- [X] T011 [P] [US1] Actualizar `tests/integration/account-invitation.test.ts` con el helper TLS de T009: eliminar la expectativa de éxito SMTP sin STARTTLS, probar destinatario/contenido, rechazo, desconexión tras DATA, conservación de PENDIENTE ante incertidumbre y fallo al guardar ENVIADA, un intento y ninguna cuenta duplicada; restaurar process.env y cerrar servidor en todos los casos.

### Implementation for User Story 1

- [X] T012 [US1] Migrar `src/modules/usuarios/invitations/invitations.service.ts` al módulo compartido con purpose invitation e ID real de invitación después del commit: accepted→ENVIADA, rejected→ERROR y unknown→PENDIENTE; conservar 503 DELIVERY_STATUS_UNKNOWN si falla guardar el resultado, emitir categoría persistence sin reenviar y no activar cuenta ni modificar vencimiento/uso único.
- [X] T013 [US1] Verificar en `src/modules/usuarios/accounts/accounts.service.ts` que alta/consulta y reemisión explícita conservan cuenta, referencia y estados públicos PENDIENTE/ENVIADA/ERROR; añadir en `tests/integration/accounts-convergence.test.ts` regresión de consulta tras 503 y sustitución de invitación sin duplicar cuenta o revivir token anterior, sin crear endpoint de reintento ni modificar payloads existentes.
- [X] T014 [US1] Ejecutar contratos e integración de invitaciones y cuentas sobre PostgreSQL aislado, incluyendo rechazo sin permiso y enlace vencido/usado; registrar comandos/resultados/bloqueos en `specs/005-smtp-mailing/quickstart.md` sin tokens ni credenciales y comprobar el recorrido independiente de US1.

**Checkpoint**: MVP demostrable con invitaciones, aceptación SMTP y errores honestos. No afirmar recepción real usando solo ENVIADA. No desplegar un estado intermedio con consumidores compartidos incompatibles.

## Phase 4: User Story 2 - Recibir verificaciones de correo y recuperación (Priority: P1)

**Goal**: Separar las dos acciones, usar destinatario/URL correctos y mantener recuperación pública neutra.
**Independent Test**: Partir de cuentas activas ficticias independientes; confirmar cambio con el nuevo correo y recuperar acceso desde el vigente. Verificar rechazo de enlaces inválidos y respuesta neutra para cuenta no apta/desconocida incluso ante fallo SMTP.

### Tests for User Story 2

- [X] T015 [P] [US2] Crear `tests/contract/mail-verifications.test.ts` para PATCH /api/v1/accounts/:id con cambio de correo y POST /api/v1/auth/password-recovery/request: mapear accepted/rejected/unknown a 200/503 apropiado solo en cambio, mantener exactamente 202 y `{ "message": "Si corresponde, recibirás instrucciones en tu correo." }` en recuperación válida para cuentas activa/pendiente/inactiva/desconocida y fallos de envío, sin publicar resultado o referencia privada.
- [X] T016 [P] [US2] Crear `tests/integration/mail-verifications.test.ts` para cambio al nuevo correo mediante EMAIL_CHANGE_BASE_URL y recuperación al vigente mediante RESET_BASE_URL, con propósito/asunto específicos, referencia real, un único intento, conservación de correo vigente hasta confirmar y rechazo de enlaces usados/vencidos/sustituidos; incluir recuperación completada que revoca sesiones y rechazo de operaciones sin autorización, usando fixtures ficticias y helper SMTP TLS de T009.

### Implementation for User Story 2

- [X] T017 [P] [US2] Migrar `src/modules/usuarios/email-changes/email-changes.service.ts` al envío purpose email-change con ID retornado de su verificación y EMAIL_CHANGE_BASE_URL después del commit; mapear rejected/unknown a DELIVERY_FAILED/DELIVERY_STATUS_UNKNOWN sin confirmar el correo ni revertir cambios comprometidos; preservar reemisión de invitación para cuenta pendiente.
- [X] T018 [P] [US2] Migrar `src/modules/usuarios/recovery/recovery.service.ts` al envío purpose password-recovery con ID real retornado por la inserción y RESET_BASE_URL, conservar el 202 neutro del consumidor y elegibilidad existentes incluso ante fallos esperados; registrar diagnóstico redactado sin divulgar operación al solicitante y sin cambiar TTL/uso único/revocación de sesiones.
- [X] T019 [US2] Ejecutar T015/T016 y las regresiones de `tests/integration/password-recovery.test.ts` y `tests/contract/password-recovery.test.ts`; completar migración de consumidores y retirar el adaptador antiguo de envío en `src/modules/usuarios/invitations/invitations.mailer.ts` si ya no se utiliza, conservando la exportación de captura para `tests/helpers.ts` y tests actuales; registrar resultados en `specs/005-smtp-mailing/quickstart.md`.

**Checkpoint**: Los tres emisores usan un único transporte; cambio y recuperación son verificables sin depender del envío de invitaciones de US1 (las cuentas pueden prepararse con fixtures existentes).

## Phase 5: User Story 3 - Configurar y verificar el envío seguro (Priority: P2)

**Goal**: Validar operativamente configuración, cifrado, captura y diagnóstico sin exposición de secretos.
**Independent Test**: Probar arranque con configuración inválida, proveedor TLS válido/no válido y captura aislada de los tres propósitos; demostrar rechazo seguro, diagnóstico útil y cero envíos externos de captura.

### Tests for User Story 3

- [X] T020 [P] [US3] Crear `tests/contract/mail-startup.test.ts` con proceso aislado para comprobar que configuración incompleta/URLs inválidas y capture con NODE_ENV distinto de test terminan antes de bootstrap/listen, nombran el ajuste sin reflejar valores secretos y no intentan SMTP; una caída SMTP con configuración válida no se convierte en requisito de arranque, usando la base aislada cuando sea necesaria.
- [X] T021 [P] [US3] Crear `tests/integration/smtp-transport.test.ts` con T009 para STARTTLS e implícito con CA válida, ausencia STARTTLS, CA no confiable, nombre certificado incorrecto, credenciales erróneas, rechazo RCPT/DATA y cierre tras DATA; comprobar certificado verificado, ausencia de cuerpo antes de TLS válido, un intento, resultado conservador y cleanup sin esperar 600 s para simular fallos (cerrar socket o controlar reloj en la capa adecuada).
- [X] T022 [P] [US3] Crear `tests/unit/mail-diagnostics.test.ts` para los tres propósitos: secretos/direcciones/tokens/cuerpos centinela ausentes en eventos y errores de configuración, campos/categorías limitados al modelo, logs internos SMTP desactivados, fallo del sink sin reenvío ni conversión accepted→rejected, y captura que usa el mismo contenido pero no invoca transporte/red y se limpia entre casos.

### Implementation for User Story 3

- [X] T023 [P] [US3] Actualizar `.env.example` con EMAIL_CHANGE_BASE_URL, direcciones públicas separadas, DNS/certificado requerido, 465/STARTTLS y advertencia capture solo pruebas; mantener valores vacíos/ficticios, sin habilitar opción de TLS inseguro ni añadir dependencia o configuración de reintentos.
- [X] T024 [P] [US3] Actualizar `README.md` con configuración/migración y verificación operativa de los tres recorridos según `specs/005-smtp-mailing/contracts/mail.md`: logs privados para operador, aceptación no equivale a recepción, PENDIENTE puede ser incertidumbre, consultar cuenta tras 503 antes de repetir alta, límites de espera síncrona y dependencia de pantallas SPA, sin endpoint público de prueba ni promesa de neutralidad temporal.
- [X] T025 [US3] Ejecutar T020–T022 y T003/T004, resolver diferencias dentro de `src/config/env.ts`, `src/index.ts` y `src/modules/usuarios/shared/transactional-mail.ts` sin relajar el contrato TLS o redacción, y registrar la matriz configuración/TLS/captura/diagnóstico en `specs/005-smtp-mailing/quickstart.md`; si hay cambios compartidos, repetir contratos de US1/US2 antes de cerrar la historia.

**Checkpoint**: US3 se comprueba directamente con configuración/transporte y datos ficticios, sin necesitar una cuenta real ni proveedor externo. Las protecciones críticas ya eran parte de la base compartida; esta fase añade verificación completa y operación documentada.

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Regresión y aceptación final sin confundir implementación con mediciones externas.

- [ ] T026 Ejecutar `npm run typecheck` y `npm test` con DATABASE_URL de PostgreSQL aislado y migrado, revisar autorización, invitación, confirmación y revocación afectadas y registrar comandos/resultados en `specs/005-smtp-mailing/quickstart.md`; reportar dependencias bloqueantes en vez de marcar pruebas no ejecutadas como aprobadas.
- [ ] T027 Ejecutar ensayo manual SC-001 de `specs/005-smtp-mailing/quickstart.md` solo con autorización, proveedor/buzones controlados y pantallas SPA disponibles: cinco mensajes por propósito, 15/15 recibidos y 15/15 <60 s para ese tamaño de muestra; registrar tiempos/resultados sin enlaces o secretos en `specs/005-smtp-mailing/validation-results.md`, o registrar bloqueo explícito sin dar el criterio por cumplido.
- [ ] T028 Ejecutar ensayo SC-006 con cinco adultos y cuentas ficticias según `specs/005-smtp-mailing/quickstart.md`, comprobar que al menos cuatro identifican y encuentran cómo continuar las tres acciones sin ayuda y registrar solo resultados agregados en `specs/005-smtp-mailing/validation-results.md`; si faltan participantes o SPA, mantener pendiente y documentar bloqueo.
- [ ] T029 Revisar el diff de `src/modules/usuarios/shared/transactional-mail.ts`, `src/config/env.ts`, `src/index.ts`, `README.md` y `.env.example` junto con sus consumidores para excluir secretos, migraciones/tablas/dependencias nuevas, reintentos, endpoints de envío y cambios de dominio; registrar resultado del gate constitucional posterior y cualquier limitación en `specs/005-smtp-mailing/validation-results.md` sin modificar la checklist de requisitos mantenida por specify/clarify.
- [ ] T030 Completar en `specs/005-smtp-mailing/validation-results.md` la matriz FR-001–014 y SC-001–006 con referencias de pruebas/ensayos y estado aprobado/fallido/no ejecutado, contrastar `specs/005-smtp-mailing/spec.md` y `specs/005-smtp-mailing/plan.md`, y dejar separados estado de implementación, validación y aprobación del responsable sin declarar la feature completa con ensayos pendientes.

## Dependencies & Execution Order

### Phase Dependencies

```text
Setup T001–T002
  -> Base: T003 || T004 -> T005 -> T006
                       -> T007 -> T008
          T002 -> T009
  -> US1: T010 || T011 -> T012 -> T013 -> T014
  -> US2: T015 || T016 -> T017 || T018 -> T019
  -> US3: T020 || T021 || T022 || T023 || T024 -> T025
  -> T026 -> T027 -> T028 -> T029 -> T030
```

El gráfico de base se interpreta además con estas dependencias: T007 requiere configuración T005; T008 requiere T007; T009 no requiere los cambios productivos. T006 y T007 pueden avanzar a la vez tras T005, pero no se marcan [P] por su posición secuencial de integración. T010–T025 requieren toda la fase 2.

### User Story Dependencies

- US1 y US2 tienen P1; el orden incremental recomendado es US1→US2→US3 para facilitar revisión. No existe dependencia funcional de US2 respecto a entregar US1: comparte la base y puede preparar cuentas mediante fixtures.
- US1/US2 pueden desarrollarse en paralelo después de base: archivos de sus emisores/pruebas son distintos. Coordinar T019 con T012/T014 y no retirar compatibilidad mientras haya consumidores antiguos. No modificar el módulo compartido concurrentemente.
- US3 puede escribir sus pruebas y documentación después de base sin esperar otras historias. T025 debe serializar cualquier corrección compartida y repetir regresiones de las historias integradas.
- T026 requiere las tres historias; T027/T028 requieren además recursos externos/personas y aprobación para enviar. No lanzarlos automáticamente desde tests ni tratar falta de recursos como éxito.
- T029/T030 siguen a las actividades de validación disponibles; deben reflejar pendientes si los ensayos manuales siguen bloqueados. No marcar T027/T028 completados por limitarse a registrar el bloqueo.

### Within Each Story

Pruebas primero, luego integración y verificación del recorrido. Mantener transporte después del commit SQL. No agregar persistencia para modelos transitorios ni nuevas rutas por conveniencia de tests. Los cambios compartidos se integran con un responsable de archivo a la vez.

## Parallel Execution Examples

### User Story 1

Tras base: T010 (`tests/contract/mail-invitation.test.ts`) y T011 (`tests/integration/account-invitation.test.ts`) pueden escribirse en paralelo. Ejecutarlos secuencialmente si comparten base o entorno. T012 espera ambas tareas de prueba.

### User Story 2

Tras base: T015 y T016 pueden escribirse en paralelo; cuando se revisan sus fallos, T017 (`email-changes.service.ts`) y T018 (`recovery.service.ts`) pueden implementarse en paralelo. T019 integra compatibilidad y ejecuta regresiones después de ambas.

### User Story 3

Tras base: T020, T021 y T022 tienen archivos separados, al igual que documentación T023/T024. T025 espera todas; no ejecutar pruebas con cambios globales de entorno o servidores comunes en paralelo salvo aislamiento explícito.

## Implementation Strategy

### MVP First (US1)

Completar Setup + Base + US1 y demostrar invitación con enlace funcional, TLS y resultado honesto. Mantener los consumidores antiguos compatibles o migrarlos en el mismo cambio antes de desplegar: un checkpoint de MVP no autoriza publicar configuración/transporte parcialmente incompatible. No incluir colas, campañas o tablas para extender el MVP.

### Incremental Delivery

US1 aporta invitación segura; US2 aporta mensajes separados y recuperación neutra; US3 completa verificación y operación. Ejecutar regresiones tras cada incremento. Las garantías de TLS/configuración no se difieren hasta US3: están implementadas en la base.

### Acceptance

30 tareas: Setup 2, Base 7, US1 5, US2 5, US3 6, cierre 5. Automatización no acredita recepción externa ni comprensión humana. Revisar alcance/metas con el responsable y documentar las fuentes ausentes, sin inventar nuevas reglas institucionales.

## Notes

No cambiar casillas de `checklists/requirements.md` desde implementación. No marcar tarea completa sin su resultado verificable. Esta lista añade solo `tasks.md`; no se ejecutaron pruebas ni envíos para generarla.
