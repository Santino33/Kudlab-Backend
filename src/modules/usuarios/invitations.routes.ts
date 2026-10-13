import { Hono } from 'hono';
import { z } from 'zod';
import { fail } from './accounts.errors.js';
import { acceptInvitation } from './invitations.service.js';

export const invitationsRoutes = new Hono();
invitationsRoutes.post('/accept', async (c) => {
  try {
    const input = z.strictObject({ token: z.string().min(1), password: z.string() }).parse(await c.req.json());
    return c.json(await acceptInvitation(input.token, input.password));
  } catch (error) { return fail(c, error); }
});
