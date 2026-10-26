# Feature Specification: Documentación verificable de la API

**Feature Branch**: `feat/api-swagger-docs`

**Created**: 2026-10-25

**Status**: Approved — el responsable aprobó expresamente especificación y diseño el 2026-10-25 antes de implementar

**Input**: Documentar exclusivamente la API implementada con OpenAPI y Swagger UI, partiendo de `docs/agent-context/modules/usuarios/features/documentacion-api-swagger.md`, contrastando rutas y contratos, sin modificar el comportamiento ni incorporar operaciones de negocio. Aclaraciones del responsable: incluir Usuarios y las cinco operaciones existentes sobre estudiantes; sus operadores son profesores, no estudiantes. Permitir `/docs` y `/openapi.yaml` solo en desarrollo/pruebas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descubrir el contrato realmente disponible (Priority: P1)

Como desarrollador consumidor, quiero consultar un catálogo único de las operaciones implementadas para integrar el cliente sin confundir propuestas con funcionalidades disponibles.

**Why this priority**: Un contrato incorrecto produce integraciones inviables y expectativas falsas de acceso.

**Independent Test**: Contrastar el catálogo con el inventario de rutas montadas y la lista blanca de autenticación, sin necesitar la interfaz visual.

**Acceptance Scenarios**:

1. **Given** la base revisada, **When** consulto el contrato, **Then** encuentro las 26 combinaciones método/ruta del [inventario contrastado](inventory.md), sin duplicados ni operaciones futuras.
2. **Given** una operación del catálogo, **When** reviso sus detalles, **Then** encuentro propósito, entradas, restricciones, autorización, éxito, errores y ejemplos ficticios acordes con la implementación.
3. **Given** documentos anteriores marcados como propuestas, **When** consulto la documentación vigente, **Then** sus afirmaciones solo aparecen como disponibles si están respaldadas por código actual; las diferencias quedan registradas.

---

### User Story 2 - Entender el acceso y las consecuencias (Priority: P1)

Como desarrollador consumidor, quiero distinguir operaciones públicas, sesiones del personal y permisos sobre recursos para no enviar credenciales incorrectas ni prometer accesos no permitidos.

**Why this priority**: La documentación no debe debilitar ni tergiversar los controles sobre cuentas y datos de menores.

**Independent Test**: Revisar la seguridad declarada y comparar casos sintéticos de acceso permitido, sesión ausente, rol incorrecto y recurso ajeno con los controles existentes.

**Acceptance Scenarios**:

1. **Given** una operación protegida, **When** consulto cómo autenticarme, **Then** distingo cookie o token opaco de sesión persistida del JWT de interoperabilidad; un JWT firmado aislado no se presenta como credencial suficiente.
2. **Given** las operaciones de estudiantes, **When** reviso sus permisos, **Then** se exige profesor con rol `TEACHER`, sesión vigente y ámbito propio; `ADMIN` no se describe como acceso universal y no se crean actores, cuentas ni login de estudiantes.
3. **Given** aceptación de invitación, confirmación de correo o recuperación, **When** reviso el flujo, **Then** distingo el token de un solo uso de una sesión y conozco vencimiento, consumo y efectos implementados sobre credenciales y sesiones.
4. **Given** una solicitud de recuperación con correo institucional válido, **When** leo su respuesta, **Then** la confirmación neutra no revela la existencia de la cuenta ni garantiza entrega del correo.

---

### User Story 3 - Consultar la documentación visual de forma segura (Priority: P2)

Como desarrollador, quiero explorar el contrato en una interfaz navegable en desarrollo y pruebas, sin publicar esos recursos en producción.

**Why this priority**: Facilita descubrir y comprender operaciones sin ampliar la superficie documental del despliegue productivo.

**Independent Test**: Abrir los dos recursos documentales en cada entorno y contrastar la interfaz con el catálogo descargado.

**Acceptance Scenarios**:

