import { Hono } from 'hono';
import type { AuthVariables } from '../../auth/session-guard.js';
import { fail } from './accounts.errors.js';
import { decideRequest, listRequests, submitRequest } from './promotion-requests.service.js';

export const promotionRoutes = new Hono<AuthVariables>();
promotionRoutes.get('/', async (c) => {
  try { return c.json(await listRequests(c.get('currentAccount'))); } catch (error) { return fail(c, error); }
});
promotionRoutes.post('/', async (c) => {
  try { return c.json(await submitRequest(c.get('currentAccount'), c.get('authUserId')), 201); }
  catch (error) { return fail(c, error); }
});
for (const decision of ['approve', 'reject'] as const) {
  promotionRoutes.post(`/:id/${decision}`, async (c) => {
    try { return c.json(await decideRequest(c.req.param('id'), c.get('currentAccount'), decision === 'approve')); }
    catch (error) { return fail(c, error); }
  });
}
