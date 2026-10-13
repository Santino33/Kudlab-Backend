import { Hono } from 'hono';
import { z } from 'zod';
import { acceptInvitation } from './invitations.service.js';

export const invitationsRoutes = new Hono();
invitationsRoutes.post('/accept', async (c) => {
  const input = z.strictObject({ token: z.string().min(1), password: z.unknown() }).parse(await c.req.json());
  return c.json(await acceptInvitation(input.token, input.password));
});
