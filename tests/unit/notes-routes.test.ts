import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createNotesRoutes } from '../../src/modules/academico/notes/notes.routes.js';

const id = '11111111-1111-4111-8111-111111111111';

describe('notas · router propio (CA-08)', () => {
  const app = new Hono();
  app.get('/api/v1/other', (c) => c.json({ ok: true }));
  app.route('/', createNotesRoutes());

  it.each([
    ['GET', `/api/v1/students/${id}/academic-notes?year=2026`],
    ['POST', `/api/v1/students/${id}/academic-notes?x=1`],
    ['PATCH', `/api/v1/students/${id}/academic-notes/${id}?x=1`],
  ])('rechaza cualquier consulta en %s %s con 400 INVALID_INPUT', async (method, path) => {
    const response = await app.request(path, { method, body: method === 'GET' ? undefined : '{}' });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('no altera rutas ajenas: la comprobación de consulta es local', async () => {
    const response = await app.request('/api/v1/other?x=1');
    expect(response.status).toBe(200);
  });
});
