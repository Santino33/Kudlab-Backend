import { beforeEach, describe, expect, it } from 'vitest';
import { capturedMail } from '../../src/modules/usuarios/invitations.mailer.js';
import { inviteTeacher, login, request, reset } from '../helpers.js';

describe('US1: contrato HTTP de invitaciones', () => {
  beforeEach(reset);
  it('crea, lista, consulta y audita sin exponer secreto', async () => {
    const headers = await login();
    const created = await request('/api/v1/accounts', 'POST', { name: 'Docente Uno', email: 'docente@pilot.edu.co', role: 'TEACHER' }, headers);
    expect(created.status).toBe(201);
    const body = await created.json();
    expect(body).toMatchObject({ status: 'PENDIENTE', role: 'TEACHER', deliveryStatus: 'ENVIADA' });
    expect(JSON.stringify(body)).not.toContain('token');
    expect(capturedMail).toHaveLength(1);
    expect((await (await request('/api/v1/accounts', 'GET', undefined, headers)).json()).items).toContainEqual(expect.objectContaining({ id: body.id }));
    expect((await (await request(`/api/v1/accounts/${body.id}`, 'GET', undefined, headers)).json()).id).toBe(body.id);
    expect((await (await request(`/api/v1/accounts/${body.id}/audit`, 'GET', undefined, headers)).json())[0].action).toBe('INVITE');
    const token = new URL(capturedMail[0]!.url).searchParams.get('token');
    expect((await request('/api/v1/account-invitations/accept', 'POST', { token, password: 'NewTeacher1' })).status).toBe(200);
    expect((await request('/api/v1/account-invitations/accept', 'POST', { token, password: 'NewTeacher1' })).status).toBe(410);
  });
  it('deniega acceso y entradas inválidas', async () => {
    expect((await request('/api/v1/accounts', 'GET')).status).toBe(401);
    const headers = await login();
    expect((await request('/api/v1/accounts', 'POST', { name: 'X', email: 'x@other.org', role: 'TEACHER' }, headers)).status).toBe(400);
    expect((await request('/api/v1/accounts', 'POST', { name: 'X', email: 'x@pilot.edu.co', role: 'ADMIN' }, headers)).status).toBe(400);
  });
  it('aplica 403/409/404 y oculta cuentas a docente', async () => {
    const { admin, teacher } = await inviteTeacher();
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    expect((await request('/api/v1/accounts/00000000-0000-4000-8000-000000000001', 'GET', undefined, admin)).status).toBe(404);
    expect((await request('/api/v1/accounts/missing', 'GET', undefined, admin)).status).toBe(404);
    expect((await request('/api/v1/accounts', 'POST', { name: 'Otro', email: 'teacher@pilot.edu.co', role: 'TEACHER' }, admin)).status).toBe(409);
  });
  it('responde 503 si el SMTP rechaza la entrega', async () => {
    const headers = await login();
    Object.assign(process.env, { MAIL_MODE: 'smtp', MAIL_HOST: '127.0.0.1', MAIL_PORT: '1', MAIL_USER: 'test',
      MAIL_PASSWORD: 'test', MAIL_FROM: 'noreply@pilot.edu.co' });
    try {
      expect((await request('/api/v1/accounts', 'POST', { name: 'Docente', email: 'failed@pilot.edu.co', role: 'TEACHER' }, headers)).status).toBe(503);
    } finally {
      process.env.MAIL_MODE = 'capture';
      delete process.env.MAIL_HOST; delete process.env.MAIL_PORT; delete process.env.MAIL_USER;
      delete process.env.MAIL_PASSWORD; delete process.env.MAIL_FROM;
    }
  });
});
