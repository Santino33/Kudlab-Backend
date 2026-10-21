import type { Context, Next } from 'hono';
import { auth } from './auth.js';
import { userAccounts } from '../db/schema/accounts.js';
import type { InferSelectModel } from 'drizzle-orm';
import { authorizeScope, type AssignmentProvider, type ScopeDecision, type ScopeRequest } from '../modules/usuarios/shared/scope-authorization.js';
import { resolveActiveIdentity } from './active-identity.js';
import { checkSessionActivity, recordAcceptedRequest } from './session-activity.js';

export type CurrentAccount = InferSelectModel<typeof userAccounts>;
export type AuthVariables = { Variables: { currentAccount: CurrentAccount; authUserId: string } };

export async function requireActive(c: Context<AuthVariables>, next: Next) {
  // getSession validates an opaque, persisted session; a signed JWT alone cannot pass.
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user || !session.session) return c.json({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' }, 401);
  const active = await resolveActiveIdentity(session.user.id);
  if (!active)
    return c.json({ code: 'FORBIDDEN', message: 'Acceso denegado' }, 403);
  if (!await checkSessionActivity(session.session.id, session.user.id))
    return c.json({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' }, 401);
  c.set('currentAccount', active.account);
  c.set('authUserId', session.user.id);
  await next();
  if (c.res.status >= 200 && c.res.status < 300 &&
    !await recordAcceptedRequest(session.session.id, session.user.id))
    return c.json({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' }, 401);
}

export async function requireAdmin(c: Context<AuthVariables>, next: Next) {
  if (c.get('currentAccount').role !== 'ADMIN') return c.json({ code: 'FORBIDDEN', message: 'Acceso denegado' }, 403);
  await next();
}

// Called by an Academic route after requireActive and immediately before accessing
// protected student/group data. There is no implicit assignment provider.
export async function authorizeProtectedScope(
  c: Context<AuthVariables>, request: ScopeRequest, provider?: AssignmentProvider,
): Promise<ScopeDecision> {
  const authenticated = c.get('currentAccount');
  if (!authenticated || !provider) return { allowed: false };
  try {
    const active = await resolveActiveIdentity(c.get('authUserId'));
    if (!active || active.account.id !== authenticated.id)
      return { allowed: false };
    return authorizeScope(active.account, request, provider);
  } catch {
    return { allowed: false };
  }
}
