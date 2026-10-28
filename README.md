# Kudlab Backend

**J-03:** códigos individuales de **5 caracteres alfanuméricos**, gestión docente,
canje público y recuperación sobre el mismo runtime. Migración aditiva 0012 y
límites compartidos en PostgreSQL. OpenAPI: **58 operaciones/12 tags**; artefacto
canónico 1.2.0, sin cambiar sobres 1.0/1.1 ni fórmulas. Uso real sigue bloqueado.
[Operación y preparación](docs/acceso-codigo.md) · [Verificación y límites](docs/acceso-codigo-verificacion.md).
Las cifras/exclusiones de J-02 siguientes conservan el estado de su entrega anterior.

**J-02 (2026-10-27):** asignación supervisada de TG-01, capacidades runtime 1.0/1.1,
ingesta idempotente, procesamiento recuperable y consulta individual. OpenAPI:
50 operaciones/11 tags. **Entrega técnica con datos ficticios y BD aislada**;
la composición normal no concede consentimiento/participación. Sin J-03.
[Integración, ejecución y límites](docs/integracion-play.md).

**Cursos, ampliación de esta rama (2026-10-26):** CRUD ADMIN de cursos y asignación de profesor, consulta propia TEACHER y listado de estudiantes por curso. Transferencia confirmada conserva registros y cambia el acceso actual; solo se eliminan cursos sin estudiantes, incluidos inactivos. ADMIN no recibe acceso a registros estudiantiles. Reutiliza `groups`, sin migración ni dependencia nueva. [Contrato, fuentes y evidencia](docs/feature-specs/academico/02-cursos.md). OpenAPI actual: 35 operaciones/9 tags; las exclusiones históricas de grupos siguientes ya no aplican.

API del prototipo piloto Kudlab, una herramienta de apoyo al seguimiento pedagógico de estudiantes de tercero del Colegio San Diego (Duitama). El proyecto busca reunir observaciones docentes, notas escolares y resultados de tareas digitales para consultar la evolución de cada estudiante. No sustituye una evaluación curricular ni produce diagnósticos clínicos.

El diseño documenta cinco áreas: Usuarios, Académico, Tareas, Evolución y Seguimiento. Este backend implementa Usuarios y cinco operaciones de registro, listado, consulta, corrección e inactivación de estudiantes en Académico. **Los profesores operan esos registros; los estudiantes no acceden ni tienen cuentas en este backend.** Los demás recursos académicos, Tareas, Evolución y Seguimiento siguen fuera del catálogo HTTP actual. Consulta el [contexto del proyecto](docs/agent-context/project-context.md), el [mapa de módulos](docs/agent-context/INDEX.md) y la [arquitectura documentada](docs/agent-context/architecture-summary.md).

## Tecnologías y requisitos

**Ampliación vertical 01:** esta rama incorpora consulta persistida de catálogo y
ficha de Tareas para ADMIN/TEACHER activos, sin ejecutar ni asignar juegos.
TG-01 se registra deshabilitada, sin integración comprobada ni versión publicada.
El catálogo OpenAPI pasa a **28 operaciones**; las menciones históricas de Tareas
fuera de HTTP/26 operaciones describen la base anterior. Ver
[spec, fuentes y verificación](docs/feature-specs/tareas/01-catalogo-y-ficha.md).

- Node.js 24 y npm (el proyecto exige `>=24 <25`).
- PostgreSQL accesible desde la máquina donde se ejecuta la API.
- Servidor SMTP y una cuenta remitente para invitaciones y cambios de correo. El modo de captura de mensajes está reservado a pruebas (`NODE_ENV=test`).

La implementación utiliza TypeScript, Hono, Better Auth y Drizzle ORM sobre PostgreSQL. Este repositorio contiene la API; no incluye la aplicación web.

## Ejecución local

1. Instala las dependencias y crea un archivo de configuración local:

   ```bash
   SCARF_ANALYTICS=false npm ci
   cp .env.example .env
   ```

