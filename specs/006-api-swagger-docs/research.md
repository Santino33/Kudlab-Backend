# Phase 0 — Investigación y decisiones

Fecha: 2026-10-25. Estado: investigación cerrada para diseño; sin instalación ni cambios de código, sin ejecutar pruebas contra BD. Requisitos: [spec.md](spec.md); comportamiento de negocio: [inventory.md](inventory.md). Las dependencias nuevas se fijarán en manifiesto/lockfile durante implementación, no en Plan.

## R1. Fuente canónica y forma de mantenerla

**Decision:** `docs/api/openapi.yaml`, OpenAPI 3.1.0, catálogo manual contrastado con implementación. Referencias internas y `servers` relativo `/`. Contratos bajo `specs/001…005/contracts/` conservan su condición histórica y pruebas consumidoras.

**Rationale:** El repositorio ya usa YAML 3.1 y pruebas Ajv. Una única fuente operativa fuera de carpetas históricas distingue disponibilidad actual de propuestas y evita duplicar un contrato para servirlo. No se introduce generación que obligue a cambiar routers/Zod o habilitar endpoints del proveedor.

**Alternatives considered:** YAML en `specs/006/contracts/` conserva patrón histórico pero acopla documentación permanente a una feature; JSON duplicado deriva; generación desde routers o plugin Better Auth obliga a adaptar negocio o anuncia capacidades bloqueadas. `docs/openapi.yaml` es equivalente en formato; se agrupa en `docs/api/` para hacer explícita la documentación de consumo.

## R2. Swagger UI local y estrictamente documental

**Decision:** Añadir `swagger-ui-dist@5.34.0` como dependencia de runtime para servir su CSS/bundle en los entornos habilitados; no instalar `@hono/swagger-ui`. HTML mínimo propio y dos assets explícitos mediante `@hono/node-server/serve-static` ya disponible. Deshabilitar ejecución interactiva con `supportedSubmitMethods: []`, persistencia de autorización, configuración por query y validador remoto; sin Petstore, CDN ni precarga de credenciales.

**Rationale:** La feature exige explorar y presentar contratos, no ejecutar negocio. Los assets locales evitan red externa y versiones flotantes. Una plantilla pequeña más los dos archivos necesarios evita sumar una librería que solo genere HTML. Versión 5.34.0 soporta 3.1; no declara restricción de motor porque sus archivos son estáticos. Su dependencia de instalación `@scarf/scarf@1.4.0` permite desactivar analítica con `SCARF_ANALYTICS=false`; incluirlo en guía.

**Alternatives considered:** `@hono/swagger-ui@0.6.1` admite Hono >=4, pero por defecto usa jsDelivr; con assets locales igualmente requeriría `swagger-ui-dist`. CDN añade dependencia externa y filtración de solicitudes. Playwright/Cypress no están instalados: revisión real de navegador registrada, sin nuevo framework E2E solo para esta UI.

