import { Hono } from 'hono';
import type { AuthVariables } from '../../../auth/session-guard.js';
import { loadEnv } from '../../../config/env.js';
import { academicActor } from '../../academico/shared/academic-auth.js';
import { forbidden } from '../../academico/shared/academic.errors.js';
import { observationFail, observationInvalid } from './observations.errors.js';
import { parseObservationQuery, readObservation } from './observations.validation.js';
import { createObservation, correctObservation, getObservationHistory, getObservationReceipt, getObservationRevisions } from './observations.service.js';

export function createObservationsRoutes() {
  const routes = new Hono<AuthVariables>();
  routes.onError((error, c) => observationFail(c, error));
  const base = '/api/v1/students/:id/observations';
  routes.get(base, async c => c.json(await getObservationHistory(academicActor(c), c.req.param('id'),
    parseObservationQuery(new URL(c.req.url).searchParams))));
  routes.post(base, async c => {
    if (c.req.header('Origin') !== loadEnv().SPA_ORIGIN) throw forbidden();
    if (new URL(c.req.url).searchParams.size) throw observationInvalid();
    const result = await createObservation(academicActor(c), c.req.param('id'), await readObservation(c.req.raw));
    return c.json(result, result.repeated ? 200 : 201);
  });
  routes.get(`${base}/:observationId/revisions`, async c => c.json(await getObservationRevisions(academicActor(c),
    c.req.param('id'), c.req.param('observationId'), parseObservationQuery(new URL(c.req.url).searchParams, true))));
  routes.post(`${base}/:observationId/revisions`, async c => {
    if (c.req.header('Origin') !== loadEnv().SPA_ORIGIN) throw forbidden();
    if (new URL(c.req.url).searchParams.size) throw observationInvalid();
    const result = await correctObservation(academicActor(c), c.req.param('id'), c.req.param('observationId'), await readObservation(c.req.raw, true));
    return c.json(result, result.repeated ? 200 : 201);
  });
  routes.get('/api/v1/students/:id/observation-requests/:requestId', async c => {
    if (new URL(c.req.url).searchParams.size) throw observationInvalid();
    return c.json(await getObservationReceipt(academicActor(c), c.req.param('id'), c.req.param('requestId')));
  });
  return routes;
}
