import { eq, asc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { auditEvents } from '../../db/schema/accounts.js';
import type { AccountRole, AccountStatus } from './accounts.types.js';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Snapshot = { name?: string; email?: string; role?: AccountRole; status?: AccountStatus };
type AuditAction = 'BOOTSTRAP_ADMIN' | 'INVITE' | 'ACTIVATE' | 'UPDATE' | 'REQUEST_ADMIN'
  | 'APPROVE_ADMIN' | 'REJECT_ADMIN' | 'ROLE_CHANGE' | 'DEACTIVATE' | 'REACTIVATE'
  | 'REQUEST_EMAIL_CHANGE' | 'CONFIRM_EMAIL_CHANGE' | 'PASSWORD_RESET';

export async function recordAudit(tx: Transaction, targetAccountId: string, actorAuthUserId: string, action: AuditAction, before?: Snapshot, after?: Snapshot) {
  await tx.insert(auditEvents).values({ targetAccountId, actorAuthUserId, action, before: before ?? null, after: after ?? null });
}

export async function listAudit(id: string) {
  const rows = await db.select().from(auditEvents).where(eq(auditEvents.targetAccountId, id)).orderBy(asc(auditEvents.occurredAt));
  return rows.map((event) => ({ actorId: event.actorAuthUserId, targetId: event.targetAccountId, action: event.action,
    occurredAt: event.occurredAt.toISOString(), ...(event.before ? { before: event.before } : {}), ...(event.after ? { after: event.after } : {}) }));
}
