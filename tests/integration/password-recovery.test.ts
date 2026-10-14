import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { user } from '../../src/db/schema/auth.js';
import { capturedMail } from '../../src/modules/usuarios/invitations.mailer.js';
import { digestToken } from '../../src/modules/usuarios/invitations.service.js';
import { inviteTeacher, login, loginPair, request, reset } from '../helpers.js';

const requestLink = async (email: string) => {
  const response = await request('/api/v1/auth/password-recovery/request', 'POST', { email });
  expect(response.status).toBe(202);
  return new URL(capturedMail.at(-1)!.url).searchParams.get('token')!;
};
const redeem = (token: string, newPassword: string) =>
  request('/api/v1/auth/password-recovery/confirm', 'POST', { token, newPassword });

describe('recuperación transaccional', () => {
  beforeEach(reset);

  it('cambia contraseña solo para titular ACTIVO y revoca todas sus sesiones previas', async () => {
    const { first, second } = await loginPair();
    const token = await requestLink('admin@pilot.edu.co');
    const result = await redeem(token, 'ChangedPass123');
    expect(result.status).toBe(200);
    for (const old of [first, second])
      expect((await request('/api/v1/accounts', 'GET', undefined, old)).status).toBe(401);
    await expect(login()).rejects.toThrow();
    expect((await request('/api/v1/accounts', 'GET', undefined,
      await login('admin@pilot.edu.co', 'ChangedPass123'))).status).toBe(200);
  });

  it('rechaza un enlace a los 30 minutos exactos sin tocar credencial anterior', async () => {
    const token = await requestLink('admin@pilot.edu.co');
    const now = new Date(Date.now() - 1_800_000);
    await db.execute(sql`update password_recovery_verifications set created_at = ${now},
      expires_at = ${new Date(now.getTime() + 1_800_000)} where token_digest = ${digestToken(token)}`);
    expect((await redeem(token, 'ChangedPass123')).status).toBe(410);
    await login();
  });

  it('rehúsa canje después de cambio de correo o inactivación y distingue correo pendiente', async () => {
    const { account } = await inviteTeacher();
    capturedMail.length = 0;
    const token = await requestLink('teacher@pilot.edu.co');
    await db.update(userAccounts).set({ pendingEmailNormalized: 'new@pilot.edu.co' }).where(eq(userAccounts.id, account.id));
    const pending = await request('/api/v1/auth/password-recovery/request', 'POST', { email: 'new@pilot.edu.co' });
    expect(pending.status).toBe(202);
    expect(capturedMail).toHaveLength(1);
    await db.update(userAccounts).set({ emailNormalized: 'new@pilot.edu.co', pendingEmailNormalized: null })
      .where(eq(userAccounts.id, account.id));
    await db.update(user).set({ email: 'new@pilot.edu.co' }).where(eq(user.email, 'teacher@pilot.edu.co'));
    expect((await redeem(token, 'ChangedPass123')).status).toBe(410);
    const newToken = await requestLink('new@pilot.edu.co');
    await db.update(userAccounts).set({ status: 'INACTIVA' }).where(eq(userAccounts.id, account.id));
    expect((await redeem(newToken, 'ChangedPass123')).status).toBe(410);
  });

  it('solo permite un canje simultáneo del mismo enlace', async () => {
    const token = await requestLink('admin@pilot.edu.co');
    const results = await Promise.all([redeem(token, 'FirstPass123'), redeem(token, 'SecondPass123')]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 410]);
    const successes = await Promise.all(['FirstPass123', 'SecondPass123'].map(async (pw) => {
      try { await login('admin@pilot.edu.co', pw); return true; } catch { return false; }
    }));
    expect(successes.filter(Boolean)).toHaveLength(1);
  });

  it('si falla auditoría después de revocar sesiones deshace hash, revocación y consumo', async () => {
    const previous = await login();
    const token = await requestLink('admin@pilot.edu.co');
    try {
      await db.execute(sql`create function fail_reset_audit() returns trigger as $$ begin
        if NEW.action = 'PASSWORD_RESET' then raise exception 'simulated audit failure'; end if;
        return NEW; end; $$ language plpgsql`);
      await db.execute(sql`create trigger fail_reset_audit_trigger before insert on account_audit_events
        for each row execute function fail_reset_audit()`);
      expect((await redeem(token, 'ChangedPass123')).status).toBe(503);
      expect((await request('/api/v1/accounts', 'GET', undefined, previous)).status).toBe(200);
      await login();
    } finally {
      await db.execute(sql`drop trigger if exists fail_reset_audit_trigger on account_audit_events`);
      await db.execute(sql`drop function if exists fail_reset_audit()`);
    }
    expect((await redeem(token, 'ChangedPass123')).status).toBe(200);
  });
});
