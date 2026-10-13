import { beforeEach, describe, expect, it } from 'vitest';
import { capturedMail } from '../../src/modules/usuarios/invitations.mailer.js';
import { inviteTeacher, login, request, reset } from '../helpers.js';
import { db } from '../../src/db/client.js';
import { emailChanges, userAccounts } from '../../src/db/schema/accounts.js';
import { user } from '../../src/db/schema/auth.js';
import { eq, sql } from 'drizzle-orm';

describe('US2 seguridad y correo', () => {
  beforeEach(reset);
  it('no eleva privilegios sin decisión y protege último ADMIN', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    expect((await request('/api/v1/admin-role-requests', 'POST', undefined, teacher)).status).toBe(201);
    expect((await request('/api/v1/admin-role-requests', 'POST', undefined, teacher)).status).toBe(409);
    expect((await request(`/api/v1/accounts/${account.id}/role`, 'PUT', { role: 'TEACHER' }, admin)).status).toBe(409);
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
  });
  it('reserva correo nuevo, lo confirma una vez y revoca sesiones', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    const edited = await request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: 'new@pilot.edu.co' }, admin);
    expect(edited.status).toBe(200);
    expect((await edited.json()).email).toBe('teacher@pilot.edu.co');
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
    expect((await request('/api/v1/account-email-changes/confirm', 'POST', { token })).status).toBe(200);
    expect((await request('/api/v1/account-email-changes/confirm', 'POST', { token })).status).toBe(410);
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(401);
    await login('new@pilot.edu.co', 'TeacherPass1');
  });
  it('rechaza solicitud sin ascenso y permite degradar cuando queda otro ADMIN', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    const requestResponse = await request('/api/v1/admin-role-requests', 'POST', undefined, teacher);
    const promotion = await requestResponse.json();
    expect((await request(`/api/v1/admin-role-requests/${promotion.id}/reject`, 'POST', undefined, admin)).status).toBe(200);
    expect((await request(`/api/v1/admin-role-requests/${promotion.id}/approve`, 'POST', undefined, admin)).status).toBe(409);
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    const again = await (await request('/api/v1/admin-role-requests', 'POST', undefined, teacher)).json();
    expect((await request(`/api/v1/admin-role-requests/${again.id}/approve`, 'POST', undefined, admin)).status).toBe(200);
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(200);
    expect((await request(`/api/v1/accounts/${account.id}/role`, 'PUT', { role: 'TEACHER' }, admin)).status).toBe(200);
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    const events = await (await request(`/api/v1/accounts/${account.id}/audit`, 'GET', undefined, admin)).json();
    expect(events.map((event: { action: string }) => event.action)).toEqual(expect.arrayContaining(['REQUEST_ADMIN', 'REJECT_ADMIN', 'APPROVE_ADMIN', 'ROLE_CHANGE']));
  });
  it('cambio de correo PENDIENTE invalida enlace anterior y la edición duplicada no cambia nombre', async () => {
    const admin = await login();
    const first = await (await request('/api/v1/accounts', 'POST', { name: 'Anterior', email: 'old@pilot.edu.co', role: 'TEACHER' }, admin)).json();
    const original = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
    const edited = await request(`/api/v1/accounts/${first.id}`, 'PATCH', { name: 'Nuevo', email: 'new@pilot.edu.co' }, admin);
    expect(edited.status).toBe(200);
    expect((await request('/api/v1/account-invitations/accept', 'POST', { token: original, password: 'ValidPass1' })).status).toBe(410);
    expect((await request(`/api/v1/accounts/${first.id}`, 'PATCH', { name: 'No guardar', email: 'admin@pilot.edu.co' }, admin)).status).toBe(409);
    expect((await (await request(`/api/v1/accounts/${first.id}`, 'GET', undefined, admin)).json()).name).toBe('Nuevo');
    const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
    expect((await request('/api/v1/account-invitations/accept', 'POST', { token, password: 'ValidPass1' })).status).toBe(200);
  });
  it('bloquea autoaprobación y solicitudes/decisiones de cuentas inactivas', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    const submitted = await (await request('/api/v1/admin-role-requests', 'POST', undefined, teacher)).json();
    // Simula un rol modificado fuera del flujo para comprobar también la prohibición de autoaprobación.
    await db.update(userAccounts).set({ role: 'ADMIN' }).where(eq(userAccounts.id, account.id));
    await db.update(user).set({ role: 'admin' }).where(eq(user.email, 'teacher@pilot.edu.co'));
    expect((await request(`/api/v1/admin-role-requests/${submitted.id}/approve`, 'POST', undefined, teacher)).status).toBe(403);
    await db.update(userAccounts).set({ role: 'TEACHER' }).where(eq(userAccounts.id, account.id));
    await db.update(user).set({ role: 'teacher' }).where(eq(user.email, 'teacher@pilot.edu.co'));
    expect((await request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }, admin)).status).toBe(200);
    expect((await request('/api/v1/admin-role-requests', 'POST', undefined, teacher)).status).toBe(401);
    expect((await request(`/api/v1/admin-role-requests/${submitted.id}/approve`, 'POST', undefined, admin)).status).toBe(409);
  });
  it('fallo de auditoría impide aprobar y conserva permisos anteriores', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    const submitted = await (await request('/api/v1/admin-role-requests', 'POST', undefined, teacher)).json();
    try {
      await db.execute(sql`create function reject_promotion_audit() returns trigger as $$ begin raise exception 'simulated audit failure'; end; $$ language plpgsql`);
      await db.execute(sql`create trigger fail_promotion_audit before insert on account_audit_events for each row execute function reject_promotion_audit()`);
      expect((await request(`/api/v1/admin-role-requests/${submitted.id}/approve`, 'POST', undefined, admin)).status).toBe(503);
      expect((await (await request(`/api/v1/accounts/${account.id}`, 'GET', undefined, admin)).json()).role).toBe('TEACHER');
      expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    } finally {
      await db.execute(sql`drop trigger if exists fail_promotion_audit on account_audit_events`);
      await db.execute(sql`drop function if exists reject_promotion_audit()`);
    }
  });
  it('verificación de correo vencida preserva dirección anterior', async () => {
    const { account, admin } = await inviteTeacher();
    expect((await request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: 'expired@pilot.edu.co' }, admin)).status).toBe(200);
    const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
    await db.update(emailChanges).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(emailChanges.accountId, account.id));
    expect((await request('/api/v1/account-email-changes/confirm', 'POST', { token })).status).toBe(410);
    expect((await (await request(`/api/v1/accounts/${account.id}`, 'GET', undefined, admin)).json()).email).toBe('teacher@pilot.edu.co');
  });
});
