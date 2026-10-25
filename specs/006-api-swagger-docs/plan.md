# Implementation Plan: Documentación verificable de la API

**Branch**: `feat/api-swagger-docs` | **Date**: 2026-10-25 | **Spec**: [spec.md](spec.md)

**Input**: `specs/006-api-swagger-docs/spec.md`. El responsable solicita Plan tras revisar Specify; autorización para diseño, no implementación.

## Summary

Documentar las 26 operaciones existentes (21 Usuarios/autenticación, cinco de estudiantes operadas por profesores), sin cambiar contratos de negocio. Consolidar OpenAPI 3.1/YAML y servir contrato e interfaz únicamente en desarrollo/pruebas. Las propuestas históricas no serán fuente automática de operaciones disponibles.

## Technical Context

**Language/Version**: Node.js >=24 <25, TypeScript 5.9.3, ESM/NodeNext.

**Primary Dependencies**: Conservar Hono 4.13.13, @hono/node-server 1.19.17, Better Auth 1.7.7 y Zod 4.3.6. Añadir swagger-ui-dist 5.34.0 en runtime y @apidevtools/swagger-parser 13.1.0 en desarrollo, con peer openapi-types 12.1.3 fijado explícitamente. Reutilizar YAML 2.9.1, Ajv 8.20.0 y ajv-formats 3.0.1 para comprobaciones. Compatibilidad verificada por metadatos/código, instalación pendiente de implementación.

**Storage**: Un archivo YAML versionado, sin nuevas tablas ni migraciones. PostgreSQL existente solo para verificaciones de contratos reales.

**Testing**: Vitest 5.0.4, pruebas documentales sin BD y contratos/integración con BD aislada; revisión visual en navegador sin añadir framework E2E. Detalles delegados JWKS/token/cookies fijados por código1.7.7 en research.md, con confirmación ejecutada pendiente en implementación.

**Target Platform**: Backend Node.js sobre Linux; navegador para Swagger UI.

**Project Type**: Servicio HTTP existente, sin nuevo frontend independiente ni motor de juegos.

**Performance Goals**: No se incorporan cifras históricas no ratificadas; los recursos documentales no deben introducir validación o generación por petición en endpoints de negocio.

**Constraints**: Misma API y guardas; documentación únicamente con entorno explícito `development` o `test`, resto 404; ejemplos sintéticos; sin secretos, datos reales ni login estudiantil.

**Scale/Scope**: 26 operaciones; `/docs` y `/openapi.yaml` son recursos documentales adicionales y no se cuentan como negocio. Ubicación canónica: `docs/api/openapi.yaml`, siguiendo YAML existente y evitando que un contrato operativo dependa de una carpeta de feature histórica.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio / gate | Evaluación previa a investigación | Evidencia / límite |
| --- | --- | --- |
| I. Finalidad pedagógica | PASS | Describe contratos, no añade diagnósticos, rankings ni reglas de evaluación. |
| II. Menores y acceso | PASS | Profesores operan estudiantes propios; preserva TEACHER/ámbito, ADMIN no universal; datos solo sintéticos. |
| III. Evidencia e indicadores | PASS / no altera este dominio | Sin sesiones de tareas, fórmulas ni ingesta nueva. |
| IV. Límites y contratos | PASS | Documentación transversal fuera de módulos de negocio; contratos definidos antes de cambiar publicación; no refactoriza routers. |
| V. Trazabilidad y verificación | PASS | Código base `096a8fa`, requisitos del usuario e inventario; contratos propuestos no equivalen a implementados; pruebas planificadas, no declaradas ejecutadas. |
| Requisitos antes de diseño | PASS | Aclaraciones resueltas en Specify; solicitud posterior de Plan autoriza avanzar al diseño. |
| Stack y objetivos | PASS | Conserva stack observado; sin promesas históricas nuevas de latencia o disponibilidad. |

No hay violaciones que requieran excepción. La investigación cerró las incógnitas técnicas antes de completar diseño. No se derivan nuevas reglas de A/D/V3 y por ello no se usan resúmenes para fijar normativa no contrastada.

