import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from './auth/auth.js';
import { loadEnv } from './config/env.js';
import type { AuthVariables } from './auth/session-guard.js';
import { requireActive, requireAdmin } from './auth/session-guard.js';
import { accountsRoutes } from './modules/usuarios/accounts.routes.js';
import { invitationsRoutes } from './modules/usuarios/invitations.routes.js';
import { promotionRoutes } from './modules/usuarios/promotion-requests.routes.js';
import { emailChangeRoutes } from './modules/usuarios/email-changes.routes.js';
import { fail } from './modules/usuarios/accounts.errors.js';

export const app = new Hono<AuthVariables>();
const env = loadEnv();
app.use('/api/*', cors({ origin: env.SPA_ORIGIN, credentials: true, allowHeaders: ['Content-Type', 'Authorization'], exposeHeaders: ['set-auth-token'] }));
app.all('/api/auth/*', async (c) => {
  const path = c.req.path.slice('/api/auth'.length);
  const allowed = (c.req.method === 'POST' && ['/sign-in/email', '/sign-out'].includes(path)) ||
    (c.req.method === 'GET' && ['/get-session', '/jwks', '/token'].includes(path));
  if (!allowed)
    return c.json({ code: 'FORBIDDEN', message: 'Acceso denegado' }, 403);
  return auth.handler(c.req.raw);
});
app.use('/api/v1/accounts/*', requireActive);
app.use('/api/v1/accounts', requireActive);
app.use('/api/v1/accounts/*', requireAdmin);
app.use('/api/v1/accounts', requireAdmin);
app.route('/api/v1/accounts', accountsRoutes);
app.route('/api/v1/account-invitations', invitationsRoutes);
app.use('/api/v1/admin-role-requests', requireActive);
app.use('/api/v1/admin-role-requests/*', requireActive);
app.route('/api/v1/admin-role-requests', promotionRoutes);
app.route('/api/v1/account-email-changes', emailChangeRoutes);
app.onError((error, c) => fail(c, error));
