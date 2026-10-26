# Evidencia de implementación — documentación API

## Autorización y base

- Aprobación explícita del responsable: «SI, apruebo», tras solicitar confirmación de especificación/diseño y ejecución de las 32 tareas sin cambiar negocio, 2026-10-25.
- Rama: `feat/api-swagger-docs`; base `096a8fa178404ef1a951899f5ea76e15e14c1991`.
- Worktree dedicado `Kudlab-backend-api-swagger-docs`; Node v24.18.0.
- Estado inicial: comando Specify modificado y feature fuente copiados con autorización; artefactos 006 sin versionar. Se conservan. Ningún cambio inicial en negocio.
- Límites: 26 operaciones actuales, profesores operan registros de estudiantes; sin nuevos endpoints de negocio, cambios de permisos, migraciones, despliegue ni commits automáticos.
- Checklist de requisitos: 16/16 antes de implementación, leído sin modificar sus marcadores. No existe extensions.yml; sin hooks registrados.
- Ignorados verificados: node_modules, salidas, cobertura, logs y archivos de entorno (excepto plantilla). Proyecto private, sin Dockerfile, ESLint, Prettier, Terraform o Helm: no añadir ignores para herramientas inexistentes.

## Preparación

- Dependencias fijadas e instaladas con analítica deshabilitada y scripts de instalación omitidos; no se ejecutó audit fix ni se actualizaron dependencias de negocio. Comparación automatizada del lockfile contra HEAD: cero versiones de paquetes preexistentes alteradas, doce entradas nuevas (paquetes documentales y transitivas).
- Contenedor PostgreSQL17 nuevo `kudlab-docs006-test`, base exclusiva `kudlab_docs006_test`, puerto aleatorio ligado a localhost. Configuración en `.env.docs-test` ignorado, no reproducida en este informe. URL de migración y tests apuntan al mismo destino exclusivo.
- `node --env-file=.env.docs-test node_modules/drizzle-kit/bin.cjs migrate`: PASS. Se aplicaron migraciones existentes, sin crear migraciones de esta feature.
- `npm audit`: ocho alertas (7 moderadas y 1 alta) en dependencias existentes/transitivas: drizzle-kit/esbuild, fast-uri, nodemailer/smtp-server y zod. No se declara resuelto ni se amplía esta feature para actualizar autenticación, validación o correo. Los resolutores externos del validador documental están deshabilitados. Requiere revisión de seguridad separada.

## 1. Documento, esquemas y ejemplos

- TDD inicial: prueba documental y dos de contrato fallaron por ausencia de `docs/api/openapi.yaml`, no por conexión de BD. Se añadió contrato canónico y se corrigió una referencia JWKS ausente. Resultado posterior: tres pruebas PASS, incluyendo éxitos nominales de las26 operaciones.
- TDD de seguridad: detectó ejemplo410 de otro flujo y se separaron respuestas de invitación/correo/recuperación. Otra expectativa de403 bajo test expuso el default del proveedor que omite origen; se comprobó el comportamiento no-test en proceso aislado, sin modificar controles.
- TDD de ejemplos: fallos esperados al faltar recorrido contextual; después `npm run docs:check`: **22/22 PASS**, sin importar app/bootstrap/fixtures ni usar BD. Incluye OpenAPI completo3.1, referencias internas, IDs/metadatos, igualdad de26 operaciones y siete tags, pruebas negativas y ejemplos de esquemas/medios/parámetros/cabeceras/reutilizables. Incluye ejecución del router desde otro directorio para probar independencia de cwd. Se revisó también el YAML parseado para evitar comas sin comillas que fragmentaran descripciones en flow mappings.
- Router unitario: dos entornos habilitados y cuatro deshabilitados; contrato idéntico al archivo, assets locales, ausencia de lecturas cuando deshabilitado, archivos no permitidos404, sin CDN/Petstore/preautorización/ejecución de negocio.

## 2. HTTP, seguridad y regresión