1. **Given** desarrollo o pruebas, **When** abro `/docs`, **Then** Swagger UI carga `/openapi.yaml`, muestra las 26 operaciones y permite desplegar parámetros, cuerpos, respuestas y seguridad sin errores de carga ni referencias sin resolver.
2. **Given** producción, **When** solicito `/docs` o `/openapi.yaml`, **Then** recibo 404 y no contenido documental, incluso con sesión ADMIN.
3. **Given** la interfaz abierta, **When** navego por ella, **Then** no se ejecutan automáticamente operaciones de negocio ni se precargan o conservan credenciales reales como parte de la documentación.
4. **Given** limitaciones del navegador para introducir cookies, **When** consulto la ayuda, **Then** encuentro explicados los mecanismos ya admitidos y sus límites, sin solicitar cambios de autenticación o de CORS para hacer funcionar la interfaz.

---

### User Story 4 - Mantener y verificar el catálogo (Priority: P2)

Como mantenedor, quiero instrucciones reproducibles de actualización y comprobación para detectar documentación obsoleta cuando cambie una operación.

**Why this priority**: La utilidad depende de conservar la correspondencia entre documentación y comportamiento.

**Independent Test**: Seguir la guía del repositorio para localizar el contrato, validarlo, contrastar operaciones y comprobar la interfaz.

**Acceptance Scenarios**:

1. **Given** el documento completo, **When** ejecuto la validación indicada, **Then** se comprueba su estructura OpenAPI, referencias, identificadores únicos y validez de ejemplos contra sus esquemas; verificar únicamente sintaxis YAML no basta.
2. **Given** un cambio simulado de método/ruta, **When** comparo catálogo e inventario, **Then** la discrepancia se informa; las pruebas de respuestas también detectan cuerpos incompatibles con los esquemas.
3. **Given** la guía del repositorio, **When** la sigue un mantenedor, **Then** identifica ubicación canónica, URLs por entorno, pasos de actualización y comprobaciones documentales y visuales sin depender de instrucciones externas a la entrega.

### Edge Cases

