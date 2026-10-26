# Registro de validación — gestionar estudiantes

Fecha: 2026-10-23. Estado actual: **implementación y validación completadas**. Se conserva debajo el historial del bloqueo inicial y su resolución; el cierre actual está en la última sección.

## Gates previos

- `.specify/extensions.yml` no existe: no hay pre-hooks registrados.
- `check-prerequisites.sh --json --require-tasks --include-tasks` identificó `specs/005-gestionar-estudiantes` y sus documentos.
- `checklists/requirements.md`: 16 elementos, 16 revisados, 0 pendientes; PASS. Checklist leído sin modificar sus marcadores.
- Repositorio Git confirmado con `git rev-parse --git-dir`.
- `.gitignore` cubre dependencias, builds, cobertura, logs y entornos; `.dockerignore` existente cubre los patrones esenciales. Proyecto privado (`package.json`: `private: true`), sin necesidad de `.npmignore` para publicación. No se detectó configuración raíz de ESLint/Prettier ni infraestructura Terraform/Helm que requiera nuevos ignore files.

## Línea base intentada (T001)

| Verificación | Resultado |
| --- | --- |
| `node --version` | `v24.18.0`, compatible con `>=24 <25`. |
| Dependencias previas | No instaladas en este worktree. |
| `npm ci` | PASS, 213 paquetes instalados; sin cambiar versiones deliberadamente. npm reportó 4 vulnerabilidades de severidad moderada; no se ejecutó `audit fix` ni actualizaciones fuera de alcance. |
| `npm run typecheck` | PASS, `tsc --noEmit`, código de salida 0. |
| Conexión de solo lectura con `pg.Client` a PostgreSQL de pruebas local | FAIL, `ECONNREFUSED connect ECONNREFUSED 127.0.0.1:55432`, código de salida 1. No llegó a ejecutar la consulta `select current_database(), current_user`. |
| `npm test` completo | No ejecutado: no hay base de pruebas disponible para el reset y las pruebas de integración requeridos. No existe línea base completa aprobada. |

No había override `DATABASE_URL` en el proceso. Se comprobó explícitamente el destino local de pruebas definido en `tests/setup.ts`, base `kudlab_test`, sin cargar una configuración productiva ni imprimir credenciales. Se revisó `tests/helpers.ts`: `reset()` ejecuta TRUNCATE/CASCADE, por lo que no se usará una base no confirmada como desechable.

## Bloqueo y reanudación

T001 permanece pendiente porque no se verificó una base desechable disponible ni se pudo ejecutar la suite completa. Conforme al flujo solicitado, no se avanza a tareas secuenciales dependientes ni a cambios de código sin resolver este prerrequisito.

Para reanudar, disponer de PostgreSQL aislado accesible y confirmar que su base es desechable. Si se usa el destino local documentado, debe estar disponible en `127.0.0.1:55432` con base `kudlab_test`; si se usa otro destino, configurar `DATABASE_URL` y `MIGRATION_DATABASE_URL` explícitamente para pruebas. Verificar/aplicar las migraciones previas en esa base y repetir `npm run typecheck` y `npm test` antes de continuar T002/T003 y el fundamento. No se ha levantado ningún servicio ni migrado/resetado una base externa durante este intento.

## Alcance sin ejecutar

Las 45 tareas permanecen pendientes. No hay implementación académica, migración nueva, pruebas nuevas ni evidencia de aceptación FR/SC. La alta inactiva y la provisión previa de grupos siguen siendo los supuestos documentados, no una habilitación para eludir consentimiento.

## Post-hooks

Al cierre del intento, `.specify/extensions.yml` sigue ausente; no hay hooks `after_implement` registrados que despachar.

## Resolución del entorno con Podman

Por solicitud del responsable se inició el contenedor rootless existente `kudlab-auth-test-003`, imagen `docker.io/library/postgres:17-alpine`, mediante `podman start`. Ya estaba configurado para publicar exclusivamente `127.0.0.1:55432` hacia PostgreSQL; no se recreó, no se eliminó su almacenamiento ni se cambiaron credenciales.

