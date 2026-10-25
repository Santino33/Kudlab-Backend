# Quickstart: validación de la documentación

**Estado:** guía de la feature implementada. El catálogo es `docs/api/openapi.yaml`; ver [contrato de publicación](contracts/documentation.md), [modelo documental](data-model.md) y [evidencia de ejecución](validation.md), que distingue documento, HTTP/regresión y navegador.

## 1. Prerrequisitos y límites

- Node.js `>=24 <25` y npm compatible; ejecutar desde la raíz del worktree `Kudlab-backend-api-swagger-docs`.
- Dependencias instaladas desde el lockfile. Para desactivar analítica de instalación de Swagger UI:

  ```bash
  SCARF_ANALYTICS=false npm ci
  ```

- El contrato canónico es `docs/api/openapi.yaml`. Los YAML de `specs/001…003` son referencias históricas, no el catálogo único de disponibilidad actual.
- Ninguna verificación necesita datos reales. No copiar `.env` productivos, tokens vigentes ni correos de profesores/menores para ejemplos o capturas.

## 2. Validación documental sin base de datos

Sin PostgreSQL ni archivo de entorno:

```bash
npm run docs:check
npm run typecheck
```

`docs:check` ejecuta `tests/unit/openapi-document.test.ts` y `tests/unit/documentation-routes.test.ts` sin importar `src/app.ts`, `tests/helpers.ts` ni `src/index.ts`.

Resultado esperado: YAML/OpenAPI 3.1 válido, referencias internas resueltas, ejemplos válidos, IDs únicos, exactamente las operaciones listadas en el inventario, assets locales y entorno cerrado. Las pruebas negativas deben demostrar rechazo de `$ref` roto, ID duplicado, ejemplo incorrecto y operación agregada/eliminada.

La matriz del router aislado incluye `development`, `test`, `production`, `staging`, vacío y variable ausente. **No** basta ejecutar Vitest con `NODE_ENV=production`: `tests/setup.ts` fija `test`. La prueba debe cambiar/restaurar el entorno antes de construir el router o pasar explícitamente ese valor a su factoría.

## 3. Contratos reales y regresión (BD aislada obligatoria)

**Advertencia:** `tests/helpers.ts` trunca tablas con `CASCADE`. No ejecutar la suite completa contra bases compartidas, escolares o productivas. Verificar manualmente que `DATABASE_URL` y cualquier `MIGRATION_DATABASE_URL` apunten a la base exclusiva de pruebas del worktree, no a la de otro agente.

`tests/setup.ts` usa por defecto una BD local en puerto 55432; no asumir que está creada, migrada o que sea exclusiva de esta feature. Configurar la URL de una BD dedicada 006 antes de ejecutar. Las migraciones y tests deben apuntar a la misma BD; no basta que el setup rellene el valor para tests, porque `db:migrate` utiliza la configuración del proceso.

Para esta ejecución se creó el contenedor **exclusivo** `kudlab-docs006-test`, PostgreSQL17, con base `kudlab_docs006_test` y puerto asignado solo a localhost; no se reutilizó ningún contenedor o BD de otro worktree. Su configuración local se guarda en `.env.docs-test` (ignorado). Ese archivo debe contener DATABASE_URL y MIGRATION_DATABASE_URL a la misma base desechable. No copiar credenciales productivas ni versionar su contenido. Comprobar destino antes de cada ejecución.

Con ese archivo local y PostgreSQL operativo:

```bash
node --env-file=.env.docs-test node_modules/drizzle-kit/bin.cjs migrate
node --env-file=.env.docs-test node_modules/vitest/vitest.mjs run tests/contract/api-openapi.test.ts tests/integration/documentation.test.ts
node --env-file=.env.docs-test node_modules/vitest/vitest.mjs run
```

Los recorridos canónicos están en `tests/contract/api-openapi.test.ts`; reutilizan fixtures existentes. La matriz de montaje/ADMIN está en `tests/integration/documentation.test.ts`. Los contratos históricos siguen siendo regresión. Las comprobaciones de origen/HTTPS/rate limit del proveedor se ejecutan en un proceso aislado no-test: Better Auth omite origin check por defecto bajo test.

Resultados esperados:

