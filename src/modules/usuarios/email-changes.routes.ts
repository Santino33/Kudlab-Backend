import { Hono } from 'hono';
import { z } from 'zod';
import { fail } from './accounts.errors.js';
import { confirmEmailChange } from './email-changes.service.js';

export const emailChangeRoutes = new Hono();
emailChangeRoutes.post('/confirm', async (c) => {
  try {
    const { token } = z.strictObject({ token: z.string().min(1) }).parse(await c.req.json());
    return c.json(await confirmEmailChange(token));
  } catch (error) { return fail(c, error); }
});
