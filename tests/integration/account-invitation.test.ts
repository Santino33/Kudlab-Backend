import { beforeEach, describe, expect, it } from 'vitest';
import { capturedMail } from '../../src/modules/usuarios/invitations.mailer.js';
import { db } from '../../src/db/client.js';
import { invitations } from '../../src/db/schema/accounts.js';
import { eq, sql } from 'drizzle-orm';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { SMTPServer } from 'smtp-server';
import type { AddressInfo } from 'node:net';
import { login, request, reset } from '../helpers.js';

describe('US1: unicidad y vigencia', () => {
  beforeEach(reset);
  it('alta concurrente crea una sola cuenta', async () => {
    const headers = await login();
    const payload = { name: 'Docente', email: 'DOCENTE@Pilot.edu.co', role: 'TEACHER' };
    const responses = await Promise.all([request('/api/v1/accounts', 'POST', payload, headers), request('/api/v1/accounts', 'POST', payload, headers)]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  });
  it('contraseña inválida no consume y expira al séptimo día', async () => {
    const headers = await login();
    expect((await request('/api/v1/accounts', 'POST', { name: 'Docente', email: 'docente@pilot.edu.co', role: 'TEACHER' }, headers)).status).toBe(201);
    const token = new URL(capturedMail[0]!.url).searchParams.get('token');
    const id = (await (await request('/api/v1/accounts', 'GET', undefined, headers)).json()).items.find((item: { email: string }) => item.email === 'docente@pilot.edu.co').id;
    expect(JSON.stringify(await (await request(`/api/v1/accounts/${id}/audit`, 'GET', undefined, headers)).json())).not.toContain(token);
    for (const password of ['Aa1', 'password123', 'PASSWORD123', 'PasswordOnly'])
      expect((await request('/api/v1/account-invitations/accept', 'POST', { token, password })).status).toBe(400);
    await db.update(invitations).set({ createdAt: new Date(Date.now() - 7 * 86400000), expiresAt: new Date(Date.now() - 7 * 86400000 + 7 * 86400000) }).where(eq(invitations.emailNormalized, 'docente@pilot.edu.co'));
    expect((await request('/api/v1/account-invitations/accept', 'POST', { token, password: 'ValidPass1' })).status).toBe(410);
  });
  it('fallo SMTP conserva cuenta y entrega ERROR sin exponer secreto', async () => {
    const headers = await login();
    process.env.MAIL_MODE = 'smtp';
    process.env.MAIL_HOST = '127.0.0.1';
    process.env.MAIL_PORT = '1';
    process.env.MAIL_USER = 'test';
    process.env.MAIL_PASSWORD = 'test';
    process.env.MAIL_FROM = 'noreply@pilot.edu.co';
    try {
      expect((await request('/api/v1/accounts', 'POST', { name: 'Docente', email: 'failed@pilot.edu.co', role: 'TEACHER' }, headers)).status).toBe(503);
      const list = await (await request('/api/v1/accounts', 'GET', undefined, headers)).json();
      expect(list.items.find((item: { email: string }) => item.email === 'failed@pilot.edu.co')).toMatchObject({ status: 'PENDIENTE', deliveryStatus: 'ERROR' });
    } finally {
      process.env.MAIL_MODE = 'capture';
      delete process.env.MAIL_HOST; delete process.env.MAIL_PORT; delete process.env.MAIL_USER;
      delete process.env.MAIL_PASSWORD; delete process.env.MAIL_FROM;
    }
    const pending = (await (await request('/api/v1/accounts', 'GET', undefined, headers)).json()).items.find((item: { email: string }) => item.email === 'failed@pilot.edu.co');
    expect((await request(`/api/v1/accounts/${pending.id}`, 'PATCH', { email: pending.email }, headers)).status).toBe(200);
    const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
    expect((await request('/api/v1/account-invitations/accept', 'POST', { token, password: 'ValidPass1' })).status).toBe(200);
  });
  it('marca ENVIADA únicamente si el servidor SMTP acepta el mensaje', async () => {
    let delivered = '';
    const server = new SMTPServer({ disabledCommands: ['STARTTLS'],
      onAuth(auth, _session, callback) { callback(null, { user: auth.username }); },
      onData(stream, _session, callback) {
        stream.on('data', (chunk: Buffer) => { delivered += chunk.toString(); });
        stream.on('end', () => callback());
      },
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.server.address() as AddressInfo).port;
    const admin = await login();
    Object.assign(process.env, { MAIL_MODE: 'smtp', MAIL_HOST: '127.0.0.1', MAIL_PORT: String(port),
      MAIL_USER: 'local-test', MAIL_PASSWORD: 'local-test', MAIL_FROM: 'noreply@pilot.edu.co' });
    try {
      const response = await request('/api/v1/accounts', 'POST', { name: 'Docente', email: 'smtp@pilot.edu.co', role: 'TEACHER' }, admin);
      expect(response.status).toBe(201);
      expect((await response.json()).deliveryStatus).toBe('ENVIADA');
      expect(delivered).toContain('smtp@pilot.edu.co');
    } finally {
      process.env.MAIL_MODE = 'capture';
      delete process.env.MAIL_HOST; delete process.env.MAIL_PORT; delete process.env.MAIL_USER;
      delete process.env.MAIL_PASSWORD; delete process.env.MAIL_FROM;
      server.close();
    }
  });
  it('correo de cuenta inactiva no se reutiliza y token ajeno no activa', async () => {
    const headers = await login();
    const created = await (await request('/api/v1/accounts', 'POST', { name: 'Docente', email: 'taken@pilot.edu.co', role: 'TEACHER' }, headers)).json();
    expect((await request('/api/v1/account-invitations/accept', 'POST', { token: 'otro-token', password: 'ValidPass1' })).status).toBe(410);
    const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
    expect((await request('/api/v1/account-invitations/accept', 'POST', { token, password: 'ValidPass1' })).status).toBe(200);
    expect((await request(`/api/v1/accounts/${created.id}/deactivate`, 'POST', { confirm: true }, headers)).status).toBe(200);
    expect((await request('/api/v1/accounts', 'POST', { name: 'Otro', email: 'taken@pilot.edu.co', role: 'TEACHER' }, headers)).status).toBe(409);
    expect((await db.select().from(userAccounts).where(eq(userAccounts.emailNormalized, 'taken@pilot.edu.co')))).toHaveLength(1);
  });
  it('si SMTP aceptó el mensaje pero falla guardar ENVIADA, no informa falsamente ERROR', async () => {
    const headers = await login();
    try {
      await db.execute(sql`create function fail_sent_status_test() returns trigger as $$ begin if new.delivery_status = 'ENVIADA' then raise exception 'storage unavailable'; end if; return new; end $$ language plpgsql`);
      await db.execute(sql`create trigger fail_sent_status before update on account_invitations for each row execute function fail_sent_status_test()`);
      expect((await request('/api/v1/accounts', 'POST', { name: 'Docente', email: 'persist@pilot.edu.co', role: 'TEACHER' }, headers)).status).toBe(503);
      expect(capturedMail.at(-1)?.to).toBe('persist@pilot.edu.co');
      const [invitation] = await db.select().from(invitations).where(eq(invitations.emailNormalized, 'persist@pilot.edu.co'));
      expect(invitation?.deliveryStatus).toBe('PENDIENTE');
      const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
      expect((await request('/api/v1/account-invitations/accept', 'POST', { token, password: 'ValidPass1' })).status).toBe(200);
    } finally {
      await db.execute(sql`drop trigger if exists fail_sent_status on account_invitations`);
      await db.execute(sql`drop function if exists fail_sent_status_test()`);
    }
  });
});