- La ruta comodín de autenticación no autoriza a documentar todas las operaciones del proveedor: solo las cinco admitidas explícitamente.
- Los métodos de infraestructura, rutas rechazadas y recursos documentales no se cuentan como operaciones de negocio adicionales.
- Sesiones vencidas, revocadas, identidad inconsistente y roles incorrectos se documentan con los errores propios de cada operación, sin uniformar diferencias reales.
- ID de estudiante inválido, ajeno o inexistente conserva la respuesta indistinguible existente; ADMIN recibe denegación por rol.
- La lista de estudiantes no tiene paginación ni filtros y rechaza parámetros de consulta; no hereda los de cuentas.
- `fields` no tiene la misma forma en Usuarios y Académico: no se fusiona en un esquema incompatible.
- JSON malformado, propiedades desconocidas, actualizaciones vacías y cuerpos no permitidos conservan las validaciones actuales.
- Un fallo de correo puede ocurrir después de persistir cambios: no se promete rollback ni entrega si el código no lo garantiza.
- Un contrato válido puede contener ejemplos inválidos o enlaces rotos; se verifican ambos además de su estructura.
- En producción o en un entorno no identificado explícitamente como desarrollo/pruebas no se habilitan los recursos documentales. La guía debe explicar cómo declarar desarrollo al ejecutar localmente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El catálogo MUST cubrir exactamente las 26 operaciones del inventario de esta base: 21 de Usuarios/autenticación y cinco de estudiantes gestionados por profesores. Cada operación MUST tener evidencia de implementación y una identificación única por método/ruta.
- **FR-002**: El contrato MUST usar OpenAPI 3.1 en YAML, consistente con los contratos existentes, y ofrecer una única fuente canónica del catálogo actual; MUST conservar la condición histórica de propuestas, sin promover indiscriminadamente los documentos anteriores. La ubicación canónica y herramienta compatible se decidirán en planificación priorizando convenciones y dependencias existentes.
- **FR-003**: Cada operación MUST declarar `summary`, descripción, `operationId` único y tags consistentes por dominio, evitando presentar firmas internas o recursos futuros como operaciones públicas.
- **FR-004**: Cada parámetro y campo MUST describir tipo, obligatoriedad, formato y restricciones implementadas, valores por defecto cuando existan, normalizaciones relevantes y ejemplo ficticio. MUST distinguir parámetros de ruta, consulta, cabeceras, cookies y cuerpos, incluyendo ausencia de cuerpo donde corresponda.
- **FR-005**: Cada operación MUST describir respuestas de éxito y errores observables aplicables, códigos HTTP reales, esquemas explícitos de cuerpos y cabeceras relevantes. MUST preservar campos opcionales, listas, envoltorios y diferencias de errores entre dominios; MUST NOT añadir campos o garantías ausentes del código.
- **FR-006**: La seguridad MUST declararse por operación: pública, sesión persistida activa, ADMIN, TEACHER y ámbito propio según corresponda. MUST explicar cookies y token opaco de sesión, no equivalentes al JWT emitido para interoperabilidad; MUST documentar el carácter público de las claves de verificación y la sesión requerida para emitir un JWT.
- **FR-007**: Los flujos de cuentas MUST describir creación pendiente TEACHER, invitación, edición/cambio confirmado de correo, descenso de rol y ascenso por solicitud, activación/inactivación y auditoría conforme al inventario. MUST incluir protección del último administrador y efectos reales de revocación, sin presentar bootstrap como endpoint.
- **FR-008**: Invitaciones, confirmación de correo y recuperación MUST indicar entradas y vigencia de tokens, condiciones de uso único, resultados, errores y efectos existentes sobre sesiones. La recuperación MUST conservar la respuesta pública neutra y no prometer entrega ni inicio automático de sesión.
- **FR-009**: Estudiantes MUST documentarse como registros gestionados exclusivamente por el profesor autorizado: cinco operaciones existentes, alcance propio, sin acceso del estudiante y sin privilegio implícito ADMIN. MUST describir restricciones de campos, ausencia de filtros/paginación, alta inactiva, actualización limitada, inactivación sin cuerpo e idempotente, y errores neutrales de ámbito.
- **FR-010**: Los ejemplos MUST ser íntegramente sintéticos, sin secretos, tokens activos, cuentas reales ni información real de menores. Valores ficticios sujetos a política institucional MUST cumplir el formato exigido y señalarse como no operativos; las credenciales de sesión MUST ser marcadores no utilizables, nunca credenciales precargadas.
- **FR-011**: En desarrollo y pruebas MUST ofrecerse `/openapi.yaml` y Swagger UI en `/docs` sin sesión previa. En producción y otros entornos no habilitados explícitamente MUST devolver 404, sin exponer contenido ni depender de un rol para habilitarse. Son recursos documentales autorizados, no nuevas operaciones de negocio.
- **FR-012**: La interfaz MUST presentar el mismo contrato publicado, con todas las operaciones, esquemas, ejemplos y seguridad, sin errores de carga o resolución. MUST explicar las limitaciones de cookies del navegador y no modificar CORS, autenticación ni permisos para sortearlas. Navegar o cargar la página MUST NOT ejecutar operaciones de negocio ni persistir credenciales de autorización como configuración documental.
- **FR-013**: La entrega MUST incluir comprobación reproducible de validez del documento completo para la versión declarada, resolución de referencias, unicidad de identificadores y correspondencia entre ejemplos y esquemas; MUST contrastar catálogo y rutas, y respuestas representativas de éxito/error por cada operación, usando las pruebas existentes cuando cubran el caso.
- **FR-014**: La entrega MUST incluir verificación visual de carga y expansión en Swagger UI de una operación de cada dominio, así como comprobación de disponibilidad de ambos recursos en desarrollo/pruebas y ausencia en producción y entorno no habilitado. La validación documental y la visual MUST reportarse por separado.
- **FR-015**: El repositorio MUST indicar ubicación canónica, URLs, entornos permitidos y pasos para actualizar/verificar la documentación ante cambios. MUST registrar y corregir referencias de contexto que afirmen erróneamente que estudiantes no está implementado, sin convertir otros diseños en capacidades disponibles.
- **FR-016**: La feature MUST NOT alterar entradas aceptadas, salidas, errores, autenticación, autorización, persistencia ni efectos de las operaciones existentes; MUST NOT implementar nuevas operaciones de negocio ni refactorizar routers para adoptar generación automática. Las discrepancias documentales se resuelven documentando el comportamiento actual, no cambiándolo.

