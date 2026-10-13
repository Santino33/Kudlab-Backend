import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { userAccounts } from '../../db/schema/accounts.js';
import { session, user } from '../../db/schema/auth.js';
import { AccountError } from './accounts.errors.js';
import { recordAudit } from './audit.service.js';
import { present } from './accounts.service.js';

export async function changeAccountStatus(id: string, actor: string, reactivate: boolean) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(713611032)`);
    const [target] = await tx.select().from(userAccounts).where(eq(userAccounts.id, id));
    if (!target) throw new AccountError(404, 'NOT_FOUND', 'Cuenta no encontrada');
    const previous = reactivate ? 'INACTIVA' : 'ACTIVA';
    const next = reactivate ? 'ACTIVA' : 'INACTIVA';
    if (target.status !== previous || !target.authUserId || !['ADMIN', 'TEACHER'].includes(target.role))
      throw new AccountError(409, 'CONFLICT', 'Estado no modificable');
    if (!reactivate && target.role === 'ADMIN') {
      const admins = await tx.select({ id: userAccounts.id }).from(userAccounts).where(sql`${userAccounts.role} = 'ADMIN' and ${userAccounts.status} = 'ACTIVA'`);
      if (admins.length <= 1) throw new AccountError(409, 'LAST_ADMIN', 'Debe quedar un administrador activo');
    }
    await tx.update(user).set({ banned: !reactivate }).where(eq(user.id, target.authUserId));
    // Delete persisted sessions in the same transaction; reactivation never recreates them.
    await tx.delete(session).where(eq(session.userId, target.authUserId));
    const [updated] = await tx.update(userAccounts).set({ status: next, updatedAt: new Date() }).where(eq(userAccounts.id, id)).returning();
    await recordAudit(tx, id, actor, reactivate ? 'REACTIVATE' : 'DEACTIVATE', { status: previous }, { status: next });
    return present(updated!);
  });
}