- `podman exec kudlab-auth-test-003 pg_isready -U postgres -d kudlab_test`: acepta conexiones.
- `npm run db:migrate` con `DATABASE_URL` y `MIGRATION_DATABASE_URL` explícitamente dirigidas a la base local de pruebas: PASS, migraciones previas aplicadas correctamente. No se generaron nuevas migraciones.
- `npm test` con `DATABASE_URL` explícita de pruebas: **19 archivos y 83 pruebas aprobadas**, duración 108,98 s.
- `npm run typecheck`: PASS tras la suite.

T001 completada: la línea base ya está disponible. El contenedor queda iniciado. T002–T045 permanecen pendientes; esta puesta en marcha no constituye implementación de operaciones académicas.

## Revisión T002–T003

Modelo/contratos contrastados con la implementación: Académico aún no existe y las tablas previstas no duplican autenticación. Se mantienen altas inactivas y grupos preparados externamente. No hay nueva aprobación de activación o gestión de grupos.

La revisión de lifecycle/roles/promociones encontró orden identidad→cuenta, mientras edición/recuperación usa cuenta→identidad/sesión. Para no introducir deadlocks ni cambiar contratos de Usuarios, Académico toma cuenta→identidad→sesión y usa NOWAIT solo para identidad: una contención allí produce 503 neutral y rollback, nunca espera en una inversión. Cuenta y sesión permiten espera normal para serializar solicitudes concurrentes del mismo titular. Es una precisión del plan, no una ampliación de permisos.

## Implementación T004–T039 y aislamiento

- Se generó `0008_early_wild_child.sql`, snapshot y journal con Drizzle. El SQL agrega únicamente `groups`, `students`, FK a cuenta/grupo, tamaños originales, collation `C`, código único global, CHECK e índices. No se renumeraron migraciones ni se alteraron tablas de autenticación.
- Al intentar aplicarla sobre la base compartida `kudlab_test`, se encontraron tablas académicas de otro historial (`groups.teacher_account_id`) y una migración extra. La migración falló; no se borraron ni reconciliaron sus datos. Se creó la base separada `kudlab_students_005_test`, se migró desde cero y todas las ejecuciones posteriores usaron ese destino explícito. El default de pruebas se cambió al destino aislado.
- `prepareActive` comparte la preparación existente; `requireActive` conserva sus contratos previos. Académico exige docente y acepta actividad en su transacción, de forma que una sesión vencida o un fallo técnico final reviertan el cambio académico.
- Se implementaron POST alta, GET colección/detalle, PATCH e inactivación; validación estricta de campos y Unicode; DTO mínimo; aislamiento por joins y bloqueos de responsabilidad; errores neutrales; ningún endpoint de activación, tareas, consentimiento, traslado, borrado ni grupos.
- Pruebas escritas antes del comportamiento: helper transaccional inicialmente inexistente; rutas devolvían 404 antes de implementarse. Se observaron los fallos esperados y después los éxitos. No se interpretaron fallos de entorno como pruebas de negocio.
- La consulta independiente usa fixtures, incluye inactivos y ordena por ID. La corrección conserva ID/grupo/estado; la inactivación repetida conserva los datos y la sesión del docente. Se ejecutó también recorrido completo POST→GET→PATCH→inactivar→GET.

## Validaciones de persistencia

1. Migración Drizzle completa desde cero en `kudlab_students_005_test`: PASS.
2. Upgrade en otra base desechable recién creada, `kudlab_students_005_upgrade_test`: se reprodujeron SQL previos hasta 0007, se insertaron cuenta/identidad/sesión de prueba y se aplicó 0008. Se verificó conservación de cuenta y sesión: PASS.
3. En esa base de upgrade se comprobaron estado inicial inactivo, códigos sensibles a mayúsculas (`Case`/`case`), duplicado 23505, huérfano 23503, vacío 23514, longitud 22001, nulabilidad 23502 y prohibición de cascada al eliminar grupo 23503: PASS.
4. Una nueva ejecución de `npm run db:generate` contra el esquema actualizado informó `No schema changes, nothing to migrate`: snapshot consistente.