### Key Entities

- **Operación documentada**: método/ruta existente, propósito, entradas, respuestas, seguridad, ejemplos y evidencia de contraste.
- **Esquema de intercambio**: forma y restricciones de las representaciones de cuentas, identidad/sesión, solicitudes de ascenso, auditoría, estudiantes y errores; reutilizable cuando la forma realmente coincida.
- **Catálogo actual**: conjunto versionado de operaciones implementadas, diferente de contratos históricos propuestos.
- **Recurso documental**: contrato descargable e interfaz de consulta, disponibles únicamente en los entornos acordados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un consumidor encuentra el 100 % de las 26 operaciones del inventario y cero operaciones futuras, duplicadas o no montadas, mediante comparación exhaustiva método/ruta.
- **SC-002**: En el 100 % de las operaciones puede identificar propósito, credenciales/permisos, entradas, éxito, errores y ejemplos sin consultar el código; una revisión por operación registra cero omisiones.
- **SC-003**: El catálogo y todos sus ejemplos superan las verificaciones indicadas sin errores; el contraste de respuestas representativas de éxito y fallos aplicables cubre las 26 operaciones y registra cero incompatibilidades sin resolver.
- **SC-004**: En desarrollo y pruebas un consumidor puede abrir el catálogo visual y explorar una operación de cada dominio sin errores de presentación o referencias rotas; en producción y entornos no habilitados ambos recursos devuelven 404 en el 100 % de las comprobaciones, con o sin sesión.
- **SC-005**: La revisión de la totalidad de ejemplos encuentra cero secretos, credenciales activas, datos reales de personas o accesos atribuidos a estudiantes.
- **SC-006**: Un mantenedor puede localizar el contrato y completar su recorrido documentado de actualización y verificación sin instrucciones adicionales; las verificaciones de regresión de negocio no presentan diferencias de contrato atribuibles a esta feature.

## Assumptions

- La fuente primaria de requisitos es la feature indicada por el usuario; el código de la base `096a8fa` es la evidencia del comportamiento disponible. [inventory.md](inventory.md) registra fuentes, diferencias y límites de la revisión.
- Las decisiones expresas del responsable del 2026-10-25 sustituyen la exclusión desactualizada de estudiantes y resuelven publicación por entorno. Tras generar Plan y Tasks, el responsable aprobó expresamente especificación y diseño para implementar; esto no ratifica los RF históricos ni propuestas futuras.
- El público documental son desarrolladores y mantenedores. ADMIN y TEACHER son permisos del personal docente; los estudiantes son registros del dominio, no usuarios de este backend.
- No se introducen reglas pedagógicas, consentimiento, políticas institucionales, retención ni garantías de rendimiento a partir de fuentes históricas. No hay decisiones normativas nuevas que deban inferirse de A/D/V3; esta entrega describe comportamiento ya implementado.
- Existen YAML, validación de esquemas y pruebas de contrato, pero no una integración Swagger UI ni un validador completo OpenAPI identificados en las dependencias actuales. La elección mínima compatible pertenece a planificación, sin comprometer una generación que obligue a refactorizar negocio.
- La verificación de interfaz y regresión se hará durante implementación con datos sintéticos y base de pruebas aislada cuando sea necesaria. Specify valida requisitos, no demuestra que Swagger UI ya exista o que las pruebas de ejecución hayan pasado.
- Fuera de alcance: grupos como operaciones HTTP, tareas, juegos, consentimiento, notas, resultados, login de estudiantes, publicación documental en producción, cambios de endpoints o controles existentes y adopción de funcionalidades futuras del proveedor de autenticación.
