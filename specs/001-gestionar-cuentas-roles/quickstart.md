# Guía de validación: cuentas y roles

El backend implementa los recorridos mediante Hono, Better Auth 1.7.7 y
PostgreSQL. El modelo está en
[data-model.md](data-model.md) y la interfaz en
[contracts/accounts.openapi.yaml](contracts/accounts.openapi.yaml).

## Prerrequisitos

1. Node.js 24 LTS y PostgreSQL 17. Instalar las dependencias fijadas en
   `package-lock.json` con `npm ci`.
2. Copiar `.env.example` a un archivo local ignorado, o inyectar las variables
   directamente desde el gestor de secretos. Usar correos de prueba cuyo dominio termine en `.edu.co`; las contraseñas
   de prueba deben tener al menos 8 caracteres, una mayúscula, una minúscula
   y un número. Configurar `DATABASE_URL`, secreto de Better Auth, origen SPA,
   envío de correo y credenciales del ADMIN inicial en un entorno seguro.
    No poner secretos reales ni correos de menores en el repositorio. El
    servicio exige `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`,
    `MAIL_FROM` y `INVITATION_BASE_URL` para correo SMTP real. Captura
    simulada (`MAIL_MODE=capture`) solo está disponible con `NODE_ENV=test`.
    En despliegue, usar `MIGRATION_DATABASE_URL` del propietario del esquema
    solo al migrar y `DATABASE_URL` de un rol de aplicación sin permisos
    `UPDATE` ni `DELETE` en `account_audit_events` (con `SELECT` e `INSERT`).
    El trigger `account_audit_append_only` impide igualmente alteraciones
    incluso si se usa por error una conexión con mayores permisos.

    Ejemplo de privilegios para un rol de aplicación **creado fuera de estas
    migraciones** por el operador (adaptar nombre/esquema a cada despliegue):

    ```sql
    GRANT USAGE ON SCHEMA public TO kudlab_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO kudlab_app;
    REVOKE UPDATE, DELETE ON account_audit_events FROM kudlab_app;
    ```

    El rol propietario usado por `MIGRATION_DATABASE_URL` no debe ser el de
    `DATABASE_URL`; verificar los permisos tras cada migración.
3. Al iniciar una base vacía, se crea un único ADMIN por defecto con los datos
   iniciales configurados, sin contraseña compartida en el código. La cuenta
   TEACHER se invita con el correo de pruebas; el proveedor simulado captura
   el enlace sin enviar mensajes reales.

## Arranque y comprobaciones

```bash
npm ci
npm run db:migrate
npm run dev
npm run typecheck
npm test
```

`npm run auth:generate` regenera `src/db/schema/auth.ts` con `auth` 1.7.7;
`npm run db:generate` genera cambios en las migraciones Drizzle cuando cambia
el esquema. No es necesario generarlos para aplicar las migraciones incluidas;
`db:migrate` las aplica a PostgreSQL. Para regenerar el esquema hacen falta
variables válidas aunque la CLI no conecta a la base.
Nunca ejecutar una segunda migración Better Auth separada de Drizzle. La suite
`npm test` debe cubrir autorización, reglas de sesión y contrato OpenAPI.
Arrancar tres veces contra la misma base conserva exactamente el mismo
ADMIN inicial y su contraseña; faltar las credenciales en una base vacía debe
impedir crear un administrador con valores inseguros.

## Escenarios verificables

1. **Alta/invitación**: autenticarse como ADMIN con sesión persistida;
   `POST /api/v1/accounts` con nombre, correo terminado en `.edu.co` y `TEACHER`.
   Esperar `201`, PENDIENTE, un único rol, auditoría e invitación capturada.
   Antes de aceptar, `GET /api/auth/get-session` del invitado no autoriza
   operaciones. `POST /api/v1/account-invitations/accept` con token y contraseña
   conforme a política produce ACTIVA; su primer ingreso obtiene solo permisos
   TEACHER. Verificar que no admite un segundo canje ni un enlace con siete
   días cumplidos. No permitir alta ordinaria con rol ADMIN.
2. **Validación/concurrencia**: dos altas simultáneas con el mismo correo
   generan exactamente una cuenta; la otra retorna `409`. Repetir con correo
   de una cuenta INACTIVA, dominio diferente a `.edu.co` y rol ADMIN:
   no aparecen cuentas nuevas. Rechazar contraseñas de siete caracteres o
   sin cualquiera de mayúscula, minúscula y número sin consumir el enlace.
3. **Frontera de permisos**: sin sesión y como TEACHER intentar GET/POST/PATCH
   de cuentas y `/role`; respuestas `401`/`403`, sin datos de terceros ni
   efectos. Intentar llamar directamente `/api/auth/admin/*` y el registro
   público `/api/auth/sign-up/email`: ninguno puede eludir reglas Kudlab.