**Reevaluación posterior a Phase 1:** PASS en todos los gates anteriores. El diseño mantiene únicamente dos recursos principales y sus dos assets, cerrados fuera de desarrollo/pruebas; no crea tablas, cambios de permisos o entrada de datos reales. El catálogo conserva las 26 operaciones actuales y separa respuestas delegadas del proveedor. Tests de seguridad/ámbito existentes se reutilizan como regresión, no se reemplazan por validación documental. Fuente/versión y condición de pruebas pendientes quedan registradas; no hay excepciones constitucionales.

## Project Structure

### Documentation (this feature)

```text
specs/006-api-swagger-docs/
├── spec.md
├── inventory.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/documentation.md
└── quickstart.md
```

`tasks.md` corresponde al comando siguiente; no se genera en Plan.

### Source Code (repository root)

```text
docs/api/openapi.yaml                    # contrato operativo futuro
src/docs/documentation.routes.ts         # publicación aislada futura
src/app.ts                              # montaje documental mínimo futuro
tests/unit/openapi-document.test.ts      # comprobación documental futura
tests/unit/documentation-routes.test.ts  # matriz de entornos futura
tests/contract/api-openapi.test.ts       # catálogo y respuestas futuras
tests/openapi.helpers.ts                # helper de contrato canónico compartido futuro
package.json / package-lock.json        # dos paquetes y peer, docs:check futuros
README.md                               # acceso y mantenimiento futuros
docs/agent-context/                     # correcciones de disponibilidad futuras
```

**Structure Decision**: Mantener el servicio único. No crear modelos persistidos, repositorios, generadores o nueva aplicación UI. Las rutas documentales se separan del negocio y el YAML canónico no reemplaza el estado histórico de contratos en `specs/001…005`.

## Phase 0 — Research outcome

Investigación consolidada en [research.md](research.md), con decisiones, razones, alternativas y fuentes. Dos investigaciones independientes cubrieron publicación/validación y detalles del proveedor exacto. Incógnitas iniciales resueltas: ubicación, paquetes/versiones, soporte 3.1, autoalojamiento, entornos, pruebas sin BD, cookies/JWT/errores delegados. No bloqueos funcionales ni técnicos pendientes.

## Phase 1 — Design

### Contrato operativo y seguridad

El YAML canónico se redactará durante implementación según [inventario](inventory.md), [modelo documental](data-model.md) y [contrato de publicación](contracts/documentation.md). Tendrá 26 operaciones, IDs únicos, siete tags, esquemas explícitos y ejemplos sintéticos válidos. Usará cookie de sesión con variante HTTPS documentada o Bearer opaco como alternativas; no JWT como credencial de negocio. Público no significa sin acceso a BD: JWKS puede persistir claves. No se unifican los errores del proveedor con los mappers locales.

### Publicación mínima

Router documental independiente construido con entorno explícito, registrado solo development/test y montado desde app.ts. `/docs` utiliza el YAML de `/openapi.yaml` y assets locales en `/docs/swagger-ui.css` y `/docs/swagger-ui-bundle.js`; no abrir directorios. Usar resolución absoluta de módulo/paquete, no cwd. No leer archivos ni resolver assets al construir la rama deshabilitada. Los métodos/rutas de negocio y guardas permanecen intactos.

UI de consulta con Try it out deshabilitado, sin autorización persistida, preautorización, fuentes por query, validador remoto o CDN. Esta decisión conserva todos los escenarios de presentación exigidos y evita construir un cliente de escrituras no solicitado. El recurso se consulta sin sesión en los entornos habilitados; consultar documentación no otorga acceso a negocio.

### Estrategia de validación

