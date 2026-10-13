import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { user } from '../../src/db/schema/auth.js';
import { capturedMail } from '../../src/modules/usuarios/invitations.mailer.js';
import { inviteTeacher, login, request, reset } from '../helpers.js';

describe('convergencia: reservas, concurrencia y autoría', () => {
  beforeEach(reset);

  it('impide que una alta ocupe un correo reservado para otra cuenta', async () => {
    const { account, admin } = await inviteTeacher();
    expect((await request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: 'reserved@pilot.edu.co' }, admin)).status).toBe(200);
    expect((await request('/api/v1/accounts', 'POST', { name: 'Otra', email: 'reserved@pilot.edu.co', role: 'TEACHER' }, admin)).status).toBe(409);
    expect((await db.select().from(userAccounts)).filter((row) => row.emailNormalized === 'reserved@pilot.edu.co' || row.pendingEmailNormalized === 'reserved@pilot.edu.co')).toHaveLength(1);
  });

  it('serializa alta y reserva simultáneas sin aceptar dos propietarios', async () => {
    const { account, admin } = await inviteTeacher();
    const results = await Promise.all([
      request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: 'race@pilot.edu.co' }, admin),
      request('/api/v1/accounts', 'POST', { name: 'Otra', email: 'race@pilot.edu.co', role: 'TEACHER' }, admin),
    ]);
    expect(results.map((response) => response.status).filter((status) => status === 409)).toHaveLength(1);
    const claims = (await db.select().from(userAccounts)).filter((row) => row.emailNormalized === 'race@pilot.edu.co' || row.pendingEmailNormalized === 'race@pilot.edu.co');
    expect(claims).toHaveLength(1);
  });

  it('serializa dos ediciones del mismo correo institucional', async () => {
    const first = await inviteTeacher();
    const second = await inviteTeacher('second@pilot.edu.co');
    const results = await Promise.all([
      request(`/api/v1/accounts/${first.account.id}`, 'PATCH', { email: 'shared@pilot.edu.co' }, first.admin),
      request(`/api/v1/accounts/${second.account.id}`, 'PATCH', { email: 'shared@pilot.edu.co' }, second.admin),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
    expect((await db.select().from(userAccounts)).filter((row) => row.emailNormalized === 'shared@pilot.edu.co' || row.pendingEmailNormalized === 'shared@pilot.edu.co')).toHaveLength(1);
  });

  it('el actor de UPDATE del correo es el ADMIN solicitante, no el usuario destino', async () => {
    const { account, admin } = await inviteTeacher();
    const [administrator] = await db.select().from(userAccounts).where(eq(userAccounts.emailNormalized, 'admin@pilot.edu.co'));
    expect((await request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: 'verified@pilot.edu.co' }, admin)).status).toBe(200);
    const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
    expect((await request('/api/v1/account-email-changes/confirm', 'POST', { token })).status).toBe(200);
    const events = await (await request(`/api/v1/accounts/${account.id}/audit`, 'GET', undefined, admin)).json();
    const updated = events.filter((event: { action: string; after?: { email: string } }) => event.action === 'UPDATE' && event.after?.email === 'verified@pilot.edu.co');
    expect(updated).toHaveLength(1);
    expect(updated[0].actorId).toBe(administrator!.authUserId);
    expect(events).toContainEqual(expect.objectContaining({ action: 'REQUEST_EMAIL_CHANGE', actorId: administrator!.authUserId }));
    expect(events).toContainEqual(expect.objectContaining({ action: 'CONFIRM_EMAIL_CHANGE', actorId: 'system:email-verification', targetId: account.id }));
  });

  it('canje de invitación y edición pendiente concurrentes dejan identidad y correo coherentes', async () => {
    const admin = await login();
    const created = await (await request('/api/v1/accounts', 'POST', { name: 'Docente', email: 'original@pilot.edu.co', role: 'TEACHER' }, admin)).json();
    const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
    const [activation, edit] = await Promise.all([
      request('/api/v1/account-invitations/accept', 'POST', { token, password: 'ValidPass1' }),
      request(`/api/v1/accounts/${created.id}`, 'PATCH', { email: 'edited@pilot.edu.co' }, admin),
    ]);
    expect([200, 410, 409]).toContain(activation.status);
    expect([200, 409]).toContain(edit.status);
    const [current] = await db.select().from(userAccounts).where(eq(userAccounts.id, created.id));
    if (current?.status === 'ACTIVA') {
      const [identity] = await db.select().from(user).where(eq(user.id, current.authUserId!));
      expect(identity?.email).toBe(current.emailNormalized);
    }
  });

  it('una inactivación concurrente con edición no cambia el correo efectivo sin confirmación', async () => {
    const { account, admin } = await inviteTeacher();
    const [deactivated, changed] = await Promise.all([
      request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }, admin),
      request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: 'paused@pilot.edu.co' }, admin),
    ]);
    expect(deactivated.status).toBe(200);
    expect([200, 409]).toContain(changed.status);
    const [current] = await db.select().from(userAccounts).where(eq(userAccounts.id, account.id));
    const [identity] = await db.select().from(user).where(eq(user.id, current!.authUserId!));
    expect(current?.status).toBe('INACTIVA');
    expect(identity?.email).toBe(current?.emailNormalized);
  });
});
