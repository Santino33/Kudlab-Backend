import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';

export function createDocumentationRoutes(environment = process.env.NODE_ENV) {
  const routes = new Hono();
  if (environment !== 'development' && environment !== 'test') return routes;

  const spec = readFileSync(new URL('../../docs/api/openapi.yaml', import.meta.url), 'utf8');
  const require = createRequire(import.meta.url);
  routes.get('/openapi.yaml', (c) => c.body(spec, 200, { 'Content-Type': 'application/yaml; charset=UTF-8' }));
  routes.get('/docs/swagger-ui.css', serveStatic({ path: require.resolve('swagger-ui-dist/swagger-ui.css') }));
  routes.get('/docs/swagger-ui-bundle.js', serveStatic({ path: require.resolve('swagger-ui-dist/swagger-ui-bundle.js') }));
  routes.get('/docs', (c) => c.html(`<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Kudlab — documentación API</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="/docs/swagger-ui.css">
</head>
<body>
  <aside style="padding:1rem;font-family:system-ui">
    <strong>Documentación de consulta — solo desarrollo/pruebas.</strong>
    Los profesores gestionan registros de estudiantes; los estudiantes no acceden a este backend.
    Los clientes usan cookie HttpOnly o Bearer opaco de sesión persistida: el JWT de interoperabilidad no la sustituye.
    El navegador no permite fijar libremente Cookie ni leer cookies HttpOnly; no cambie CORS o permisos para sortearlo.
    Todos los ejemplos son ficticios y no operativos. No se ejecutan operaciones desde esta interfaz.
  </aside>
  <div id="swagger-ui"></div>
  <script src="/docs/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.yaml',
      dom_id: '#swagger-ui',
      supportedSubmitMethods: [],
      persistAuthorization: false,
      queryConfigEnabled: false,
      validatorUrl: 'none'
    });
  </script>
</body>
</html>`));
  return routes;
}