2. Crea una base PostgreSQL y completa `.env` con valores propios. Como mínimo:

   - `DATABASE_URL`: URL de conexión PostgreSQL de la aplicación. Para migraciones puede utilizarse `MIGRATION_DATABASE_URL` si el usuario que administra el esquema es distinto.
   - `BETTER_AUTH_SECRET`: secreto de al menos 32 caracteres; `BETTER_AUTH_URL`: origen público de esta API, por ejemplo `http://localhost:3000`.
    - `SPA_ORIGIN`: origen de la aplicación web autorizada, por ejemplo `http://localhost:5173`; `INVITATION_BASE_URL`: URL de su pantalla de aceptación de invitaciones.
    - `EMAIL_CHANGE_BASE_URL`: URL de la pantalla de confirmación de cambio de correo, distinta de la de invitación; `RESET_BASE_URL`: pantalla de recuperación de contraseña. Las tres URLs deben pertenecer a `SPA_ORIGIN`, sin credenciales, parámetros ni fragmentos; HTTPS salvo loopback HTTP local. El cliente debe dirigir cada pantalla a su operación correspondiente; este repositorio no implementa esas pantallas.
   - `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` y `MAIL_FROM`: datos del servidor SMTP. Fuera de las pruebas, el envío de correos necesita estos valores.
   - `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD`: datos del primer administrador. El correo debe terminar en `.edu.co` y la contraseña debe tener entre 8 y 128 caracteres, con mayúscula, minúscula y número. El administrador se crea al arrancar **solo si aún no hay cuentas**.

   `BETTER_AUTH_URL` y `SPA_ORIGIN` deben ser orígenes HTTPS, salvo `localhost` o `127.0.0.1` por HTTP. No subas `.env` ni credenciales al repositorio.

3. Aplica las migraciones y arranca la API:

   ```bash
   npm run db:migrate
    NODE_ENV=development npm run dev
   ```

   La API escucha en el puerto `3000` por defecto; se puede cambiar con `PORT`. Para ejecutarla sin vigilancia de archivos, usa `npm start`.

## Verificación

### Correo con Gmail

1. Elige una cuenta remitente de Gmail o Workspace con permiso para enviar. En tu cuenta de Google, habilita la verificación en dos pasos y crea una contraseña de aplicación **si la cuenta lo permite**. Si la opción está bloqueada, consulta al administrador antes de cambiar mecanismo; esta integración no implementa OAuth.
2. Configura en el `.env` local ignorado o gestor de secretos `MAIL_MODE=smtp`, `MAIL_HOST=smtp.gmail.com`, `MAIL_PORT=465`, `MAIL_USER` y `MAIL_FROM` con la dirección completa elegida, y `MAIL_PASSWORD` con la contraseña de aplicación. No uses la contraseña habitual ni compartas secretos en el chat. El puerto 587 también funciona con STARTTLS obligatorio. No hay opción de TLS inseguro; el nombre DNS debe coincidir con el certificado.
3. Completa las tres URLs SPA descritas arriba. Para actualizar un despliegue anterior, agrega `EMAIL_CHANGE_BASE_URL` antes de reiniciar: configuración incompleta impide el arranque con un aviso que identifica el ajuste, no su valor. Una caída del proveedor no bloquea el arranque, aunque sí puede impedir los envíos.
4. Sigue la [guía de validación SMTP](specs/005-smtp-mailing/quickstart.md) con buzones controlados y autorización explícita antes del primer envío real. La cuenta remitente puede ser Gmail personal; las cuentas destinatarias del piloto conservan la política institucional `.edu.co`. No se modifica esa política para facilitar las pruebas.

El sistema envía texto en español para invitación, cambio de correo y recuperación. `ENVIADA` significa **aceptada por el servidor SMTP**, no llegada a bandeja de entrada ni lectura. `PENDIENTE` también puede representar un resultado incierto. Un `503 DELIVERY_STATUS_UNKNOWN` no autoriza un reintento automático: consulta la cuenta existente antes de repetir un alta; no se duplican cuentas ni se activan por enviar un correo. Recuperación mantiene su respuesta pública neutra, pero no promete ocultar diferencias de tiempo.

El envío sigue siendo síncrono: los timeouts de DNS, conexión y saludo son 30 segundos cada uno; el de inactividad de socket es 600 segundos para permitir la confirmación final del proveedor. No constituyen un límite total de respuesta HTTP. Configura el despliegue teniendo en cuenta esa espera y evita reintentos ciegos en cliente/proxy. No hay colas, reenvíos automáticos, seguimiento de rebotes ni endpoint público de correo de prueba.

