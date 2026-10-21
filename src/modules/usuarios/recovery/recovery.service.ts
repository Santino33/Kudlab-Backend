import { randomBytes } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { account as credentials, session, user } from '../../../db/schema/auth.js';
import { userAccounts } from '../../../db/schema/accounts.js';
import { passwordRecoveryVerifications } from '../../../db/schema/authentication.js';
import { loadEnv } from '../../../config/env.js';
import { hashCredentialPassword } from '../../../auth/credential-identity.js';
import { hasActiveIdentity } from '../shared/accounts.types.js';
import { AccountError } from '../shared/accounts.errors.js';
import { institutionalEmail, passwordSchema } from '../shared/accounts.validation.js';
import { lockAccount } from '../shared/account-lock.js';
import { digestToken } from '../invitations/invitations.service.js';
import { makeMailer } from '../invitations/invitations.mailer.js';
import { recordAudit } from '../shared/audit.service.js';

const RESET_TTL_MS = 30 * 60 * 1000;
const expired = () => new AccountError(410, 'VERIFICATION_EXPIRED', 'Verificación inválida o vencida');

export async function requestRecovery(rawEmail: string) {
  const email = institutionalEmail.parse(rawEmail);
  const issued = await db.transaction(async (tx) => {
    const [candidate] = await tx.select({ id: userAccounts.id }).from(userAccounts)
      .where(eq(userAccounts.emailNormalized, email)).limit(1);
    if (!candidate) return null;
    const account = await lockAccount(tx, candidate.id);
    if (account.status !== 'ACTIVA' || !account.authUserId) return null;
    const [identity] = await tx.select({ email: user.email, role: user.role, banned: user.banned })
      .from(user).where(eq(user.id, account.authUserId)).limit(1);
    if (!hasActiveIdentity(account, identity) || identity?.email !== email) return null;

    const token = randomBytes(32).toString('base64url');
    const createdAt = new Date();
    await tx.update(passwordRecoveryVerifications).set({ invalidatedAt: createdAt })
      .where(and(eq(passwordRecoveryVerifications.accountId, account.id),
        isNull(passwordRecoveryVerifications.consumedAt), isNull(passwordRecoveryVerifications.invalidatedAt)));
    await tx.insert(passwordRecoveryVerifications).values({ accountId: account.id, emailNormalized: email,
      tokenDigest: digestToken(token), createdAt, expiresAt: new Date(createdAt.getTime() + RESET_TTL_MS) });
    return { email, token };
  });
  if (issued) {
    const url = new URL(loadEnv().RESET_BASE_URL);
    url.searchParams.set('token', issued.token);
    try { await makeMailer('Recuperar acceso a Kudlab')(issued.email, url.toString()); }
    catch { /* No revelar si la cuenta existe ni afirmar que se entregó el enlace. */ }
  }
}

export async function confirmRecovery(token: string, rawPassword: unknown) {
  const digest = digestToken(token);
  return db.transaction(async (tx) => {
    const [candidate] = await tx.select({ accountId: passwordRecoveryVerifications.accountId })
      .from(passwordRecoveryVerifications).where(eq(passwordRecoveryVerifications.tokenDigest, digest)).limit(1);
    if (!candidate) throw expired();
    const account = await lockAccount(tx, candidate.accountId);
    const [verification] = await tx.select().from(passwordRecoveryVerifications)
      .where(eq(passwordRecoveryVerifications.tokenDigest, digest)).for('update');
    if (!verification) throw expired();
    const isUsable = !verification.consumedAt && !verification.invalidatedAt &&
      verification.expiresAt.getTime() > Date.now();
    const matchesAccount = verification.emailNormalized === account.emailNormalized;
    if (!isUsable || account.status !== 'ACTIVA' || !account.authUserId || !matchesAccount) throw expired();

    const [identity] = await tx.select({ email: user.email, role: user.role, banned: user.banned })
      .from(user).where(eq(user.id, account.authUserId));
    if (!hasActiveIdentity(account, identity) || identity?.email !== account.emailNormalized) throw expired();

    const password = passwordSchema.safeParse(rawPassword);
    if (!password.success) throw new AccountError(400, 'INVALID_INPUT', 'Contraseña inválida');
    const credentialRows = await tx.select({ id: credentials.id }).from(credentials)
      .where(and(eq(credentials.userId, account.authUserId), eq(credentials.providerId, 'credential'))).limit(2);
    if (credentialRows.length !== 1) throw expired();
    const passwordHash = await hashCredentialPassword(password.data);
    await tx.update(credentials).set({ password: passwordHash, updatedAt: new Date() }).where(eq(credentials.id, credentialRows[0]!.id));
    await tx.delete(session).where(eq(session.userId, account.authUserId));
    await tx.update(passwordRecoveryVerifications).set({ consumedAt: new Date() })
      .where(eq(passwordRecoveryVerifications.id, verification.id));
    await recordAudit(tx, account.id, account.authUserId, 'PASSWORD_RESET');
    return { success: true as const };
  });
}
