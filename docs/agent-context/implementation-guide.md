# Guía de implementación para un agente nuevo

## Qué existe y dónde

Inventario observado en la base `cd3c2b4`; verificar la rama al comenzar. «Implementado» no significa probado en esta revisión documental.

| Ubicación actual | Qué buscar |
| --- | --- |
| [src/app.ts](../../src/app.ts) | Composición de rutas, CORS y lista permitida de operaciones Better Auth; no asumir que todas las rutas del framework están expuestas. |
| [src/index.ts](../../src/index.ts), [src/config/env.ts](../../src/config/env.ts) | Arranque/configuración; bootstrap inicial en `src/scripts/bootstrap-admin.ts`. |
| [src/auth/](../../src/auth/) | Better Auth, resolución de identidad, guardas y actividad de sesión. |
| [src/modules/usuarios/](../../src/modules/usuarios/) | Features `accounts`, `invitations`, `promotion-requests`, `email-changes`, `recovery` y utilidades compartidas del módulo. |
| [src/db/schema/](../../src/db/schema/), [src/db/migrations/](../../src/db/migrations/) | Esquemas reales y migraciones. `auth.ts` es generado para Better Auth; no reemplazarlo por el ERD histórico. |
| [tests/](../../tests/) | Pruebas unitarias, contrato, integración y rendimiento existentes; setup y helpers. |
| [specs/](../../specs/) | Decisiones por feature, modelos, contratos y recorridos de validación; el refactor 004 conserva comportamiento, no introduce otra API. |

No hay código de negocio de los otros cuatro módulos en esta base. No generar carpetas vacías ni dar por implementada una integración al documentarla.

## Estructura recomendada para módulos nuevos

Seguir el patrón por feature que ya usa Usuarios, no trasladar literalmente clases NestJS de los diagramas:

```text
src/modules/<modulo>/
  <feature>/
    <feature>.routes.ts       # entrada HTTP, validación y traducción de errores
    <feature>.service.ts      # reglas, autorización del recurso y transacciones
  shared/                    # solo elementos usados por varias features del módulo
src/db/schema/<modulo>.ts     # esquema nuevo cuando sea necesario
src/db/migrations/            # migraciones generadas/revisadas
tests/unit/                  # reglas puras
tests/contract/              # contrato HTTP y errores
tests/integration/           # persistencia, permisos, concurrencia e integraciones
```

Los nombres de feature recomendados están en cada `module-summary.md`; todavía no existen fuera de Usuarios. Validación/tipos pueden empezar junto a la feature; extraerlos al reutilizarse. Añadir un adaptador de almacenamiento o cálculo puro cuando exista esa necesidad, no una capa genérica de repositorios por anticipado. Los servicios existentes usan Drizzle directamente; esta guía no exige refactorizarlos.

## Autorización y contratos

- Reutilizar identidad activa y guardas de [src/auth/session-guard.ts](../../src/auth/session-guard.ts); no copiar su lógica en cada módulo.
- El puente actual de ámbito es [scope-authorization.ts](../../src/modules/usuarios/shared/scope-authorization.ts), documentado en el [contrato interno](../../specs/002-validar-perfil-acceso/contracts/scope-authorization.md). `AssignmentProvider.hasAssignment` recibe **ID de cuenta de negocio**, operación y objetivo; Académico debe aportar la responsabilidad actual. Sin proveedor o ante fallo, deniega. El helper actual solo admite TEACHER; cualquier política ADMIN para datos académicos requiere contrato explícito.
- No confundir `user_accounts.id` UUID con `authUserId` de Better Auth (texto). Elegir/documentar la referencia de autor/docente y su FK al diseñar Académico; no sustituirla por `users.id` del ERD.
- Contratos existentes: [cuentas](../../specs/001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml), [validación](../../specs/002-validar-perfil-acceso/contracts/validation.openapi.yaml), [autenticación](../../specs/003-autenticar-usuarios/contracts/auth.openapi.yaml), [inventario del refactor](../../specs/004-refactor-servicios-usuarios/contracts/current-interfaces.md). Si discrepan con código/pruebas, registrar y resolver; no cambiar comportamiento accidentalmente.
- Para endpoints nuevos especificar permiso, entrada/salida, estados/errores, paginación, idempotencia, efectos y consumidores. No asumir que `POST /api/v1/tasks/results` ya existe.

## Ejecución y verificación

Seguir [README](../../README.md) y [.env.example](../../.env.example) para Node 24, PostgreSQL, SMTP y arranque. No poner secretos ni datos reales en documentación, fixtures o logs.

```bash
npm ci
npm run typecheck
npm test
```

Las pruebas de integración requieren una BD **aislada y migrada**; revisar `tests/setup.ts`, no ejecutar contra producción ni compartir datos entre agentes. Aplicar migraciones con `npm run db:migrate` sobre el destino autorizado. No ejecutar bootstrap ni envíos reales de correo al revisar documentación.

Al cambiar un módulo comprobar: camino válido, acceso ajeno, dato inválido, fallo de dependencia y reintento. Para Tareas añadir concurrencia/interrupción/deduplicación; para Evolución referencias de cálculo/suficiencia/comparabilidad; para Académico consentimiento/inactivación; para Seguimiento separación de fuentes/filtros. Tener pruebas escritas no demuestra que pasaron: registrar comandos, resultados y limitaciones.

## Cómo mantener este contexto

1. Actualizar resumen/modelo/feature al cambiar responsabilidades o contratos, con enlaces a código y pruebas.
2. Marcar explícitamente diseño original, alcance confirmado, implementación observada, recomendación y pendiente.
3. Registrar cierre de pendientes con decisión y evidencia; no perpetuar cuestiones ya resueltas por una feature.
4. Verificar enlaces locales; los originales se adquieren según [fuentes](sources.md).
5. No modificar constitución ni fuentes históricas como parte de una limpieza de contexto. Si aparece un conflicto normativo, proponer su resolución al responsable.
