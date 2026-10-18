# Guía de validación: autenticación del personal

**Estado**: recorridos implementados y comprobables en pruebas; quedan pendientes la configuración de correo saliente real y la medición guiada con personas del piloto (SC-005). Detalles de campos y errores: [contrato](contracts/auth.openapi.yaml); persistencia y estados: [modelo](data-model.md).

## Pendiente operativo: correo saliente

- **Crear o designar una cuenta remitente** para los mensajes de invitación, confirmación de cambio de correo y recuperación de contraseña; acordar su dirección y quién administra sus credenciales. No se ha configurado una cuenta remitente real en este entorno.
- **Configurar y comprobar SMTP** con las variables `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` y `MAIL_FROM` de [`.env.example`](../../.env.example), mediante un `.env` local ignorado por Git o el gestor de secretos del despliegue. No guardar contraseñas de correo en el repositorio.
- **Validar entrega real** enviando una invitación y una recuperación a cuentas de prueba autorizadas, confirmando recepción y enlace utilizable. `MAIL_MODE=capture` únicamente captura mensajes durante pruebas: las pruebas automatizadas y la demostración local **no prueban** que un correo llegue a una bandeja externa. El flujo de cuentas de esta iteración acepta direcciones institucionales `.edu.co`.

Hasta completar estos pasos no puede darse por verificado el envío de correos reales, aunque la lógica de autenticación, enlaces y canje esté implementada.

## Preparación

1. Desde la raíz del repositorio, instalar Node.js 24 y tener PostgreSQL accesible. Configurar fuera de Git las variables de `.env.example`: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SPA_ORIGIN`, `INVITATION_BASE_URL`, `RESET_BASE_URL` para la vista de recuperación del origen SPA aprobado, SMTP (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM`) y credenciales del administrador inicial. `MAIL_MODE=capture` se admite solo con `NODE_ENV=test`.
2. Utilizar la base **de pruebas**, aislada de cualquier dato escolar, y correos de prueba `.edu.co`. El script de pruebas `tests/setup.ts` usa `postgres://postgres:local_test_only@127.0.0.1:55432/kudlab_test` si no se indica otra base; crearla previamente en el PostgreSQL local y no ejecutar `tests/helpers.ts::reset` contra datos reales. Las migraciones nuevas deberán incluir `session_activity` y verificaciones de recuperación.
3. Arrancar y comprobar el proyecto después de implementar:

```bash
npm ci
npm run db:migrate
npm run typecheck
npm test
npm run dev
```

Para verificar solo los recorridos nuevos: `npm test -- tests/unit/session-activity.test.ts tests/integration/authentication.test.ts tests/integration/password-recovery.test.ts tests/contract/authentication.test.ts tests/contract/password-recovery.test.ts`. Se recomienda probar primero la frontera del tiempo con reloj controlado y después los recorridos completos con PostgreSQL.

**Línea base local (2026-10-13)**: Node v24.18.0, `npm ci` correcto. La primera migración no pudo arrancar sin `MIGRATION_DATABASE_URL`/`DATABASE_URL`; con PostgreSQL 17 de pruebas aislado en `127.0.0.1:55432/kudlab_test` y `DATABASE_URL` temporal, `npm run db:migrate` finalizó, `npm run typecheck` pasó y `npm test` pasó (14 archivos, 56 pruebas). La instancia de pruebas fue levantada con Podman (`kudlab-auth-test-003`); no es dependencia de producción. Las advertencias de `npm ci` no bloquearon la línea base.

## Recorridos de extremo a extremo

