import { eq, and, count, desc } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { invitations, userAccounts } from '../../db/schema/accounts.js';
import { AccountError } from './accounts.errors.js';
import { createAccountSchema, updateAccountSchema } from './accounts.validation.js';
import { recordAudit } from './audit.service.js';
import { deliverInvitation, issueInvitation } from './invitations.service.js';
import { user } from '../../db/schema/auth.js';
import { changeEmail } from './email-changes.service.js';

export function present(account: typeof userAccounts.$inferSelect, invitation?: typeof invitations.$inferSelect) {
  return { id: account.id, name: account.fullName, email: account.emailNormalized, role: account.role,
    status: account.status, createdAt: account.createdAt.toISOString(),
    ...(account.pendingEmailNormalized ? { pendingEmail: account.pendingEmailNormalized } : {}),
    ...(invitation ? { deliveryStatus: invitation.deliveryStatus, invitationExpiresAt: invitation.expiresAt.toISOString() } : {}) };
}
export async function getAccount(id: string) {
  const [account] = await db.select().from(userAccounts).where(eq(userAccounts.id, id));
  if (!account) throw new AccountError(404, 'NOT_FOUND', 'Cuenta no encontrada');
  const [invitation] = await db.select().from(invitations).where(eq(invitations.accountId, id)).orderBy(desc(invitations.createdAt)).limit(1);
  return present(account, invitation);
}
export async function listAccounts(limit: number, offset: number, status?: string) {
  const where = status ? eq(userAccounts.status, status) : undefined;
  const [totals, rows] = await Promise.all([
    db.select({ value: count() }).from(userAccounts).where(where),
    db.select().from(userAccounts).where(where).orderBy(desc(userAccounts.createdAt)).limit(limit).offset(offset),
  ]);
  return { items: await Promise.all(rows.map(async (account) => {
    const [invitation] = await db.select().from(invitations).where(eq(invitations.accountId, account.id)).orderBy(desc(invitations.createdAt)).limit(1);
    return present(account, invitation);
  })), total: totals[0]?.value ?? 0, limit, offset };
}
export async function createAccount(data: unknown, actor: string) {
  const input = createAccountSchema.parse(data);
  const { account, invitation, token } = await db.transaction(async (tx) => {
    const [account] = await tx.insert(userAccounts).values({ emailNormalized: input.email, fullName: input.name,
      role: 'TEACHER', status: 'PENDIENTE' }).returning();
    const issued = await issueInvitation(tx, account!.id, input.email, actor);
    await recordAudit(tx, account!.id, actor, 'INVITE', undefined, { name: input.name, email: input.email, role: 'TEACHER', status: 'PENDIENTE' });
    return { account: account!, ...issued };
  });
  await deliverInvitation(invitation.id, input.email, token);
  return getAccount(account.id);
}

export async function updateAccount(id: string, payload: unknown, actor: string) {
  const data = updateAccountSchema.parse(payload);
  const [account] = await db.select().from(userAccounts).where(eq(userAccounts.id, id));
  if (!account) throw new AccountError(404, 'NOT_FOUND', 'Cuenta no encontrada');
  if (data.email) {
    await changeEmail(account, data.email, actor, data.name);
    return getAccount(id);
  }
  if (data.name && data.name !== account.fullName) await db.transaction(async (tx) => {
    if (account.authUserId) await tx.update(user).set({ name: data.name }).where(eq(user.id, account.authUserId));
    await tx.update(userAccounts).set({ fullName: data.name!, updatedAt: new Date() }).where(eq(userAccounts.id, id));
    await recordAudit(tx, id, actor, 'UPDATE', { name: account.fullName }, { name: data.name });
  });
  return getAccount(id);
}
