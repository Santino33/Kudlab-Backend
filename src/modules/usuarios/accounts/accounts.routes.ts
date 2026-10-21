import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthVariables } from '../../../auth/session-guard.js';
import { createAccount, getAccount, listAccounts, updateAccount } from './accounts.service.js';
import { listAudit } from '../shared/audit.service.js';
import { demote } from './roles.service.js';
import { changeAccountStatus } from './lifecycle.service.js';
import { ACCOUNT_STATUSES } from '../shared/accounts.types.js';

export const accountsRoutes = new Hono<AuthVariables>();
accountsRoutes.get('/', async (c) => {
  const q = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), offset: z.coerce.number().int().min(0).default(0),
    status: z.enum(ACCOUNT_STATUSES).optional() }).parse(c.req.query());
  return c.json(await listAccounts(q.limit, q.offset, q.status));
});
accountsRoutes.post('/', async (c) => c.json(await createAccount(await c.req.json(), c.get('authUserId')), 201));
accountsRoutes.get('/:id/audit', async (c) => {
  await getAccount(c.req.param('id'));
  return c.json(await listAudit(c.req.param('id')));
});
accountsRoutes.get('/:id', async (c) => c.json(await getAccount(c.req.param('id'))));
accountsRoutes.patch('/:id', async (c) => c.json(await updateAccount(c.req.param('id'), await c.req.json(), c.get('authUserId'))));
accountsRoutes.put('/:id/role', async (c) => {
  z.strictObject({ role: z.literal('TEACHER') }).parse(await c.req.json());
  return c.json(await demote(c.req.param('id'), c.get('authUserId')));
});
for (const action of ['deactivate', 'reactivate'] as const) {
  accountsRoutes.post(`/:id/${action}`, async (c) => {
    z.strictObject({ confirm: z.literal(true) }).parse(await c.req.json());
    return c.json(await changeAccountStatus(c.req.param('id'), c.get('authUserId'), action));
  });
}
