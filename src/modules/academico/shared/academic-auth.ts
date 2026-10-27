import type { Context, Next } from 'hono';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { userAccounts } from '../../../db/schema/accounts.js';
import { user, session } from '../../../db/schema/auth.js';
import { hasActiveIdentity } from '../../usuarios/shared/accounts.types.js';
import { prepareActive, type AuthVariables } from '../../../auth/session-guard.js';
import { recordAcceptedRequestInTransaction } from '../../../auth/session-activity.js';
import { academicFail, forbidden, unauthenticated } from './academic.errors.js';

export type AcademicActor = { accountId: string; authUserId: string; sessionId: string };
export type AcademicTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function requireTeacher(c: Context<AuthVariables>, next: Next) {
  try {
    const prepared = await prepareActive(c);
    if (typeof prepared !== 'string') return prepared;
    if (c.get('currentAccount').role !== 'TEACHER') throw forbidden();
    await next();
  } catch (error) { return academicFail(c, error); }
}

export function academicActor(c: Context<AuthVariables>): AcademicActor {
  return { accountId: c.get('currentAccount').id, authUserId: c.get('authUserId'), sessionId: c.get('sessionId') };
}

export async function withAcademicAccess<T>(actor: AcademicActor, operation: (tx: AcademicTransaction) => Promise<T>, role: 'TEACHER' | 'ADMIN' = 'TEACHER'): Promise<T> {
  return db.transaction(async (tx) => {
    // NOWAIT prevents lock inversion with existing identity-first account lifecycle operations.
    const [account] = await tx.select().from(userAccounts).where(eq(userAccounts.id, actor.accountId))
      .for('share');
    const [identity] = await tx.select().from(user).where(eq(user.id, actor.authUserId)).for('share', { noWait: true });
    if (!account || account.authUserId !== actor.authUserId || account.role !== role ||
      !hasActiveIdentity(account, identity) || account.emailNormalized !== identity?.email.toLowerCase()) throw forbidden();
    const [current] = await tx.select().from(session).where(and(eq(session.id, actor.sessionId), eq(session.userId, actor.authUserId)))
      .for('update');
    if (!current || current.expiresAt.getTime() <= Date.now()) throw unauthenticated();
    const result = await operation(tx);
    if (!await recordAcceptedRequestInTransaction(tx, actor.sessionId, actor.authUserId)) throw unauthenticated();
    return result;
  });
}
