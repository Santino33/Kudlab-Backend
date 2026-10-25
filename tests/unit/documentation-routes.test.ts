import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';
import { createDocumentationRoutes } from '../../src/docs/documentation.routes.js';

vi.mock('node:fs', async (original) => {
  const fs = await original<typeof import('node:fs')>();
  return { ...fs, readFileSync: vi.fn(fs.readFileSync) };
});
afterEach(() => vi.unstubAllEnvs());
const paths = ['/docs', '/openapi.yaml', '/docs/swagger-ui.css', '/docs/swagger-ui-bundle.js'];

it('resuelve contrato y assets desde el módulo, incluso fuera del directorio de trabajo', () => {
  const moduleURL = new URL('../../src/docs/documentation.routes.ts', import.meta.url).href;
  const loader = createRequire(import.meta.url).resolve('tsx');
  const result = execFileSync(process.execPath, ['--import', loader, '--input-type=module', '-e', `
    const {createDocumentationRoutes}=await import(${JSON.stringify(moduleURL)});
    const app=createDocumentationRoutes('development');
    const statuses=[];
    for(const path of ${JSON.stringify(paths)}) {const response=await app.request(path);statuses.push(response.status);await response.text();}
    console.log(JSON.stringify(statuses));
  `], { cwd: new URL('../../node_modules/', import.meta.url), encoding: 'utf8', timeout: 10000 });
  expect(JSON.parse(result)).toEqual([200, 200, 200, 200]);
});

it.each(['development', 'test'])('publica solo recursos locales en %s sin sesión', async (env) => {
  const router = createDocumentationRoutes(env);
  const html = await router.request('/docs');
  expect(html.status).toBe(200);
  expect(html.headers.get('content-type')).toContain('text/html');
  const page = await html.text();
  for (const config of ["url: '/openapi.yaml'", 'supportedSubmitMethods: []', 'persistAuthorization: false', 'queryConfigEnabled: false', "validatorUrl: 'none'"])
    expect(page).toContain(config);
  expect(page).not.toMatch(/https?:\/\/|petstore|preauthorize|requestInterceptor|localStorage/i);
  const yaml = await router.request('/openapi.yaml');
  expect(yaml.headers.get('content-type')).toContain('application/yaml');
  expect(await yaml.text()).toBe(readFileSync(new URL('../../docs/api/openapi.yaml', import.meta.url), 'utf8'));
  for (const path of paths.slice(2)) {
    const res = await router.request(path);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/css|javascript/);
    expect((await res.text()).length).toBeGreaterThan(1000);
  }
  for (const path of ['/docs/index.html', '/docs/.env', '/docs/package.json', '/docs/swagger-ui-bundle.js.map', '/docs/%2e%2e/package.json'])
    expect((await router.request(path)).status).toBe(404);
  expect((await router.request('/openapi.yaml', { method: 'POST' })).status).toBe(404);
});

it.each(['production', 'staging', '', undefined])('no registra rutas ni lee archivos en entorno %s', async (env) => {
  vi.stubEnv('NODE_ENV', env);
  vi.mocked(readFileSync).mockClear();
  const router = createDocumentationRoutes();
  expect(router.routes).toHaveLength(0);
  expect(readFileSync).not.toHaveBeenCalled();
  for (const path of paths) expect((await router.request(path)).status).toBe(404);
});
