import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { login, reset } from '../helpers.js';

beforeEach(reset);
afterEach(() => vi.unstubAllEnvs());

it.each(['development', 'test', 'production', 'staging', '', undefined])('montaje real de documentación en %s, independiente de ADMIN', async (env) => {
  const admin = await login();
  vi.stubEnv('NODE_ENV', env);
  vi.stubEnv('MAIL_MODE', 'smtp');
  for (const key of ['MAIL_HOST', 'MAIL_USER', 'MAIL_PASSWORD']) vi.stubEnv(key, 'synthetic');
  vi.stubEnv('MAIL_FROM', 'no-send@ejemplo.edu.co');
  vi.resetModules();
  const { app } = await import('../../src/app.js');
  const { pool } = await import('../../src/db/client.js');
  try {
    const expected = env === 'development' || env === 'test' ? 200 : 404;
    for (const headers of [{}, admin]) for (const path of ['/docs', '/openapi.yaml', '/docs/swagger-ui.css', '/docs/swagger-ui-bundle.js']) {
      const response = await app.request(path, { headers });
      expect(response.status, `${env} ${path}`).toBe(expected);
      const text = await response.text();
      if (expected === 404) expect(text).not.toMatch(/SwaggerUIBundle|openapi:|swagger-ui/);
    }
  } finally { await pool.end(); }
});
