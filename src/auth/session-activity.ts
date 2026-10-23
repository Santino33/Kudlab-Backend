import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { session, user } from '../db/schema/auth.js';
import { sessionActivity } from '../db/schema/authentication.js';
import { userAccounts } from '../db/schema/accounts.js';
import { hasActiveIdentity } from '../modules/usuarios/shared/accounts.types.js';

const INACTIVITY_MS = 30 * 60 * 1000;

export function isSessionExpired(lastAcceptedAt: Date, now: Date) {
  return now.getTime() >= lastAcceptedAt.getTime() + INACTIVITY_MS;
}

export function nextAcceptedAt(previous: Date, now: Date) {
  return new Date(Math.max(previous.getTime(), now.getTime()));
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function lockSession(tx: Transaction, id: string, userId: string) {
  const [current] = await tx.select().from(session).where(and(eq(session.id, id), eq(session.userId, userId))).for('update');
  return current;
}

async function sessionReference(tx: Transaction, id: string, createdAt: Date) {
  const [activity] = await tx.select().from(sessionActivity).where(eq(sessionActivity.sessionId, id));
  return activity?.lastAcceptedAt ?? createdAt;
}

export async function checkSessionActivity(id: string, userId: string) {
  return db.transaction(async (tx) => {
    const current = await lockSession(tx, id, userId);
    if (!current) return false;
    const now = new Date();
    const reference = await sessionReference(tx, id, current.createdAt);
    if (!isSessionExpired(reference, now)) return true;
    await tx.delete(session).where(eq(session.id, id));
    return false;
  });
}

export async function recordAcceptedRequest(id: string, userId: string) {
  return db.transaction((tx) => recordAcceptedRequestInTransaction(tx, id, userId, false));
}

// A consumer-owned transaction must roll back its business writes when this returns false.
export async function recordAcceptedRequestInTransaction(tx: Transaction, id: string, userId: string, strict = true) {
  const current = await lockSession(tx, id, userId);
  if (!current) return false;
  const now = new Date();
  if (strict && current.expiresAt.getTime() <= now.getTime()) return false;
  const reference = await sessionReference(tx, id, current.createdAt);
  if (isSessionExpired(reference, now)) {
    await tx.delete(session).where(eq(session.id, id));
    return false;
  }
  const [account] = await tx.select().from(userAccounts).where(eq(userAccounts.authUserId, userId)).limit(1);
  const [identity] = await tx.select({ role: user.role, banned: user.banned, email: user.email })
    .from(user).where(eq(user.id, userId)).limit(1);
  if (!identity || !hasActiveIdentity(account, identity) || account.emailNormalized !== identity.email.toLowerCase()) return false;
  await tx.insert(sessionActivity).values({ sessionId: id, lastAcceptedAt: now })
    .onConflictDoUpdate({ target: sessionActivity.sessionId,
      set: { lastAcceptedAt: sql`greatest(${sessionActivity.lastAcceptedAt}, ${now})` } });
  return true;
}
