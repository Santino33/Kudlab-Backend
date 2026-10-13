import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthVariables } from '../../auth/session-guard.js';
import { fail } from './accounts.errors.js';
import { createAccount, getAccount, listAccounts, updateAccount } from './accounts.service.js';
import { listAudit } from './audit.service.js';
import { demote } from './roles.service.js';
import { changeAccountStatus } from './lifecycle.service.js';

export const accountsRoutes = new Hono<AuthVariables>();
accountsRoutes.get('/', async (c) => {
  try {
    const q = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20), offset: z.coerce.number().int().min(0).default(0),
      status: z.enum(['PENDIENTE', 'ACTIVA', 'INACTIVA']).optional() }).parse(c.req.query());
    return c.json(await listAccounts(q.limit, q.offset, q.status));
  } catch (error) { return fail(c, error); }
});
accountsRoutes.post('/', async (c) => {
  try { return c.json(await createAccount(await c.req.json(), c.get('authUserId')), 201); }
  catch (error) { return fail(c, error); }
});
accountsRoutes.get('/:id/audit', async (c) => {
  try { await getAccount(c.req.param('id')); return c.json(await listAudit(c.req.param('id'))); }
  catch (error) { return fail(c, error); }
});
accountsRoutes.get('/:id', async (c) => {
  try { return c.json(await getAccount(c.req.param('id'))); }
  catch (error) { return fail(c, error); }
});
accountsRoutes.patch('/:id', async (c) => {
  try { return c.json(await updateAccount(c.req.param('id'), await c.req.json(), c.get('authUserId'))); }
  catch (error) { return fail(c, error); }
});
accountsRoutes.put('/:id/role', async (c) => {
  try {
    z.strictObject({ role: z.literal('TEACHER') }).parse(await c.req.json());
    return c.json(await demote(c.req.param('id'), c.get('authUserId')));
  } catch (error) { return fail(c, error); }
});
for (const action of ['deactivate', 'reactivate'] as const) {
  accountsRoutes.post(`/:id/${action}`, async (c) => {
    try {
      z.strictObject({ confirm: z.literal(true) }).parse(await c.req.json());
      return c.json(await changeAccountStatus(c.req.param('id'), c.get('authUserId'), action === 'reactivate'));
    } catch (error) { return fail(c, error); }
  });
}
