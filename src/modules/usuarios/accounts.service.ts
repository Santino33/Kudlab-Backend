import { eq, count, desc, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { invitations, userAccounts } from '../../db/schema/accounts.js';
import { AccountError, parseProfileInput } from './accounts.errors.js';
import { createAccountSchema, updateAccountSchema } from './accounts.validation.js';
import { recordAudit } from './audit.service.js';
import { deliverInvitation, issueInvitation } from './invitations.service.js';
import { user } from '../../db/schema/auth.js';
import { changeEmail } from './email-changes.service.js';
import { lockAccount } from './account-lock.js';

export function present(account: typeof userAccounts.$inferSelect,
  invitation?: Pick<typeof invitations.$inferSelect, 'deliveryStatus' | 'expiresAt'>) {
  return { id: account.id, name: account.fullName, email: account.emailNormalized, role: account.role,
    status: account.status, createdAt: account.createdAt.toISOString(),
    ...(account.pendingEmailNormalized ? { pendingEmail: account.pendingEmailNormalized } : {}),
    ...(invitation ? { deliveryStatus: invitation.deliveryStatus, invitationExpiresAt: invitation.expiresAt.toISOString() } : {}) };
}
export async function getAccount(id: string) {
  const [account] = await db.select().from(userAccounts).where(eq(userAccounts.id, id));
  if (!account) throw new AccountError(404, 'NOT_FOUND', 'Cuenta no encontrada');
  const [invitation] = await db.select().from(invitations).where(eq(invitations.accountId, id))
    .orderBy(desc(invitations.createdAt), desc(invitations.id)).limit(1);
  return present(account, invitation);
}
export async function listAccounts(limit: number, offset: number, status?: string) {
  const where = status ? eq(userAccounts.status, status) : undefined;
  const latestInvitation = db.select({ deliveryStatus: invitations.deliveryStatus, expiresAt: invitations.expiresAt }).from(invitations)
    .where(eq(invitations.accountId, userAccounts.id))
    .orderBy(desc(invitations.createdAt), desc(invitations.id)).limit(1).as('latest_invitation');
  const [totals, rows] = await Promise.all([
    db.select({ value: count() }).from(userAccounts).where(where),
    db.select({ account: userAccounts, invitationDeliveryStatus: latestInvitation.deliveryStatus,
      invitationExpiresAt: latestInvitation.expiresAt }).from(userAccounts)
      .leftJoinLateral(latestInvitation, sql`true`).where(where)
      .orderBy(desc(userAccounts.createdAt), desc(userAccounts.id)).limit(limit).offset(offset),
  ]);
  return { items: rows.map(({ account, invitationDeliveryStatus, invitationExpiresAt }) =>
    present(account, invitationDeliveryStatus && invitationExpiresAt
      ? { deliveryStatus: invitationDeliveryStatus, expiresAt: invitationExpiresAt } : undefined)),
    total: totals[0]?.value ?? 0, limit, offset };
}
export async function createAccount(data: unknown, actor: string) {
  const input = parseProfileInput(createAccountSchema, data);
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
  const data = parseProfileInput(updateAccountSchema, payload);
  if (data.email) {
    await changeEmail(id, data.email, actor, data.name);
    return getAccount(id);
  }
  await db.transaction(async (tx) => {
    const account = await lockAccount(tx, id);
    if (data.name && data.name !== account.fullName) {
      if (account.authUserId) {
        const updated = await tx.update(user).set({ name: data.name }).where(eq(user.id, account.authUserId)).returning({ id: user.id });
        if (updated.length !== 1) throw new AccountError(409, 'CONFLICT', 'Identidad desincronizada');
      }
      await tx.update(userAccounts).set({ fullName: data.name, updatedAt: new Date() }).where(eq(userAccounts.id, id));
      await recordAudit(tx, id, actor, 'UPDATE', { name: account.fullName }, { name: data.name });
    }
  });
  return getAccount(id);
}