1. **Documento sin BD:** parseo YAML con rechazo de claves duplicadas; validación completa Parser 13.1.0 sobre copia, referencias solo internas y resolutores externos deshabilitados. Comprobaciones semánticas adicionales para IDs, metadatos, seguridad, parámetros y conjunto método/ruta. Ajv2020/formatos para esquemas y ejemplos contextuales, sin coerción/defaults ni eliminación de propiedades. Probar mutaciones negativas del catálogo.
2. **Router sin BD:** construir Hono aislado, comprobar contenido y tipos de medios, mismo archivo canónico y assets permitidos, matriz development/test/production/staging/vacío/ausente. No importar app.ts/fixtures/bootstrap. `docs:check` correrá únicamente estos dos archivos unitarios.
3. **Contratos con BD:** comparar conjunto real de montajes explícitos y lista blanca de cinco operaciones auth contra catálogo; validar éxitos de las 26 operaciones y fallos/cabeceras representativos. La ruta ALL no permite enumerar las operaciones del proveedor: contrastar lista blanca de app.ts y pruebas de fronteras, sin asumir que todo ALL es público. Helper canónico compartido, sin duplicar suites por dominio. Mantener regresión histórica. Verificar producción con y sin ADMIN construyendo app después de fijar entorno: setup fuerza NODE_ENV=test. BD exclusiva 006 porque helpers truncan tablas.
4. **Navegador:** abrir y expandir una operación por cada uno de siete tags; verificar los 26 métodos/rutas, esquemas, seguridad y ejemplos; Network/Console sin errores, referencias rotas, CDN, tráfico externo ni negocio. Registrar versión del navegador/evidencia, separado de resultados documentales y HTTP.

Recorrido reproducible y precauciones en [quickstart.md](quickstart.md). No se ejecutan aún pruebas de una UI/rutas/contrato inexistentes.

### Mantenimiento y trazabilidad

Agregar acceso/entornos/pasos de actualización en README y corregir únicamente afirmaciones de disponibilidad desactualizadas en feature fuente, arquitectura y referencias afectadas. Mantener explícito que profesores gestionan estudiantes y no habilitar grupos, tareas u otros módulos por asociación. La versión inicial 0.1.0 del catálogo no certifica despliegue ni aprobación de propuestas históricas.

### Mapa de requisitos a diseño/verificación

| Requisitos | Diseño / verificación | Criterios |
| --- | --- | --- |
| FR-001–005 | Inventario de 26 operaciones, IDs/metadatos, YAML canónico, esquemas y ejemplos; igualdad de catálogo, Parser/Ajv y respuestas reales | SC-001–003 |
| FR-006–009 | Seguridad persistida/rol/ámbito, token de un uso, respuestas del proveedor y cinco operaciones de estudiantes; pruebas existentes más cobertura canónica | SC-002/003/005 |
| FR-010 | Ejemplos sintéticos, sin credenciales activas ni tráfico/envíos con direcciones de ejemplo; revisión integral | SC-005 |
| FR-011–012 | Router por entorno, autoalojamiento, UI de consulta y sin CORS nuevo; matriz de entornos y navegador | SC-004/005 |
| FR-013–014 | Documento completo/ejemplos, contrato real y revisión visual separados; pruebas negativas y evidencia | SC-003/004 |
| FR-015–016 | README/contexto, fuente única y regresión existente; revisión de diff sin cambios de negocio | SC-006 |

## Estado al finalizar Plan

Phase 0 y Phase 1 completas. Artefactos de diseño generados, sin cambios de código, dependencias instaladas, rutas, migraciones o suites ejecutadas. `setup-plan.sh` devolvió BRANCH=`006-api-swagger-docs` como identificador de feature desde feature.json; `git branch --show-current` confirmó la rama real `feat/api-swagger-docs`, que se conserva. Sin cambio de rama ni worktree.

La spec mantiene su registro de revisión; la ejecución solicitada de Plan autoriza avanzar al diseño, sin afirmar una aprobación institucional general ni de los RF históricos. Siguiente comando propuesto: `/speckit.tasks`; no ejecutado.

## Complexity Tracking

Sin excepciones constitucionales ni capas nuevas de negocio. Dos dependencias nuevas y un peer de tipos explícito son suficientes; no CLI extra, pipeline de generación, framework E2E, frontend independiente o persistencia nueva.
