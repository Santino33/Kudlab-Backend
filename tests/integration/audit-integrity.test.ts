import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { adminRoleRequests, auditEvents, invitations, userAccounts } from '../../src/db/schema/accounts.js';
import { inviteTeacher, request, reset } from '../helpers.js';

describe('auditoría y persistencia', () => {
  beforeEach(reset);
  it('impide UPDATE/DELETE incluso al propietario; conserva eventos e invitación al inactivar', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    const submitted = await (await request('/api/v1/admin-role-requests', 'POST', undefined, teacher)).json();
    expect((await request(`/api/v1/admin-role-requests/${submitted.id}/reject`, 'POST', undefined, admin)).status).toBe(200);
    const [event] = await db.select().from(auditEvents).where(eq(auditEvents.targetAccountId, account.id));
    await expect(db.execute(sql`update account_audit_events set action = 'FORGED' where id = ${event!.id}`)).rejects.toThrow();
    await expect(db.execute(sql`delete from account_audit_events where id = ${event!.id}`)).rejects.toThrow();
    expect((await request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }, admin)).status).toBe(200);
    expect(await db.select().from(invitations).where(eq(invitations.accountId, account.id))).toHaveLength(1);
    expect(await db.select().from(adminRoleRequests).where(eq(adminRoleRequests.requesterAccountId, account.id))).toEqual([expect.objectContaining({ status: 'RECHAZADA' })]);
    expect((await db.select().from(auditEvents).where(eq(auditEvents.targetAccountId, account.id))).length).toBeGreaterThanOrEqual(3);
  });
  it('un rol de aplicación con SELECT/INSERT no obtiene UPDATE/DELETE de auditoría', async () => {
    await db.execute(sql`do $$ begin if not exists (select from pg_roles where rolname = 'kudlab_audit_test') then create role kudlab_audit_test; end if; end $$`);
    await db.execute(sql`grant usage on schema public to kudlab_audit_test`);
    await db.execute(sql`grant select, insert on account_audit_events to kudlab_audit_test`);
    await db.execute(sql`revoke update, delete on account_audit_events from kudlab_audit_test`);
    const [event] = await db.select().from(auditEvents).limit(1);
    for (const statement of [sql`update account_audit_events set action = 'FORGED' where id = ${event!.id}`,
      sql`delete from account_audit_events where id = ${event!.id}`]) {
      await expect(db.transaction(async (tx) => {
        await tx.execute(sql`set local role kudlab_audit_test`);
        await tx.execute(statement);
      })).rejects.toThrow();
    }
  });
  it('una falla de inserción de auditoría revierte cambio de rol', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    const promotion = await (await request('/api/v1/admin-role-requests', 'POST', undefined, teacher)).json();
    try {
      await db.execute(sql`create function reject_test_audit() returns trigger as $$ begin raise exception 'simulated audit failure'; end; $$ language plpgsql`);
      await db.execute(sql`create trigger fail_audit before insert on account_audit_events for each row execute function reject_test_audit()`);
      expect((await request(`/api/v1/admin-role-requests/${promotion.id}/approve`, 'POST', undefined, admin)).status).toBe(503);
      const [unchanged] = await db.select().from(userAccounts).where(eq(userAccounts.id, account.id));
      expect(unchanged?.role).toBe('TEACHER');
    } finally {
      await db.execute(sql`drop trigger if exists fail_audit on account_audit_events`);
      await db.execute(sql`drop function if exists reject_test_audit()`);
    }
  });
});