4. **Ascenso y edición**: como TEACHER solicitar ascenso con
   `POST /api/v1/admin-role-requests` y comprobar que conserva TEACHER
   mientras está pendiente. Con otro ADMIN aprobar por
   `POST /api/v1/admin-role-requests/{id}/approve`: en la primera solicitud
   posterior rige ADMIN sin roles acumulados. Probar rechazo, autoaprobación,
    petición duplicada y PUT directo TEACHER→ADMIN: ninguno eleva privilegios.
    Consultar auditoría con solicitante, decisor y fecha.
    Intentar degradar al último ADMIN activo: se rechaza.
   Al editar correo de una cuenta activa, debe quedar pendiente hasta que el
   titular confirme el enlace en el correo nuevo; una confirmación vencida
   conserva el correo anterior.
5. **Inactivación con sesión vigente**: cancelar primero (sin cambio); luego
   confirmar `POST /api/v1/accounts/{id}/deactivate` con `{"confirm":true}`.
   En la **primera** solicitud posterior con sesión anterior, acceso denegado;
    la cuenta e historial permanecen. `POST .../reactivate` con confirmación
    devuelve ACTIVA; sesión anterior continúa denegada hasta nuevo ingreso.
    Intentar inactivar al último ADMIN activo: debe permanecer activo.
6. **Fallas y recuperación**: simular caída del correo y comprobar estado de
   entrega ERROR sin afirmar envío. Simular fallo de transacción/auditoría:
   cuenta/rol/estado anteriores no cambian en la vista de negocio. Una
   credencial creada sin activación completa nunca obtiene acceso. Confirmar
   que una invitación vencida o ya usada no activa ni duplica la cuenta.
   Verificar que registros antiguos, ascensos rechazados y cuentas inactivas
   siguen disponibles indefinidamente sin eliminación programada.
7. **Concurrencia y tiempos**: ejecutar pruebas de carga con 30 sesiones de
   prueba y medir p95 de peticiones de cuentas frente a la meta documentada
   de ≤2 s; reportar medición sin declararla aprobada hasta confirmación.

## Evidencia ejecutada (2026-10-12; PostgreSQL 17 local, Podman)

- `npm install`, `npm run typecheck`, `npm run db:migrate` y `npm test` ejecutados.
  Base nueva `kudlab_fresh` con migraciones `0001_accounts`, `0001_audit-integrity`
  y `0002_email_changes`: 10 archivos, 17 pruebas aprobadas en la primera
  ejecución desde base limpia. Tras ampliar los casos y añadir la segunda
  migración de restricciones de correo, se repitió `npm ci`, `npm run db:migrate`,
  `npm run typecheck` y `npm test` en `kudlab_verify` desde cero:
  **31 pruebas aprobadas** en 10 archivos.
- Se probó bootstrap tres veces, error sin contraseña inicial en base vacía,
  inactivación/reactivación sin revivir sesión, JWT firmado como Bearer no
  autorizado, correo SMTP fallido y reversión si falla auditoría.
- Medición de 30 sesiones independientes, peticiones concurrentes GET cuentas:
  p95 **167,3 ms** en la base nueva (otras mediciones locales: 174,8 y 153,2 ms). La meta
  documental de ≤2 s sigue pendiente de aprobación y esta prueba local no
  constituye una medición de producción.
- SC-005 requiere prueba guiada con administradores humanos y SPA, por lo que
  sigue **sin verificar**. Las decisiones V3 tampoco se atribuyen como
  aprobación institucional.

## Validación presencial pendiente (SC-005)

La prueba de usabilidad **no se ha realizado**. Con la SPA conectada al backend
de pruebas, pedir a administradores del piloto que creen una cuenta válida y
que identifiquen un error de correo duplicado, sin asistencia. Medir cada
intento; documentar el número de participantes, los tiempos y si hubo ayuda
en [checklists/requirements.md](checklists/requirements.md), sin registrar
datos personales ni contraseñas reales. Solo entonces evaluar el umbral de
SC-005 (≥90 % de éxito sin ayuda en ≤3 minutos por intento) y cerrar T049.

## Verificación de convergencia T050–T058 (PostgreSQL 17 local)

- `npm ci`, `npm run db:migrate`, `npm run typecheck` y `npm test` ejecutados
  sobre una base nueva `kudlab_refactor_verify`: **44 pruebas aprobadas en
  13 archivos**. `npm run db:generate` no encontró cambios pendientes.
- Las migraciones `0003_account-email-claims`, `0004_email_change_actor` y
  `0005_invitation_latest_index` añaden protección de reservas concurrentes,
  autoría de solicitud de correo e índice para la última invitación.
- Se probaron carreras entre alta y reserva, activación y edición, edición e
  inactivación; rollback por falla de auditoría; paginación estable y número
  acotado de consultas con 100 cuentas; respuestas JSON contrastadas con el
  contrato OpenAPI; y fallo al persistir ENVIADA tras aceptar SMTP.
- El evento `REQUEST_EMAIL_CHANGE` registra al ADMIN solicitante y `UPDATE`
  conserva ese actor al confirmarse el cambio. `CONFIRM_EMAIL_CHANGE` usa el
  actor `system:email-verification`: el token demuestra posesión del correo,
  **no identifica de forma autenticada a quien hizo la petición HTTP**.
- La medición con 100 cuentas sigue siendo local y no convierte la referencia
  de rendimiento en un criterio aprobado. La prueba humana SC-005 permanece
  **no realizada**; T049 sigue pendiente.