- Igualdad del catálogo con los montajes reales más la lista blanca de autenticación, no solo el total de operaciones.
- Éxitos y errores representativos aplicables de las 26 operaciones compatibles con los esquemas; campos y cabeceras del proveedor contrastados con 1.7.7.
- TEACHER opera únicamente sobre grupos/estudiantes propios; ADMIN no adquiere permiso estudiantil por la documentación.
- Sesión opaca admitida donde corresponda; JWT aislado rechazado por las guardas existentes. Tokens de un uso no se confunden con sesión.
- Regresión de negocio sin cambios de expectativas. Un fallo no autoriza a modificar endpoints para ajustarlos al YAML.
- Recurso documental integrado responde 404 en producción/entorno no habilitado incluso con una sesión ADMIN sintética. Construir la app después de fijar el entorno, restaurándolo al terminar.

## 4. Arranque local para revisar la interfaz

Preparar `.env` local según README sobre una BD de desarrollo **desechable**, SMTP de pruebas y cuentas exclusivamente sintéticas. No publicar esa configuración. El arranque actual ejecuta bootstrap administrativo; no apuntarlo a una BD compartida para comprobar una UI.

```bash
NODE_ENV=development npm run dev
```

El script actual no fija `NODE_ENV`; sin el valor explícito los recursos documentales permanecen deshabilitados. No modificar globalmente la política del backend ni añadir defaults que habiliten documentación por accidente.

Reiniciar el proceso cuando se cambie `docs/api/openapi.yaml`: el router carga su contenido al construirse. El modo watch de Node no garantiza detectar cambios en YAML leído como archivo.

Con el puerto local por defecto:

```bash
curl --fail --silent --show-error http://localhost:3000/openapi.yaml
curl --fail --silent --show-error http://localhost:3000/docs
```

Esperado: 200 y contenido YAML/HTML correcto; el documento servido coincide con el archivo canónico. Los assets son `/docs/swagger-ui.css` y `/docs/swagger-ui-bundle.js`, servidos por el mismo origen.

## 5. Comprobación visual registrada

1. Abrir `http://localhost:3000/docs`; confirmar título, siete tags y 26 operaciones, sin Petstore ni futuros endpoints.
2. Desplegar al menos una operación de cada tag: Acceso, Cuentas, Invitaciones, CambiosCorreo, SolicitudesRol, Recuperacion y Estudiantes. Ver parámetros, cuerpo cuando aplique, éxitos/errores, esquemas, ejemplos y seguridad.
3. Comprobar que estudiantes son registros gestionados por profesores y que no aparecen login estudiantil, rutas de grupos o tareas.
4. En Network/Console, confirmar carga correcta del YAML y los dos assets; cero peticiones externas, errores de parseo, referencias rotas o requests `/api/*` al cargar/navegar.
5. Verificar que no hay “Try it out”, credenciales precargadas ni persistencia de autorización; la ayuda explica sesión persistida y limitaciones de cookies.
6. Registrar navegador/versión, fecha, resultado y captura sin datos reales. No agregar un framework E2E solo para esta comprobación; no declarar una prueba HTML como equivalente a render visual.

## 6. Producción y otros entornos

Usar preferentemente la matriz automatizada, que no requiere arrancar el bootstrap contra una BD productiva. Si se verifica por HTTP, iniciar una instancia local contra infraestructura sintética con `NODE_ENV=production`, y repetir para entorno ausente/staging tras reiniciar:

```bash
curl --silent --output /dev/null --write-out '%{http_code}\n' http://localhost:3000/docs
curl --silent --output /dev/null --write-out '%{http_code}\n' http://localhost:3000/openapi.yaml
curl --silent --output /dev/null --write-out '%{http_code}\n' http://localhost:3000/docs/swagger-ui.css
curl --silent --output /dev/null --write-out '%{http_code}\n' http://localhost:3000/docs/swagger-ui-bundle.js
```

Esperado: cuatro 404, sin contenido documental, con o sin sesión ADMIN de prueba. No probar contra el despliegue real ni enviar sus credenciales.

## 7. Mantenimiento y evidencia de entrega

Ante cambio de negocio autorizado en otra feature: contrastar montaje, guarda, parser/servicio y pruebas; actualizar inventario y YAML canónico; ejecutar comprobación documental, contratos pertinentes y revisión visual si cambia presentación. No copiar propuestas futuras al catálogo para completar el diseño.

El contenedor de esta ejecución se conserva detenido tras validar; `docker start kudlab-docs006-test` permite repetir pruebas usando la configuración local ignorada, previa comprobación del destino. No es infraestructura de despliegue ni BD compartida.

Registrar tres resultados separados: **documento/esquemas/ejemplos**, **HTTP/regresión con BD aislada** y **navegador** en [validation.md](validation.md). Reportar comandos, resultados y limitaciones; una prueba estática de HTML no demuestra render visual y una prueba no ejecutada nunca se marca como exitosa.
