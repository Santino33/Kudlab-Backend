import type { Context, Next } from 'hono';
import { eq } from 'drizzle-orm';
import { auth } from './auth.js';
import { db } from '../db/client.js';
import { userAccounts } from '../db/schema/accounts.js';
import { user } from '../db/schema/auth.js';
import type { InferSelectModel } from 'drizzle-orm';
import { hasActiveIdentity } from '../modules/usuarios/accounts.types.js';
import { authorizeScope, type AssignmentProvider, type ScopeDecision, type ScopeRequest } from '../modules/usuarios/scope-authorization.js';

export type CurrentAccount = InferSelectModel<typeof userAccounts>;
export type AuthVariables = { Variables: { currentAccount: CurrentAccount; authUserId: string } };

export async function requireActive(c: Context<AuthVariables>, next: Next) {
  // getSession validates an opaque, persisted session; a signed JWT alone cannot pass.
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user || !session.session) return c.json({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' }, 401);
  const [account] = await db.select().from(userAccounts).where(eq(userAccounts.authUserId, session.user.id)).limit(1);
  const [identity] = await db.select({ role: user.role, banned: user.banned }).from(user).where(eq(user.id, session.user.id));
  if (!hasActiveIdentity(account, identity))
    return c.json({ code: 'FORBIDDEN', message: 'Acceso denegado' }, 403);
  c.set('currentAccount', account);
  c.set('authUserId', session.user.id);
  await next();
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
    const [account] = await db.select().from(userAccounts).where(eq(userAccounts.id, authenticated.id)).limit(1);
    const [identity] = account?.authUserId
      ? await db.select({ role: user.role, banned: user.banned }).from(user).where(eq(user.id, account.authUserId))
      : [];
    if (!account || account.authUserId !== c.get('authUserId') || !hasActiveIdentity(account, identity))
      return { allowed: false };
    return authorizeScope(account, request, provider);
  } catch {
    return { allowed: false };
  }
}
