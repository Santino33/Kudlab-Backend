import { Hono } from 'hono';
import { z } from 'zod';
import { confirmRecovery, requestRecovery } from './recovery.service.js';

export const recoveryRoutes = new Hono();

recoveryRoutes.post('/request', async (c) => {
  const { email } = z.strictObject({ email: z.email() }).parse(await c.req.json());
  await requestRecovery(email);
  return c.json({ message: 'Si corresponde, recibirás instrucciones en tu correo.' }, 202);
});

recoveryRoutes.post('/confirm', async (c) => {
  const { token, newPassword } = z.strictObject({ token: z.string().min(1), newPassword: z.unknown() })
    .parse(await c.req.json());
  return c.json(await confirmRecovery(token, newPassword));
});
