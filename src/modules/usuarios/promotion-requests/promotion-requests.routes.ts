import { Hono } from 'hono';
import type { AuthVariables } from '../../../auth/session-guard.js';
import { decideRequest, listRequests, submitRequest } from './promotion-requests.service.js';

export const promotionRoutes = new Hono<AuthVariables>();
promotionRoutes.get('/', async (c) => c.json(await listRequests(c.get('currentAccount'))));
promotionRoutes.post('/', async (c) => c.json(await submitRequest(c.get('currentAccount'), c.get('authUserId')), 201));
for (const decision of ['approve', 'reject'] as const) {
  promotionRoutes.post(`/:id/${decision}`, async (c) =>
    c.json(await decideRequest(c.req.param('id'), c.get('currentAccount'), decision)));
}
