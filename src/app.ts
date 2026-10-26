import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { auth } from './auth/auth.js';
import { loadEnv } from './config/env.js';
import type { AuthVariables } from './auth/session-guard.js';
import { requireActive, requireAdmin } from './auth/session-guard.js';
import { accountsRoutes } from './modules/usuarios/accounts/accounts.routes.js';
import { invitationsRoutes } from './modules/usuarios/invitations/invitations.routes.js';
import { promotionRoutes } from './modules/usuarios/promotion-requests/promotion-requests.routes.js';
import { emailChangeRoutes } from './modules/usuarios/email-changes/email-changes.routes.js';
import { recoveryRoutes } from './modules/usuarios/recovery/recovery.routes.js';
import { fail } from './modules/usuarios/shared/accounts.errors.js';
import { resolveActiveIdentity } from './auth/active-identity.js';
import { checkSessionActivity } from './auth/session-activity.js';
import { z } from 'zod';
import { studentsRoutes } from './modules/academico/students/students.routes.js';
import { requireTeacher } from './modules/academico/shared/academic-auth.js';
import { createDocumentationRoutes } from './docs/documentation.routes.js';

export const app = new Hono<AuthVariables>();
const env = loadEnv();
app.use('/api/*', cors({ origin: env.SPA_ORIGIN, credentials: true, allowHeaders: ['Content-Type', 'Authorization'], exposeHeaders: ['set-auth-token'] }));
const signInInput = z.strictObject({ email: z.email(), password: z.string().min(1), rememberMe: z.boolean().optional() });
const invalidCredentials = (c: Parameters<typeof fail>[0]) => c.json({ code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' }, 401);
app.all('/api/auth/*', async (c) => {
  const path = c.req.path.slice('/api/auth'.length);
  const allowed = (c.req.method === 'POST' && ['/sign-in/email', '/sign-out'].includes(path)) ||
    (c.req.method === 'GET' && ['/get-session', '/jwks', '/token'].includes(path));
  if (!allowed)
    return c.json({ code: 'FORBIDDEN', message: 'Acceso denegado' }, 403);
  if (c.req.method === 'POST' && path === '/sign-in/email') {
    const parsed = signInInput.safeParse(await c.req.raw.clone().json().catch(() => null));
    if (!parsed.success) return c.json({ code: 'INVALID_INPUT', message: 'Solicitud inválida' }, 400);
    try {
      const response = await auth.handler(c.req.raw);
      if (!response.ok) return response.status >= 500
        ? c.json({ code: 'UNAVAILABLE', message: 'Operación no confirmada' }, 503)
        : invalidCredentials(c);
      const body = await response.json() as { user?: { id?: string } };
      const active = body.user?.id && await resolveActiveIdentity(body.user.id);
      if (!active) return invalidCredentials(c);
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      return new Response(JSON.stringify({ user: { id: active.identity.id, email: active.identity.email,
        name: active.identity.name, role: active.account.role } }), { status: 200, headers });
    } catch { return c.json({ code: 'UNAVAILABLE', message: 'Operación no confirmada' }, 503); }
  }
  if (c.req.method === 'GET' && path === '/get-session') {
    try {
      const current = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!current?.user || !current.session) return c.json({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' }, 401);
      const active = await resolveActiveIdentity(current.user.id);
      if (!active) return c.json({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' }, 401);
      if (!await checkSessionActivity(current.session.id, current.user.id))
        return c.json({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' }, 401);
      return c.json({ user: { id: active.identity.id, email: active.identity.email, name: active.identity.name,
        role: active.account.role }, session: { id: current.session.id, expiresAt: current.session.expiresAt } });
    } catch { return c.json({ code: 'UNAVAILABLE', message: 'Operación no confirmada' }, 503); }
  }
  if (c.req.method === 'POST' && path === '/sign-out') {
    try {
      const current = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!current?.user || !current.session || !await checkSessionActivity(current.session.id, current.user.id))
        return c.json({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' }, 401);
      // Better Auth 1.7.7 requires a JSON body even though sign-out has no input.
      const headers = new Headers(c.req.raw.headers);
      headers.set('content-type', 'application/json');
      headers.delete('content-length');
      return auth.handler(new Request(c.req.raw.url, { method: 'POST', headers, body: '{}' }));
    } catch { return c.json({ code: 'UNAVAILABLE', message: 'Operación no confirmada' }, 503); }
  }
  if (c.req.method === 'GET' && path === '/token') {
    try {
      const current = await auth.api.getSession({ headers: c.req.raw.headers });
      if (!current?.user || !current.session || !await resolveActiveIdentity(current.user.id) ||
        !await checkSessionActivity(current.session.id, current.user.id))
        return c.json({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' }, 401);
    } catch { return c.json({ code: 'UNAVAILABLE', message: 'Operación no confirmada' }, 503); }
  }
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
app.route('/api/v1/auth/password-recovery', recoveryRoutes);
app.use('/api/v1/students', requireTeacher);
app.use('/api/v1/students/*', requireTeacher);
app.route('/api/v1/students', studentsRoutes);
app.route('/', createDocumentationRoutes());
app.onError((error, c) => fail(c, error));