**Evidence:** [registro 5.34.0](https://registry.npmjs.org/swagger-ui-dist/5.34.0), [README versionado](https://github.com/swagger-api/swagger-ui/blob/v5.34.0/README.md), [configuración UI](https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/), [adaptador estático Node/Hono](https://hono.dev/docs/getting-started/nodejs), [alternativa 0.6.1](https://registry.npmjs.org/@hono%2Fswagger-ui/0.6.1). Compatibilidad por documentación/código, no ejecución ya validada.

## R3. Validez completa y ejemplos

**Decision:** Añadir `@apidevtools/swagger-parser@13.1.0` en devDependencies; fijar su peer `openapi-types@12.1.3` directamente como dependencia de desarrollo si no está satisfecho explícitamente. Reutilizar `yaml@2.9.1`, `Ajv2020` de Ajv 8.20.0, `ajv-formats@3.0.1` y Vitest 5.0.4. No añadir CLI/configuración Redocly.

**Rationale:** Swagger Parser 13.1.0 requiere Node >=22.19.0, compatible con Node 24, y su implementación acepta OpenAPI 3.1.0/3.1.1/3.1.2. Validar documento entero y referencias, no confundir parseo YAML o esquemas de payload con validación completa OpenAPI. Deshabilitar resolutores de fichero y red y rechazar `$ref` externos antes de validar una copia.

Su validador semántico de especificación no aplica todas las reglas a OpenAPI: agregar explícitamente unicidad/presencia de operationId, metadatos exigidos, parámetros de ruta y seguridad existente, igualdad de operaciones y ejemplos. Ajv no evalúa automáticamente las anotaciones `example/examples`: recorrer ejemplos de esquemas, medios, parámetros, cabeceras y ejemplos reutilizados, contra el esquema contextual resuelto. Validar sin coerción, inserción de defaults o borrado de propiedades. Conservar patrón actual de tests Ajv sin duplicar helpers por dominio.

**Alternatives considered:** Redocly CLI/core 2.71.0 compatible con Node 24 aporta reglas listas, pero añade configuración/dependencias y reglas por defecto ajenas al alcance. Ajv solo no sustituye validación estructural OpenAPI. El README de Swagger Parser rezagado no es suficiente para negar 3.1: se verificó código versionado del paquete.

**Evidence:** [registro Parser13.1.0](https://registry.npmjs.org/@apidevtools%2Fswagger-parser/13.1.0), [versiones aceptadas](https://github.com/APIDevTools/swagger-parser/blob/v13.1.0/lib/index.js), [schema validator](https://github.com/APIDevTools/swagger-parser/blob/v13.1.0/lib/validators/schema.js), [limitación semántica](https://github.com/APIDevTools/swagger-parser/blob/v13.1.0/lib/validators/spec.js), [Ajv draft2020-12](https://ajv.js.org/json-schema.html), `tests/contract/accounts-openapi.test.ts`. Registry consultado el 2026-10-25.

## R4. Aislamiento de publicación, entornos y pruebas

**Decision:** Factoría pequeña de router documental en `src/docs/documentation.routes.ts` con argumento de entorno explícito y valor por defecto `process.env.NODE_ENV`. Montar desde `src/app.ts` sin alterar orden/guardas de `/api`. Registrar únicamente si el entorno es exactamente `development` o `test`; el resto no registra ni lee contrato/assets. Resolver ficheros desde módulo/paquete con rutas absolutas, nunca desde inputs HTTP o directorio de arranque. No publicar un árbol de archivos amplio.

**Rationale:** El script `dev` actual no fija NODE_ENV; por seguridad ausencia no equivale a desarrollo. Tests pueden construir router aislado sin auth/BD. `tests/setup.ts` fuerza `NODE_ENV=test`; las pruebas de producción deben construir con entorno explícito o cambiar/restaurar antes de importar app. CORS actual solo `/api/*`; documentación mismo origen no necesita tocarlo.

**Decision (verification):** `docs:check` ejecutará únicamente las dos pruebas unitarias documentales, sin importar app/fixtures/bootstrap. Pruebas contractuales con BD exclusiva 006, guardas y respuestas reales se mantendrán separadas. La navegación visual manual cubre siete tags, assets/YAML, consola, red y ausencia de tráfico de negocio/exterior.

**Alternatives considered:** habilitar salvo producción filtra en staging/entornos desconocidos; habilitar según rol cambia la decisión de publicación; resolver documentación en cada petición de negocio introduce acoplamiento innecesario; arrancar `src/index.ts` para probar recursos exige bootstrap y no sirve como prueba documental sin BD.

**Evidence:** `src/app.ts`, `src/index.ts`, `src/config/env.ts`, `vitest.config.ts`, `tests/setup.ts`, `tests/helpers.ts`. Las fixtures truncan tablas con CASCADE: jamás usar BD compartida ni productiva. No fijar nuevas cifras de rendimiento no ratificadas.

## R5. Detalles exactos de Better Auth 1.7.7

**Decision:** Documentar únicamente las cinco operaciones de la lista blanca en `app.ts`; precisar vistas locales y respuestas delegadas de proveedor por separado. El código instalado de versión 1.7.7 y configuración real prevalecen sobre documentación genérica. No habilitar plugin OpenAPI ni más rutas.

**Evidence/version:** `package.json`/`package-lock.json` fijan 1.7.7. Se inspeccionó en solo lectura la instalación de esa misma versión accesible en el worktree original (`node_modules/better-auth`), sin copiarla ni modificarla. Fuentes reproducibles de paquete: [registro1.7.7](https://registry.npmjs.org/better-auth/1.7.7), rutas internas de distribución enumeradas abajo. `/llms.txt` del servidor documental identificó v1.7 como latest, pero búsqueda `1.7` no retornó resultados; la página [JWT](https://better-auth.com/docs/plugins/jwt) se recuperó de búsqueda latest solo como apoyo conceptual. Los detalles se fundamentan en código1.7.7.

### Contratos y cabeceras verificados por lectura

- `GET /jwks` es público y devuelve `{keys:[…]}`. Por defecto EdDSA/Ed25519; elementos habituales `alg,crv,kty,x,kid`. Exigir `kid,kty,alg`, no exigir RSA `n/e`, `use` o `y` para Ed25519. Nunca material privado. Puede generar/persistir clave si no existe: público no equivale a “no usa BD”. Fuentes: `dist/plugins/jwt/index.mjs`, `utils.mjs`.
- `GET /token` devuelve `{token:string}` tras precontrol de sesión/cuenta/inactividad local. JWT firmado por defecto con `alg/kid`, payload de usuario del proveedor más `iat/sub/exp/iss/aud`; expiración15min, iss/aud del baseURL. No prometer el DTO filtrado de login para el payload JWT ni usar el JWT como sesión de negocio. Fuente: `dist/plugins/jwt/sign.mjs`.
- `POST /sign-out` puede llamarse sin cuerpo: adaptador local reemplaza lo recibido por `{}`. Devuelve `{success:true}` y expira cookies; descartar opciones genéricas callbackURL/redirect/state que esta app no pasa. El proveedor captura ciertos fallos de borrado, por lo que no prometer 503 ante cualquier fallo de eliminación. Fuentes: `src/app.ts:59–69`, `dist/api/routes/sign-out.mjs`.
- Cookie por baseURL configurado: `better-auth.session_token` en HTTP, `__Secure-better-auth.session_token` en HTTPS. HttpOnly, Path=/, SameSite=Lax y Secure cuando corresponda; sin dominio compartido. Cookie cache no habilitada; no presentar `session_data` como credencial normal. Fuente: `dist/cookies/index.mjs`.
- Bearer es credencial de sesión opaca, publicada en `set-auth-token`; no `bearerFormat: JWT`. Plugin actual acepta credenciales firmadas y, sin requireSignature, también opacas sin firma que adapta internamente. Fuentes: `dist/plugins/bearer/index.mjs`, pruebas existentes `authentication`/`auth-boundaries`.
- `rememberMe` omitido/true genera cookie persistente Max-Age1800; false omite Max-Age y usa dont_remember. En false, proveedor crea sesión interna de86400s, pero sigue vigente el límite local de30min de inactividad. No confundir ambos relojes. `/get-session` y `/token` no registran actividad protegida aceptada. Fuentes: `dist/api/routes/sign-in.mjs`, `dist/db/internal-adapter.mjs`, cookies y `src/auth/session-activity.ts`.
- Login conserva Set-Cookie y set-auth-token; sign-out devuelve expiración mediante múltiples Set-Cookie. No prometer `set-auth-jwt` en `/get-session` local: su envoltorio no reenvía esas cabeceras. No afirmar Cache-Control no-store si código no lo activa.

### Errores: conservar diferencias

- Login adapta sus fallos; otras rutas delegadas no pasan todas por el mismo mapper. Precontrol local token/cierre: 401 `UNAUTHENTICATED`, 503 `UNAVAILABLE` cuando captura excepción.
- Sign-out con cookie puede recibir 403 proveedor `INVALID_ORIGIN` o `MISSING_OR_NULL_ORIGIN` según comprobación de origen/CSRF. No cambiar trustedOrigins/CORS para evitarlo.
- Token puede devolver401 proveedor `UNAUTHORIZED` si sesión deja de valer entre precontrol y delegación.
- Cuando el rate limiter está habilitado, el proveedor puede devolver429 `{message:"Too many requests. Please try again later."}` sin `code`, con `X-Retry-After`, no asumir `Retry-After`. Marcar condición de entorno/configuración en documentación.
- Errores internos de JWKS/proveedor no se deben presentar siempre como503 español; documentar forma real o respuesta de fallo delegada sin imponer `UserError` a todo status.

Fuentes de errores: `dist/api/middlewares/origin-check.mjs`, `dist/api/routes/session.mjs`, `dist/api/rate-limiter/index.mjs`, `dist/context/create-context.mjs`, `@better-auth/core/dist/error/codes.mjs`. Evitar normalizar documentación para luego modificar negocio.

**Alternatives considered:** copiar auth.openapi.yaml omite jwks/token/rememberMe y matices reales; usar solo docs latest no fija versión; esquema único UserError falsea respuestas delegadas. Ninguna es aceptable.

**Validation remaining (not an unresolved design decision):** Confirmar estos detalles por pruebas contractuales en implementación, incluidos JWKS, cookie HTTP/HTTPS, rememberMe y errores de origen/rate limit cuando aplican. No se certifica ejecución por leer el código.

## R6. Alcance de entrega del comando Plan

**Decision:** Crear plan, investigación, modelo documental, contrato de publicación/cobertura y guía de validación. No generar aún el YAML publicable, UI, scripts ejecutables, migraciones, rutas o tests de implementación; no crear tasks.md.

**Rationale:** Plan define cómo conservar los contratos y comprobarlos; la feature requiere verificar el catálogo antes de afirmarlo operativo. Los 26 operationId y las interfaces documentales están fijados en `contracts/documentation.md`, sin crear un segundo contrato operativo que derive de `docs/api/openapi.yaml`.

**Alternatives considered:** llenar dos YAML (diseño y operativo) duplica fuente; implementar la UI durante Plan excede el comando. Una verificación visual no puede declararse pasada antes de construir la UI.

## Cierre

Sin incógnitas técnicas bloqueantes. Versiones/dependencias, ubicación, política de entorno, configuración UI, validación y detalles del proveedor resueltos para planificación. La solicitud posterior de Plan autoriza este diseño; no cambia por sí sola las políticas de negocio ni certifica despliegue. Gates constitucionales revaluados en [plan.md](plan.md).
