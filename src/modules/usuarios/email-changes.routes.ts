import { Hono } from 'hono';
import { z } from 'zod';
import { confirmEmailChange } from './email-changes.service.js';

export const emailChangeRoutes = new Hono();
emailChangeRoutes.post('/confirm', async (c) => {
  const { token } = z.strictObject({ token: z.string().min(1) }).parse(await c.req.json());
  return c.json(await confirmEmailChange(token));
});
