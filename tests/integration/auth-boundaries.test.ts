import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { user, account as authCredentials } from '../../src/db/schema/auth.js';
import { bootstrapAdmin } from '../../src/scripts/bootstrap-admin.js';
import { inviteTeacher, login, request, reset } from '../helpers.js';
import { capturedMail } from '../../src/modules/usuarios/invitations.mailer.js';

describe('fronteras de autenticación', () => {
  beforeEach(reset);
  it('rechaza registro público, API Admin y sesión inexistente', async () => {
    expect((await request('/api/auth/sign-up/email', 'POST', { name: 'A', email: 'a@pilot.edu.co', password: 'Password1' })).status).toBe(403);
    expect((await request('/api/auth/admin/create-user', 'POST', { email: 'a@pilot.edu.co', password: 'Password1' }, await login())).status).toBe(403);
    expect((await request('/api/v1/accounts', 'GET', undefined, { authorization: 'Bearer invalid-token' })).status).toBe(401);
    expect((await request('/api/v1/accounts', 'GET', undefined, { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.signature' })).status).toBe(401);
    const tokenResponse = await request('/api/auth/token', 'GET', undefined, await login());
    expect(tokenResponse.status).toBe(200);
    const { token } = await tokenResponse.json();
    expect((await request('/api/v1/accounts', 'GET', undefined, { authorization: `Bearer ${token}` })).status).toBe(401);
  });
  it('deniega rol discordante y cuenta PENDIENTE o INACTIVA', async () => {
    const initialAdmin = await login();
    expect((await request('/api/v1/accounts', 'POST', { name: 'Pendiente', email: 'pending@pilot.edu.co', role: 'TEACHER' }, initialAdmin)).status).toBe(201);
    expect(capturedMail).toHaveLength(1);
    await expect(login('pending@pilot.edu.co', 'TeacherPass1')).rejects.toThrow();
    const { account, admin, teacher } = await inviteTeacher();
    await db.update(user).set({ role: 'admin' }).where(eq(user.email, 'teacher@pilot.edu.co'));
    expect((await request('/api/v1/admin-role-requests', 'GET', undefined, teacher)).status).toBe(403);
    await db.update(user).set({ role: 'teacher' }).where(eq(user.email, 'teacher@pilot.edu.co'));
    await db.update(userAccounts).set({ status: 'INACTIVA' }).where(eq(userAccounts.id, account.id));
    expect((await request('/api/v1/admin-role-requests', 'GET', undefined, teacher)).status).toBe(403);
    expect((await request('/api/v1/accounts', 'GET', undefined, admin)).status).toBe(200);
  });
  it('bootstrap de tres arranques no altera credenciales; sin configuración no crea cuenta', async () => {
    await bootstrapAdmin(); await bootstrapAdmin();
    expect((await db.select().from(userAccounts))).toHaveLength(1);
    await login();
    await db.execute(sql`truncate account_audit_events, account_email_changes, account_invitations, admin_role_requests, user_accounts, session, account, verification, jwks, "user" cascade`);
    const original = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    try { await expect(bootstrapAdmin()).rejects.toThrow(); }
    finally { process.env.BOOTSTRAP_ADMIN_PASSWORD = original; }
    expect(await db.select().from(userAccounts)).toHaveLength(0);
  });
  it('el bootstrap revierte identidad y hash Better Auth si falla la auditoría', async () => {
    await db.execute(sql`truncate account_audit_events, account_email_changes, account_invitations, admin_role_requests, user_accounts, session, account, verification, jwks, "user" cascade`);
    try {
      await db.execute(sql`create function reject_bootstrap_audit() returns trigger as $$ begin raise exception 'simulated audit failure'; end; $$ language plpgsql`);
      await db.execute(sql`create trigger fail_bootstrap_audit before insert on account_audit_events for each row execute function reject_bootstrap_audit()`);
      await expect(bootstrapAdmin()).rejects.toThrow();
      expect(await db.select().from(user)).toHaveLength(0);
      expect(await db.select().from(authCredentials)).toHaveLength(0);
      expect(await db.select().from(userAccounts)).toHaveLength(0);
    } finally {
      await db.execute(sql`drop trigger if exists fail_bootstrap_audit on account_audit_events`);
      await db.execute(sql`drop function if exists reject_bootstrap_audit()`);
    }
    await bootstrapAdmin();
    await login();
  });
});
