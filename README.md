# Kudlab Backend

API del prototipo piloto Kudlab, una herramienta de apoyo al seguimiento pedagógico de estudiantes de tercero del Colegio San Diego (Duitama). El proyecto busca reunir observaciones docentes, notas escolares y resultados de tareas digitales para consultar la evolución de cada estudiante. No sustituye una evaluación curricular ni produce diagnósticos clínicos.

El diseño documenta cinco áreas: Usuarios, Académico, Tareas, Evolución y Seguimiento. **En `main`, este backend implementa principalmente Usuarios**: cuentas y roles del personal, invitaciones, autenticación y sesiones. Las demás áreas forman parte del alcance documentado; sus funcionalidades no deben asumirse disponibles en esta rama. Consulta el [contexto del proyecto](docs/agent-context/project-context.md), el [mapa de módulos](docs/agent-context/INDEX.md) y la [arquitectura documentada](docs/agent-context/architecture-summary.md).

## Tecnologías y requisitos

- Node.js 24 y npm (el proyecto exige `>=24 <25`).
- PostgreSQL accesible desde la máquina donde se ejecuta la API.
- Servidor SMTP y una cuenta remitente para invitaciones y cambios de correo. El modo de captura de mensajes está reservado a pruebas (`NODE_ENV=test`).

La implementación utiliza TypeScript, Hono, Better Auth y Drizzle ORM sobre PostgreSQL. Este repositorio contiene la API; no incluye la aplicación web.

## Ejecución local

1. Instala las dependencias y crea un archivo de configuración local:

   ```bash
   npm ci
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
   npm run dev
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

Las pruebas de integración necesitan una base PostgreSQL **aislada y migrada**. Si no se define `DATABASE_URL` para pruebas, `tests/setup.ts` utiliza `127.0.0.1:55432/kudlab_test`; prepara esa base antes de ejecutar `npm test`. Usa únicamente datos ficticios en las pruebas.

## API y documentación

Las rutas implementadas incluyen `/api/auth/*` para el acceso del personal y `/api/v1/accounts` para la gestión de cuentas por administradores; hay además rutas de invitación, solicitudes de rol y cambio de correo. Los contratos y recorridos de validación se encuentran en [`specs/001-gestionar-cuentas-roles/`](specs/001-gestionar-cuentas-roles/) y [`specs/002-validar-perfil-acceso/`](specs/002-validar-perfil-acceso/). El [índice documental](docs/agent-context/INDEX.md) distingue el diseño propuesto de lo implementado.
