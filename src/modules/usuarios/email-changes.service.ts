import { randomBytes } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { emailChanges, invitations, userAccounts } from '../../db/schema/accounts.js';
import { session, user } from '../../db/schema/auth.js';
import { INVITATION_TTL_MS, loadEnv } from '../../config/env.js';
import { AccountError } from './accounts.errors.js';
import { institutionalEmail } from './accounts.validation.js';
import { recordAudit } from './audit.service.js';
import { deliverInvitation, digestToken, issueInvitation } from './invitations.service.js';
import { makeMailer } from './invitations.mailer.js';

export async function changeEmail(account: typeof userAccounts.$inferSelect, email: string, actor: string, name?: string) {
  const normalized = institutionalEmail.parse(email);
  if (normalized === account.emailNormalized && account.status !== 'PENDIENTE') throw new AccountError(409, 'CONFLICT', 'Correo sin cambios');
  const issued = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(713611033)`);
    const [duplicate] = await tx.select().from(userAccounts).where(sql`${userAccounts.emailNormalized} = ${normalized} or ${userAccounts.pendingEmailNormalized} = ${normalized}`);
    if (duplicate && duplicate.id !== account.id) throw new AccountError(409, 'CONFLICT', 'Correo ya reservado');
    if (account.status === 'PENDIENTE') {
      await tx.update(invitations).set({ invalidatedAt: new Date() }).where(and(eq(invitations.accountId, account.id), isNull(invitations.consumedAt), isNull(invitations.invalidatedAt)));
      await tx.update(userAccounts).set({ emailNormalized: normalized, ...(name ? { fullName: name } : {}), updatedAt: new Date() }).where(eq(userAccounts.id, account.id));
      const { invitation, token } = await issueInvitation(tx, account.id, normalized, actor);
      await recordAudit(tx, account.id, actor, normalized === account.emailNormalized ? 'INVITE' : 'UPDATE',
        { email: account.emailNormalized }, { email: normalized });
      if (name && name !== account.fullName) await recordAudit(tx, account.id, actor, 'UPDATE', { name: account.fullName }, { name });
      return { id: invitation.id, token, pending: true };
    }
    if (account.status !== 'ACTIVA') throw new AccountError(409, 'CONFLICT', 'Cuenta inactiva');
    await tx.update(emailChanges).set({ invalidatedAt: new Date() }).where(and(eq(emailChanges.accountId, account.id), isNull(emailChanges.consumedAt), isNull(emailChanges.invalidatedAt)));
    const token = randomBytes(32).toString('base64url');
    if (name && account.authUserId) await tx.update(user).set({ name }).where(eq(user.id, account.authUserId));
    await tx.update(userAccounts).set({ pendingEmailNormalized: normalized, ...(name ? { fullName: name } : {}), updatedAt: new Date() }).where(eq(userAccounts.id, account.id));
    if (name && name !== account.fullName) await recordAudit(tx, account.id, actor, 'UPDATE', { name: account.fullName }, { name });
    const now = new Date();
    await tx.insert(emailChanges).values({ accountId: account.id, newEmailNormalized: normalized, tokenDigest: digestToken(token),
      createdAt: now, expiresAt: new Date(now.getTime() + INVITATION_TTL_MS) });
    return { token, pending: false };
  });
  if (issued.pending) await deliverInvitation(issued.id!, normalized, issued.token);
  else {
    const url = new URL(loadEnv().INVITATION_BASE_URL);
    url.searchParams.set('token', issued.token);
    try { await makeMailer()(normalized, url.toString()); }
    catch { throw new AccountError(503, 'DELIVERY_FAILED', 'Verificación pendiente de entrega'); }
  }
}

export async function confirmEmailChange(token: string) {
  const digest = digestToken(token);
  return db.transaction(async (tx) => {
    const locked = await tx.execute(sql`select * from account_email_changes where token_digest = ${digest} for update`);
    const change = locked.rows[0] as { id: string; account_id: string; new_email_normalized: string; expires_at: Date; consumed_at: Date | null; invalidated_at: Date | null } | undefined;
    if (!change || change.consumed_at || change.invalidated_at || new Date(change.expires_at).getTime() <= Date.now())
      throw new AccountError(410, 'TOKEN_EXPIRED', 'Verificación inválida o vencida');
    const [account] = await tx.select().from(userAccounts).where(eq(userAccounts.id, change.account_id));
    if (!account || account.status !== 'ACTIVA' || !account.authUserId || account.pendingEmailNormalized !== change.new_email_normalized)
      throw new AccountError(409, 'CONFLICT', 'Correo no verificable');
    await tx.update(user).set({ email: change.new_email_normalized, emailVerified: true }).where(eq(user.id, account.authUserId));
    await tx.update(userAccounts).set({ emailNormalized: change.new_email_normalized, pendingEmailNormalized: null, updatedAt: new Date() }).where(eq(userAccounts.id, account.id));
    await tx.update(emailChanges).set({ consumedAt: new Date() }).where(eq(emailChanges.id, change.id));
    await tx.delete(session).where(eq(session.userId, account.authUserId));
    await recordAudit(tx, account.id, account.authUserId, 'UPDATE', { email: account.emailNormalized }, { email: change.new_email_normalized });
    return { verified: true as const };
  });
}
