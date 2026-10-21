# Guía de validación del refactor

## Requisitos previos

- Node.js 24 y dependencias instaladas (`npm ci` si faltan).
- PostgreSQL de **pruebas aislado** y migrado; usar datos ficticios. `tests/setup.ts` usa por defecto `postgres://postgres:local_test_only@127.0.0.1:55432/kudlab_test` si `DATABASE_URL` no está definida. Definir `DATABASE_URL` apuntando a esa base de pruebas antes de migrar y probar; no utilizar una base con datos reales.
- El modo de correo de las pruebas es captura (`tests/setup.ts`); no se necesita enviar mensajes reales.

En este entorno ya existe el contenedor Podman `kudlab-auth-test-003`. Si la conexión a `127.0.0.1:55432` es rechazada, iniciarlo con `podman start kudlab-auth-test-003` y comprobar `podman exec kudlab-auth-test-003 pg_isready`. Esperar a que acepte conexiones antes de migrar. Definir también `MIGRATION_DATABASE_URL` con la misma base aislada para evitar que otra configuración de migración apunte a una base distinta.

## Línea base (antes de editar servicios)

Desde la raíz, con `DATABASE_URL` de pruebas definida:

```bash
npm run db:migrate
npm run typecheck
npm test
```

Registrar pruebas que fallan o entorno no disponible antes de los movimientos para poder distinguir un problema previo de una regresión.

## Regresión final (después de reorganizar y aclarar servicios)

Con la misma base de pruebas aislada y migrada:

```bash
npm run typecheck
npm test
```

**Resultado esperado**: compilación correcta, suite completa en verde y sin diferencias respecto de la línea base en respuestas, errores, permisos, auditoría, correos capturados, revocación e integridad bajo concurrencia. La suite recorre `tests/unit/`, `tests/contract/`, `tests/integration/` y `tests/performance/`; si un escenario afectado carece de cobertura, agregar una prueba de regresión puntual. Ver [contratos actuales](contracts/current-interfaces.md) y [modelo sin cambios](data-model.md).

Para SC-002 y SC-003, pedir a una persona que no participó en el refactor que recorra cuentas, invitaciones, cambio de correo y recuperación: medir tiempo para identificar acción/comprobaciones/resultado (menos de cinco minutos por recorrido) y para localizar cada responsabilidad (al menos el 90 % en menos de dos minutos). Registrar tiempos y cualquier límite pendiente junto con el resultado de la suite.