## Pruebas y cierre T040–T045

- `npm run typecheck`: PASS.
- `npm test` completo con `DATABASE_URL` de `kudlab_students_005_test`: **24 archivos, 113 pruebas aprobadas**, duración 124,61 s. Incluye las 83 pruebas anteriores y 30 nuevas, sin modificar reglas anteriores para lograr el resultado.
- Pruebas de duplicados concurrentes: alta/alta, alta/corrección y corrección/corrección, un titular final y rollback de otros campos del perdedor.
- Barreras deterministas para cierre confirmado entre guard y transacción, aceptación de operación bloqueada antes de cierre, cambio de estado/rol/responsabilidad después del guard y bloqueo incompatible de identidad sin deadlock. Reloj controlado para vencimiento al aceptar alta, corrección, inactivación y lectura: respuesta 401, cero cambios académicos, sin renovar actividad.
- Fallo técnico final: 503 sin detalles internos y rollback. Proveedor fallido: denegación sin datos ni escritura. Regresión de proveedor ausente, autenticación, inactividad, cierre, recuperación y roles incluida en suite previa.
- `git diff --check`: PASS. Checklist de requisitos no modificado; no hay `.specify/extensions.yml` ni hooks que ejecutar.
- Repetición final con `npm test` sin override después de ajustar `tests/setup.ts`: **24 archivos, 113 pruebas aprobadas**, duración 130,37 s; confirma el nuevo default aislado. `npm run typecheck` y `git diff --check` también PASS. T001–T045 marcadas completadas con este registro como evidencia.

| Requisito/criterio | Evidencia |
| --- | --- |
| FR-001, FR-003, FR-011 / SC-004 | Alta inactiva, rechazo de isActive/credenciales/ID, recuento de cuentas/credenciales/sesiones sin aumento; ausencia de rutas de activación. |
| FR-002, FR-005, FR-008, FR-010 / SC-001, SC-005 | Dos docentes × dos grupos, ámbito vacío, detalle/actualización/inactivación ajenos, cambios vigentes, errores 404 neutrales, identidad/verificación fallidas. |
| FR-004, FR-009 / SC-002 | Unitarias de límites/Unicode/trim/caso/ceros; unicidad global incluida inactivación; restricciones PostgreSQL y tres carreras de código. |
| FR-006, FR-007 / SC-003 | Corrección de activo/inactivo, duplicados con rollback, ID/grupo/estado inmutables; inactivación idempotente sin borrar. |
| FR-009 / SC-005 | Revalidación transaccional y rollback de los cuatro tipos de operación cuando falla aceptación; cierre y contención controlados. |
| FR-012 / SC-006 | Recorrido funcional completo sin estudiante interactivo y revisión de las cinco rutas, DTO y errores conforme al contrato. |

Se satisfacen los escenarios automatizados definidos; no se afirma cobertura exhaustiva de todas las intercalaciones posibles ni SLA temporal nuevo. Los tiempos globales incluyen más pruebas y no son una comparación controlada de rendimiento.

## Límites de entrega

No hubo despliegue productivo ni uso de datos reales de menores. Contenedor y bases de prueba quedan disponibles. Antes de uso real se requiere provisión operativa revisada de grupos y revisión de los supuestos de normalización/alta inactiva por el responsable; las pruebas no sustituyen aprobación institucional. No se habilita activación sin consentimiento. La pérdida de respuesta de red después de commit no permite prometer rollback: reconciliar por consulta/código único. No se agregaron auditoría académica ni políticas de retención nuevas.
