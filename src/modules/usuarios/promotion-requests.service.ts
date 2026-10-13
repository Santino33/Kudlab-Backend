import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { adminRoleRequests, userAccounts } from '../../db/schema/accounts.js';
import { user } from '../../db/schema/auth.js';
import { AccountError } from './accounts.errors.js';
import { recordAudit } from './audit.service.js';
import { authRoleFor, type PromotionDecision } from './accounts.types.js';

export function presentRequest(row: typeof adminRoleRequests.$inferSelect) {
  return { id: row.id, requesterAccountId: row.requesterAccountId, status: row.status,
    requestedAt: row.requestedAt.toISOString(), ...(row.decidedByAccountId ? { decidedByAccountId: row.decidedByAccountId } : {}),
    ...(row.decidedAt ? { decidedAt: row.decidedAt.toISOString() } : {}) };
}
export async function submitRequest(requester: typeof userAccounts.$inferSelect, authUserId: string) {
  if (requester.status !== 'ACTIVA' || requester.role !== 'TEACHER') throw new AccountError(403, 'FORBIDDEN', 'Acceso denegado');
  const [row] = await db.transaction(async (tx) => {
    const [created] = await tx.insert(adminRoleRequests).values({ requesterAccountId: requester.id }).returning();
    await recordAudit(tx, requester.id, authUserId, 'REQUEST_ADMIN', { role: 'TEACHER' }, { role: 'TEACHER' });
    return [created!];
  });
  return presentRequest(row!);
}
export async function listRequests(actor: typeof userAccounts.$inferSelect) {
  const rows = await db.select().from(adminRoleRequests)
    .where(actor.role === 'ADMIN' ? eq(adminRoleRequests.status, 'PENDIENTE') : eq(adminRoleRequests.requesterAccountId, actor.id))
    .orderBy(desc(adminRoleRequests.requestedAt));
  return rows.map(presentRequest);
}
export async function decideRequest(id: string, actor: typeof userAccounts.$inferSelect, decision: PromotionDecision) {
  if (actor.role !== 'ADMIN') throw new AccountError(403, 'FORBIDDEN', 'Acceso denegado');
  return db.transaction(async (tx) => {
    const approve = decision === 'approve';
    const locked = await tx.execute(sql`select * from admin_role_requests where id = ${id} for update`);
    const existing = locked.rows[0] as { id: string; requester_account_id: string; status: string } | undefined;
    if (!existing) throw new AccountError(404, 'NOT_FOUND', 'Solicitud no encontrada');
    if (existing.status !== 'PENDIENTE') throw new AccountError(409, 'CONFLICT', 'Solicitud ya decidida');
    if (existing.requester_account_id === actor.id) throw new AccountError(403, 'FORBIDDEN', 'Acceso denegado');
    const [requester] = await tx.select().from(userAccounts).where(eq(userAccounts.id, existing.requester_account_id));
    if (!requester || requester.role !== 'TEACHER' || requester.status !== 'ACTIVA' || !requester.authUserId)
      throw new AccountError(409, 'CONFLICT', 'Solicitante sin elegibilidad vigente');
    if (approve) {
      const updatedIdentity = await tx.update(user).set({ role: authRoleFor('ADMIN') }).where(and(eq(user.id, requester.authUserId), eq(user.role, authRoleFor('TEACHER')))).returning({ id: user.id });
      if (updatedIdentity.length !== 1) throw new AccountError(409, 'CONFLICT', 'Identidad desincronizada');
      await tx.update(userAccounts).set({ role: 'ADMIN', updatedAt: new Date() }).where(eq(userAccounts.id, requester.id));
      await recordAudit(tx, requester.id, actor.authUserId!, 'ROLE_CHANGE', { role: 'TEACHER' }, { role: 'ADMIN' });
    }
    const [row] = await tx.update(adminRoleRequests).set({ status: approve ? 'APROBADA' : 'RECHAZADA',
      decidedByAccountId: actor.id, decidedAt: new Date() }).where(eq(adminRoleRequests.id, id)).returning();
    await recordAudit(tx, requester.id, actor.authUserId!, approve ? 'APPROVE_ADMIN' : 'REJECT_ADMIN',
      { role: 'TEACHER' }, { role: approve ? 'ADMIN' : 'TEACHER' });
    return presentRequest(row!);
  });
}
