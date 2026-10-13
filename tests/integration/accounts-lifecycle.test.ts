import { beforeEach, describe, expect, it } from 'vitest';
import { inviteTeacher, login, request, reset } from '../helpers.js';
import { db } from '../../src/db/client.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { eq, sql } from 'drizzle-orm';

describe('US3 revocación efectiva', () => {
  beforeEach(reset);
  it('no reutiliza sesión anterior tras reactivar', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    const first = await request('/api/v1/admin-role-requests', 'GET', undefined, teacher);
    expect(first.status).toBe(200);
    expect((await request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }, admin)).status).toBe(200);
    expect((await request('/api/v1/admin-role-requests', 'GET', undefined, teacher)).status).toBe(401);
    expect((await request(`/api/v1/accounts/${account.id}/reactivate`, 'POST', { confirm: true }, admin)).status).toBe(200);
    expect((await request('/api/v1/admin-role-requests', 'GET', undefined, teacher)).status).toBe(401);
    expect((await request('/api/v1/admin-role-requests', 'GET', undefined, await login('teacher@pilot.edu.co', 'TeacherPass1'))).status).toBe(200);
  });
  it('protege último ADMIN y bloquea ingreso inactivo', async () => {
    const admin = await login();
    const accounts = await (await request('/api/v1/accounts', 'GET', undefined, admin)).json();
    expect((await request(`/api/v1/accounts/${accounts.items[0].id}/deactivate`, 'POST', { confirm: true }, admin)).status).toBe(409);
    const { account } = await inviteTeacher();
    expect((await request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }, admin)).status).toBe(200);
    await expect(login('teacher@pilot.edu.co', 'TeacherPass1')).rejects.toThrow();
  });
  it('si falla auditoría, estado y sesión anterior permanecen vigentes', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    try {
      await db.execute(sql`create function reject_lifecycle_audit() returns trigger as $$ begin raise exception 'simulated audit failure'; end; $$ language plpgsql`);
      await db.execute(sql`create trigger fail_lifecycle_audit before insert on account_audit_events for each row execute function reject_lifecycle_audit()`);
      expect((await request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }, admin)).status).toBe(503);
      const [unchanged] = await db.select().from(userAccounts).where(eq(userAccounts.id, account.id));
      expect(unchanged?.status).toBe('ACTIVA');
      expect((await request('/api/v1/admin-role-requests', 'GET', undefined, teacher)).status).toBe(200);
    } finally {
      await db.execute(sql`drop trigger if exists fail_lifecycle_audit on account_audit_events`);
      await db.execute(sql`drop function if exists reject_lifecycle_audit()`);
    }
  });
  it('inactivaciones simultáneas no dejan cero administradores', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    const submitted = await (await request('/api/v1/admin-role-requests', 'POST', undefined, teacher)).json();
    expect((await request(`/api/v1/admin-role-requests/${submitted.id}/approve`, 'POST', undefined, admin)).status).toBe(200);
    const all = await (await request('/api/v1/accounts', 'GET', undefined, admin)).json();
    const bootstrap = all.items.find((item: { id: string }) => item.id !== account.id);
    const results = await Promise.all([
      request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }, admin),
      request(`/api/v1/accounts/${bootstrap.id}/deactivate`, 'POST', { confirm: true }, teacher),
    ]);
    expect(results.map((r) => r.status).filter((status) => status === 200)).toHaveLength(1);
    const remaining = await db.select().from(userAccounts).where(sql`${userAccounts.role} = 'ADMIN' and ${userAccounts.status} = 'ACTIVA'`);
    expect(remaining).toHaveLength(1);
  });
});
