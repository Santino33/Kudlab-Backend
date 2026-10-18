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

```bash
npm run typecheck
npm test
```

Las pruebas de integración necesitan una base PostgreSQL **aislada y migrada**. Si no se define `DATABASE_URL` para pruebas, `tests/setup.ts` utiliza `127.0.0.1:55432/kudlab_test`; prepara esa base antes de ejecutar `npm test`. Usa únicamente datos ficticios en las pruebas.

## API y documentación

Las rutas implementadas incluyen `/api/auth/*` para el acceso del personal y `/api/v1/accounts` para la gestión de cuentas por administradores; hay además rutas de invitación, solicitudes de rol y cambio de correo. Los contratos y recorridos de validación se encuentran en [`specs/001-gestionar-cuentas-roles/`](specs/001-gestionar-cuentas-roles/) y [`specs/002-validar-perfil-acceso/`](specs/002-validar-perfil-acceso/). El [índice documental](docs/agent-context/INDEX.md) distingue el diseño propuesto de lo implementado.
