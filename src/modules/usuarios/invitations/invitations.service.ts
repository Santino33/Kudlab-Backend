import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { verifyPassword } from 'better-auth/crypto';
import { db } from '../../../db/client.js';
import { invitations, userAccounts } from '../../../db/schema/accounts.js';
import { user, account as credentials } from '../../../db/schema/auth.js';
import { auth } from '../../../auth/auth.js';
import { INVITATION_TTL_MS, loadEnv } from '../../../config/env.js';
import { AccountError, parseProfileInput } from '../shared/accounts.errors.js';
import { passwordSchema } from '../shared/accounts.validation.js';
import { recordAudit } from '../shared/audit.service.js';
import { recordMailDiagnostic, sendTransactionalMail } from '../shared/transactional-mail.js';
import { lockAccount } from '../shared/account-lock.js';

export const digestToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function issueInvitation(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], accountId: string, email: string, actor: string) {
  const now = new Date();
  const token = randomBytes(32).toString('base64url');
  const [invitation] = await tx.insert(invitations).values({ accountId, emailNormalized: email, createdBy: actor,
    tokenDigest: digestToken(token), createdAt: now, expiresAt: new Date(now.getTime() + INVITATION_TTL_MS) }).returning();
  return { invitation: invitation!, token };
}

export async function deliverInvitation(id: string, email: string, token: string) {
  const url = new URL(loadEnv().INVITATION_BASE_URL);
  url.searchParams.set('token', token);
  const reference = { purpose: 'invitation' as const, operationId: id };
  const result = await sendTransactionalMail({ ...reference, to: email, url: url.toString() });
  if (result.outcome === 'unknown')
    throw new AccountError(503, 'DELIVERY_STATUS_UNKNOWN', 'No se pudo confirmar el envío de la invitación');
  try {
    await db.update(invitations).set({ deliveryStatus: result.outcome === 'accepted' ? 'ENVIADA' : 'ERROR' }).where(eq(invitations.id, id));
  } catch {
    recordMailDiagnostic(reference, { outcome: result.outcome, category: 'persistence' });
    throw new AccountError(503, 'DELIVERY_STATUS_UNKNOWN', 'El correo pudo entregarse; verifique el estado');
  }
  if (result.outcome === 'rejected') throw new AccountError(503, 'DELIVERY_FAILED', 'Invitación pendiente de entrega');
}

export async function acceptInvitation(token: string, submittedPassword: unknown) {
  const digest = digestToken(token);
  return db.transaction(async (tx) => {
    const [candidate] = await tx.select({ accountId: invitations.accountId }).from(invitations).where(eq(invitations.tokenDigest, digest));
    if (!candidate) throw new AccountError(410, 'INVITATION_EXPIRED', 'Invitación inválida o vencida');
    const account = await lockAccount(tx, candidate.accountId);
    const rows = await tx.execute(sql`select * from account_invitations where token_digest = ${digest} for update`);
    const invitation = rows.rows[0] as { id: string; account_id: string; email_normalized: string; token_digest: string; expires_at: Date; consumed_at: Date | null; invalidated_at: Date | null } | undefined;
    if (!invitation)
      throw new AccountError(410, 'INVITATION_EXPIRED', 'Invitación inválida o vencida');
    const tokenMatches = timingSafeEqual(Buffer.from(invitation.token_digest), Buffer.from(digest));
    const isUnavailable = invitation.consumed_at || invitation.invalidated_at ||
      new Date(invitation.expires_at).getTime() <= Date.now();
    if (!tokenMatches || isUnavailable)
      throw new AccountError(410, 'INVITATION_EXPIRED', 'Invitación inválida o vencida');
    const canActivate = account.status === 'PENDIENTE' &&
      account.emailNormalized === invitation.email_normalized && account.role === 'TEACHER';
    if (!canActivate)
      throw new AccountError(409, 'ACCOUNT_CONFLICT', 'La cuenta no puede activarse');

    const password = parseProfileInput(passwordSchema, submittedPassword, 'password');
    let [identity] = await db.select().from(user).where(eq(user.email, account.emailNormalized));
    if (!identity) {
      const created = await auth.api.createUser({ body: { email: account.emailNormalized, name: account.fullName, password, role: 'teacher' } });
      [identity] = await db.select().from(user).where(eq(user.id, created.user.id));
    } else {
      const [credential] = await db.select().from(credentials).where(and(eq(credentials.userId, identity.id), eq(credentials.providerId, 'credential')));
      if (identity.role !== 'teacher' || !credential?.password || !(await verifyPassword({ hash: credential.password, password })))
        throw new AccountError(409, 'ACCOUNT_CONFLICT', 'Activación no completada');
      const [linked] = await db.select({ id: userAccounts.id }).from(userAccounts).where(eq(userAccounts.authUserId, identity.id));
      if (linked) throw new AccountError(409, 'ACCOUNT_CONFLICT', 'Activación no completada');
    }
    if (!identity) throw new AccountError(503, 'UNAVAILABLE', 'Activación no completada');

    await tx.update(userAccounts).set({ authUserId: identity.id, status: 'ACTIVA', updatedAt: new Date() }).where(eq(userAccounts.id, account.id));
    await tx.update(invitations).set({ consumedAt: new Date() }).where(and(eq(invitations.id, invitation.id), isNull(invitations.consumedAt)));
    await recordAudit(tx, account.id, identity.id, 'ACTIVATE', { status: 'PENDIENTE' }, { status: 'ACTIVA' });
    return { status: 'ACTIVA' as const };
  });
}
