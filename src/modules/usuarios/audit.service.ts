import { eq, asc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { auditEvents } from '../../db/schema/accounts.js';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Snapshot = { name?: string; email?: string; role?: string; status?: string };

export async function recordAudit(tx: Transaction, targetAccountId: string, actorAuthUserId: string, action: string, before?: Snapshot, after?: Snapshot) {
  await tx.insert(auditEvents).values({ targetAccountId, actorAuthUserId, action, before: before ?? null, after: after ?? null });
}

export async function listAudit(id: string) {
  const rows = await db.select().from(auditEvents).where(eq(auditEvents.targetAccountId, id)).orderBy(asc(auditEvents.occurredAt));
  return rows.map((event) => ({ actorId: event.actorAuthUserId, targetId: event.targetAccountId, action: event.action,
    occurredAt: event.occurredAt.toISOString(), ...(event.before ? { before: event.before } : {}), ...(event.after ? { after: event.after } : {}) }));
}
