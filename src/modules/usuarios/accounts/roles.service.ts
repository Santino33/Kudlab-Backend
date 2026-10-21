import { eq, sql } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { userAccounts } from '../../../db/schema/accounts.js';
import { user } from '../../../db/schema/auth.js';
import { AccountError } from '../shared/accounts.errors.js';
import { recordAudit } from '../shared/audit.service.js';
import { present } from './accounts.service.js';
import { authRoleFor } from '../shared/accounts.types.js';

export async function demote(id: string, actor: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(713611032)`);
    const [target] = await tx.select().from(userAccounts).where(eq(userAccounts.id, id));
    if (!target) throw new AccountError(404, 'NOT_FOUND', 'Cuenta no encontrada');
    const isActiveAdmin = target.role === 'ADMIN' && target.status === 'ACTIVA';
    if (!isActiveAdmin || !target.authUserId)
      throw new AccountError(409, 'CONFLICT', 'Rol no modificable');

    const active = await tx.select({ id: userAccounts.id }).from(userAccounts).where(sql`${userAccounts.role} = 'ADMIN' and ${userAccounts.status} = 'ACTIVA'`);
    if (active.length <= 1) throw new AccountError(409, 'LAST_ADMIN', 'Debe quedar un administrador activo');

    const updatedIdentity = await tx.update(user).set({ role: authRoleFor('TEACHER') })
      .where(sql`${user.id} = ${target.authUserId} and ${user.role} = ${authRoleFor('ADMIN')}`).returning({ id: user.id });
    if (updatedIdentity.length !== 1) throw new AccountError(409, 'CONFLICT', 'Identidad desincronizada');
    const [changed] = await tx.update(userAccounts).set({ role: 'TEACHER', updatedAt: new Date() }).where(eq(userAccounts.id, id)).returning();
    await recordAudit(tx, id, actor, 'ROLE_CHANGE', { role: 'ADMIN' }, { role: 'TEACHER' });
    return present(changed!);
  });
}