- `node --env-file=.env.docs-test node_modules/vitest/vitest.mjs run tests/unit/openapi-document.test.ts tests/contract/api-openapi.test.ts`: PASS en checkpoint de seguridad (6 pruebas antes de ampliar pruebas negativas).
- Cobertura canónica: éxitos de las26 operaciones, igualdad con montajes reales y lista blanca,401 en toda operación protegida,400 de entradas públicas inválidas,403 por rol en cuentas/estudiantes,404 neutral de ámbito y409 de código duplicado,410 por flujo, mensaje neutro de recuperación, cookie rememberMe=false y JWT aislado rechazado.
- Proceso separado con NODE_ENV=production y baseURL HTTPS sobre la BD desechable: cookie __Secure-/HttpOnly/Max-Age1800,403 INVALID_ORIGIN/MISSING_OR_NULL_ORIGIN y429 con X-Retry-After confirmados contra proveedor1.7.7. Ningún envío SMTP ni acceso productivo; se usaron variables sintéticas. El warning de IP y log de origen inválido corresponden a estos casos negativos intencionales.
- `tests/unit/documentation-routes.test.ts` + `tests/integration/documentation.test.ts`: **12/12 PASS**, antes de implementar fallaron por router inexistente/404 en entornos habilitados. Montaje real200 en development/test y404 en production/staging/vacío/ausente, con o sin ADMIN, incluidos ambos assets.
- Suite completa: primer intento excedió el timeout de120s; segundo intento **28 archivos,145 pruebas PASS** en186.25s. Pasada final tras agregar comprobación explícita de cwd y cabeceras: **28 archivos,146 pruebas PASS** en200.84s. La comprobación cwd también pasó de forma aislada tras hacer portable su directorio de ejecución (7/7 del router).

## 3. Navegador real

- Fecha2026-10-25; Chromium152.0.7977.167 / Electron44.9.1, OpenCode2.1.4, Linux.
- Página local `http://localhost:3006/docs` servida por el router documental aislado, sin arrancar bootstrap ni acceder a BD. Montaje real en app verificado por separado mediante integración.
- Render observado: título correcto,26 bloques de operación y siete tags. Expandida una operación por tag: sign-in/email, listado de cuentas, aceptar invitación, confirmar correo, listado de solicitudes, solicitar recuperación y listado de estudiantes. Los siete bloques mostraron tablas de respuesta y ejemplos/esquemas (entre4 y6 por bloque), sin errores OpenAPI visibles.
- Red de la página: únicamente CSS200, bundle200 y YAML200 del mismo origen. Expandir operaciones no añadió peticiones; cero `/api/*`, CDN o validación externa. Consola de warning/error vacía; cero Try it out y localStorage vacío.
- Limitación de evidencia: herramienta screenshot rechazó captura porque la ventana de escritorio no estaba visible, incluso tras enfocar tab. Se conserva evidencia textual del render/DOM, consola y Performance de la sesión; **no hay captura PNG ni se afirma revisión de píxeles**. La presentación y expansión sí se comprobaron en el navegador real, no solo en HTML estático.

## Revisión final y trazabilidad

- TypeScript: `npm run typecheck` PASS; se corrigió únicamente tipado de frontera del documento dinámico hacia OpenAPI.Document del validador, no código de negocio.
- `git diff --check` PASS; revisión de código productivo: `src/app.ts` solo importa y monta router documental, dos líneas añadidas. Ninguna guarda, servicio, parser, configuración auth, migración, CORS o test histórico modificado.
- Ejemplos revisados íntegramente: nombres/direcciones/códigos/UUID sintéticos; marcadores de tokens no activos; ningún secreto ni dato real. La UI no recibe respuestas autenticadas ni datos de menores. No se versiona configuración local de BD ni cookies generadas por tests.
- README/guía recorridos con comandos reales; mutaciones de método/ruta detectadas por pruebas negativas. Fuentes/contexto aclaran estudiantes implementados y gestionados por profesores, sin añadir otros recursos.
- Constitución: principios I–V conformes; no diagnósticos/indicadores, permisos ni reglas legales nuevas. No elevar propuestas a implementación.

| Cobertura | Evidencia |
| --- | --- |
| FR-001–005, SC-001–003 | Igualdad de26 operaciones/IDs y montajes; esquema completo y ejemplos; recorrido exitoso de cada operación y errores por dominio. |
| FR-006–010, SC-002/003/005 | Sesión/cookies/Bearer/JWT, rol y ámbito, tokens de uso único, recuperación neutra; errores de proveedor probados fuera de test y regresiones existentes. |
| FR-011–012, SC-004/005 | Router aislado e integrado, matriz de seis entornos y ADMIN, assets cerrados y UI local de consulta sin tráfico de negocio. |
| FR-013–014, SC-003/004 | Validador completo + Ajv contextual + mutaciones negativas; evidencia de navegador separada, limitación PNG explícita. |
| FR-015–016, SC-006 | README/quickstart/contexto y revisión de diff; regresión completa, ningún comportamiento de negocio cambiado. |

32/32 tareas completadas; código de negocio preservado, validaciones documentales/HTTP/navegador separadas y limitaciones declaradas. Sin hooks registrados. No commit ni despliegue automático. Infraestructura de test exclusiva conservada detenida para repetir; el servidor de inspección documental no usa BD ni bootstrap.
