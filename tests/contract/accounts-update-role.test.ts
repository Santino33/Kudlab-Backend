import { beforeEach, describe, expect, it } from 'vitest';
import { inviteTeacher, request, reset } from '../helpers.js';
import { capturedMail } from '../../src/modules/usuarios/invitations.mailer.js';

describe('US2 contrato de edición y ascenso', () => {
  beforeEach(reset);
  it('edita nombre, restringe PUT rol y acepta solicitud para otro ADMIN', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    expect((await request(`/api/v1/accounts/${account.id}`, 'PATCH', { name: 'Nombre Editado' }, admin)).status).toBe(200);
    expect((await request(`/api/v1/accounts/${account.id}/role`, 'PUT', { role: 'ADMIN' }, admin)).status).toBe(400);
    const submitted = await request('/api/v1/admin-role-requests', 'POST', undefined, teacher);
    expect(submitted.status).toBe(201);
    const promotion = await submitted.json();
    expect(promotion.status).toBe('PENDIENTE');
    expect((await request('/api/v1/admin-role-requests', 'GET', undefined, teacher)).status).toBe(200);
    expect((await request(`/api/v1/admin-role-requests/${promotion.id}/approve`, 'POST', undefined, teacher)).status).toBe(403);
    expect((await request(`/api/v1/admin-role-requests/${promotion.id}/approve`, 'POST', undefined, admin)).status).toBe(200);
    expect((await (await request(`/api/v1/accounts/${account.id}`, 'GET', undefined, admin)).json()).role).toBe('ADMIN');
  });
  it('rechaza solicitud y confirma correo nuevo según contrato', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    const submitted = await (await request('/api/v1/admin-role-requests', 'POST', undefined, teacher)).json();
    expect((await request(`/api/v1/admin-role-requests/${submitted.id}/reject`, 'POST', undefined, admin)).status).toBe(200);
    expect((await request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: 'verified@pilot.edu.co' }, admin)).status).toBe(200);
    const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
    expect((await request('/api/v1/account-email-changes/confirm', 'POST', { token })).status).toBe(200);
  });
});