Los diagnósticos JSON `mail_attempt` incluyen referencia interna, propósito, fecha, resultado y categoría fija; nunca cuerpo, dirección ni enlace/token. El operador debe restringir el acceso a stdout/stderr y a su recolector; no se exponen por la API ni se cambia la política existente de retención. No habilites debug ni logs de transacciones SMTP. Captura solo se acepta con `NODE_ENV=test` y datos ficticios; en ese modo no se contacta al proveedor.

### Pruebas automatizadas

```bash
npm run typecheck
npm test
```

Las pruebas de integración necesitan una base PostgreSQL **aislada y migrada**: las fixtures truncan tablas con `CASCADE`. No usar una base compartida, escolar o productiva. Define explícitamente `DATABASE_URL` y, si existe, `MIGRATION_DATABASE_URL` hacia la misma base desechable antes de migrar o probar; no dependas del fallback de `tests/setup.ts` ni reutilices la BD de otro worktree. Usa únicamente datos ficticios. La validación documental no necesita PostgreSQL:

```bash
npm run docs:check
```

## API y documentación

El catálogo canónico es [`docs/api/openapi.yaml`](docs/api/openapi.yaml), OpenAPI 3.1.0: **26 operaciones implementadas**, 21 de Usuarios/autenticación y cinco sobre estudiantes realizadas por profesores. Incluye parámetros, cuerpos, respuestas, errores, permisos y ejemplos sintéticos/no operativos. Los contratos anteriores de `specs/001…005/contracts/` conservan su condición histórica; no copiar propuestas como disponibilidad actual.

Con `NODE_ENV=development` o `NODE_ENV=test` explícitos:

- Swagger UI de consulta: `http://localhost:3000/docs`.
- Contrato descargable: `http://localhost:3000/openapi.yaml`.
- CSS y bundle se sirven localmente, sin CDN ni validación remota. `SCARF_ANALYTICS=false` desactiva la analítica de instalación del paquete Swagger UI.

En producción, staging, entorno vacío o ausente, **UI, contrato y assets devuelven 404**, incluso con sesión ADMIN. El script `dev` no configura el entorno por sí mismo: usa `NODE_ENV=development npm run dev` para habilitar documentación local. No exponerla mediante un default permisivo.

La UI no ejecuta peticiones de negocio (“Try it out” deshabilitado), no contiene credenciales precargadas ni persiste autorización. El cliente real utiliza cookie HttpOnly o Bearer **opaco de sesión persistida**, no el JWT de interoperabilidad de `/api/auth/token`. El navegador no permite fijar libremente `Cookie` ni leer cookies HttpOnly; no cambies CORS o permisos para sortearlo. Los tokens de invitación, correo o recuperación son de un uso y no son sesiones. ADMIN no tiene acceso implícito a operaciones de estudiantes.

### Actualizar y verificar

1. Contrastar cambios con `src/app.ts`, lista blanca de autenticación, routers, validadores, servicios y pruebas: documentar únicamente lo implementado.
2. Actualizar el YAML canónico y, si cambia el alcance autorizado en otra feature, el [inventario y mapa de operaciones](specs/006-api-swagger-docs/contracts/documentation.md). No mantener una segunda copia operativa. Reiniciar el proceso tras cambiar el YAML: se carga una vez al construir el router, no en cada petición.
3. Ejecutar `npm run docs:check`: valida estructura OpenAPI completa, referencias internas, IDs, ejemplos/esquemas y publicación por entorno; no importa app/bootstrap ni necesita BD. También comprueba mutaciones negativas del contrato.
4. Ejecutar `npm run typecheck` y contratos/regresión con BD exclusiva. Las respuestas reales deben validar contra el documento; no cambies el negocio para ajustarlo a un supuesto documental.
5. Abrir `/docs` y expandir una operación por tag; comprobar esquemas, seguridad y ejemplos, consola sin errores, solo tres peticiones locales de recursos y cero solicitudes de negocio/exteriores. Separar ese resultado de la validación documental y HTTP.

Guía reproducible: [quickstart](specs/006-api-swagger-docs/quickstart.md). Evidencia y limitaciones de entrega: [validation.md](specs/006-api-swagger-docs/validation.md). El [índice documental](docs/agent-context/INDEX.md) mantiene separados diseño y código disponible.
