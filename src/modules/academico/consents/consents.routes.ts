import { Hono } from 'hono';
import type { AuthVariables } from '../../../auth/session-guard.js';
import { loadEnv } from '../../../config/env.js';
import { academicActor } from '../shared/academic-auth.js';
import { forbidden } from '../shared/academic.errors.js';
import { ConsentError, consentFail } from './consents.errors.js';
import { consentDependencies, getConsentDocument, getConsentHistory, getConsentOperation,
  getConsentSnapshot, registerConsent, type ConsentDependencies } from './consents.service.js';

export function createConsentsRoutes(injected?: ConsentDependencies) {
  const routes = new Hono<AuthVariables>();
  let dependencies = injected;
  const deps = () => dependencies ??= consentDependencies();
  routes.onError((error, c) => consentFail(c, error));
  routes.use('/:id/consents', async (c, next) => {
    if (new URL(c.req.url).searchParams.size) throw new ConsentError(400, 'INVALID_INPUT');
    if (c.req.method === 'POST' && c.req.header('Origin') !== loadEnv().SPA_ORIGIN) throw forbidden();
    await next();
  });
  routes.use('/:id/consents/*', async (c, next) => {
    const params = new URL(c.req.url).searchParams;
    const history = c.req.method === 'GET' && c.req.path.endsWith('/consents/history');
    if ([...params.keys()].some(key => !history || key !== 'cursor') || params.getAll('cursor').length > 1)
      throw new ConsentError(400, 'INVALID_INPUT');
    await next();
  });
  routes.get('/:id/consents', async c => c.json(await getConsentSnapshot(academicActor(c), c.req.param('id'))));
  routes.post('/:id/consents', async c => {
    if (!c.req.header('Content-Type')?.toLowerCase().startsWith('multipart/form-data;')) throw new ConsentError(415, 'INVALID_INPUT');
    const result = await registerConsent(academicActor(c), c.req.param('id'), c.req.raw, deps());
    return c.json(result, result.acknowledgement.repeated ? 200 : 201);
  });
  routes.get('/:id/consents/history', async c => c.json(await getConsentHistory(academicActor(c), c.req.param('id'), c.req.query('cursor'))));
  routes.get('/:id/consents/operations/:requestId', async c => c.json(await getConsentOperation(academicActor(c), c.req.param('id'), c.req.param('requestId'))));
  routes.get('/:id/consents/:recordId/document', async c => {
    const result = await getConsentDocument(academicActor(c), c.req.param('id'), c.req.param('recordId'), deps(), c.req.raw.signal);
    const extension = result.mediaType === 'application/pdf' ? 'pdf' : result.mediaType === 'image/png' ? 'png' : 'jpg';
    c.header('Cache-Control', 'private, no-store');
    return new Response(new Uint8Array(result.bytes), { headers: {
      'Content-Type': result.mediaType, 'Content-Length': String(result.bytes.length),
      'Content-Disposition': `attachment; filename="consentimiento-${result.recordId}.${extension}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } });
  });
  return routes;
}