1. **Inicio**: entrar como ADMIN inicial con `POST /api/auth/sign-in/email`; obtener cookie HttpOnly o `set-auth-token` opaco. Crear/invitar un TEACHER mediante [contrato de cuentas](../001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml), aceptar su invitación y repetir el ingreso. `GET /api/auth/get-session` devuelve solo identidad propia; `GET /api/v1/accounts` permite al ADMIN y deniega al TEACHER, sin datos de otra cuenta.
2. **Intentos sin derecho**: contraseña errónea, correo desconocido, cuenta pendiente, inactiva y rol discordante devuelven error público uniforme sin sesión nueva. Probar `POST /api/auth/sign-up/email`, `/api/auth/admin/create-user`, `/api/auth/change-password` y el reset nativo no habilitado: todos bloqueados por la lista blanca. `Authorization: Bearer <JWT>` emitido por `/api/auth/token` no abre una ruta de negocio sin sesión opaca activa.
3. **Tiempo**: con una sesión creada a T0 y reloj controlado, invocar una operación protegida a T0+29:59 (permite si rol/ámbito lo autorizan), luego a +29:59 del último éxito (permite) y exactamente +30:00 del último éxito (401). En sesión separada, consultar `get-session` o provocar denegaciones antes del límite: nada de ello debe reiniciar la inactividad. Un intento posterior con la misma sesión sigue denegado, aunque Better Auth hubiese renovado su vencimiento interno.
4. **Cerrar y revocar**: iniciar dos sesiones del mismo TEACHER en clientes distintos; `POST /api/auth/sign-out` con la primera invalida solo la primera. Inactivar la cuenta mediante el contrato de cuentas: ambas sesiones anteriores son inválidas desde la primera petición posterior; reactivar no las restaura. Tras un cambio de rol, la siguiente operación solo dispone de permisos vigentes. Una caída de PostgreSQL al verificar cuenta/sesión deniega sin devolver datos protegidos.
5. **Recuperar**: con cuenta activa pedir recuperación en `/api/v1/auth/password-recovery/request`; comprobar respuesta `202` idéntica para dirección inexistente, pendiente e inactiva y enlace solo para cuenta ACTIVA al correo vigente. Usar el token recibido en `/api/v1/auth/password-recovery/confirm` con nueva contraseña válida; debe invalidar sesiones anteriores y contraseña antigua, sin iniciar sesión por sí mismo. Canjear otra vez, esperar 30 minutos exactos, presentar contraseña inválida, cambiar correo antes del canje e intentar dos canjes simultáneos: no hay dos cambios, ni consumo por formato erróneo, ni elevación de cuenta inactiva. Cortar transacción tras revocación simulada: o cambia todo (hash/sesiones/token) o nada.
6. **Indicadores propuestos**: medir los recorridos con al menos cinco adultos de prueba (SC-005: ≥90 % sin ayuda, <2 min por recorrido); medir carga de 30 sesiones y p95 de inicio/consulta de acceso para informar sobre las referencias A §3.2 y D §4. No declarar esas metas técnicas aprobadas hasta su revisión institucional.

## Comprobación documental

- Validar `contracts/auth.openapi.yaml` y el contrato ya publicado de cuentas con las mismas peticiones y errores, sin devolver secretos ni datos de estudiantes.
- Registrar resultados de SC-001–006 y cualquier divergencia respecto de la decisión del responsable sobre recuperación por correo y plazo de 30 minutos, confirmada en `spec.md`.

## Resultados de verificación automatizada

- El responsable confirmó el 2026-10-13 la regla exacta de inactividad y la recuperación por correo vigente de un uso/30 minutos con revocación de todas las sesiones; constan en `spec.md`.
- SC-001/004: `tests/contract/authentication.test.ts`, `tests/integration/authentication.test.ts` y `tests/integration/auth-boundaries.test.ts` comprueban altas activas, rol vigente, credenciales inválidas, JWT sin sesión, fallo de consulta y ausencia de datos ajenos. La base de pruebas quedó aislada de datos reales.
- SC-002/003: `tests/unit/session-activity.test.ts` y `tests/integration/authentication.test.ts` comprueban frontera 29:59.999/30:00, cierre de una de dos sesiones, inactivación/reactivación y consulta no aceptada que no renueva actividad.
- SC-006: `tests/contract/password-recovery.test.ts` y `tests/integration/password-recovery.test.ts` comprueban respuesta neutra, correo caído, caducidad, contraseña débil sin consumir enlace, reutilización y dos canjes simultáneos, cambio de correo, cuenta inactiva, revocación de sesiones y rollback al fallar auditoría.
- `npm run db:migrate`, `npm run typecheck` y `npm test` sirven de verificación ejecutable. SC-005 requiere cinco personas adultas del piloto para su medición manual; no se sustituye con pruebas automáticas. Las referencias p95/30 concurrentes todavía no constituyen aceptación aprobada.
- Verificación final local: `npm run typecheck` correcto; `npm test` 19 archivos y 82 pruebas correctas (incluye cierre de sesión por HTTP real sin cuerpo). Medición informativa en `tests/performance/accounts-load.test.ts`: 30 sesiones, `GET /api/v1/accounts` p95=249,3 ms en la base aislada local. La cifra no mide uso humano ni valida SC-005 y puede variar entre entornos.
- **Seguimiento de T031**: el responsable indicó el 2026-10-13 que la prueba guiada con cinco personas adultas se hará después. Queda pendiente registrar por participante tiempo para iniciar/cerrar sesión y si necesitó ayuda; solo entonces calcular SC-005 y cerrar T031. La medición técnica local ya quedó consignada arriba.
