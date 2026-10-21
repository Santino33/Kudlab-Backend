import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { capturedMail } from '../../src/modules/usuarios/invitations/invitations.mailer.js';
import { inviteTeacher, login, request, reset } from '../helpers.js';

const start = (email: string) => request('/api/v1/auth/password-recovery/request', 'POST', { email });
const finish = (token: string, newPassword: string) =>
  request('/api/v1/auth/password-recovery/confirm', 'POST', { token, newPassword });
const contract = parse(readFileSync('specs/003-autenticar-usuarios/contracts/auth.openapi.yaml', 'utf8'));
const validator = new Ajv2020({ strict: false });
(addFormatsModule as unknown as FormatsPlugin)(validator);
async function matches(path: string, response: Response) {
  const declared = contract.paths[path].post.responses[String(response.status)];
  expect(declared).toBeDefined();
  const entry = declared.$ref ? declared.$ref.slice(2).split('/').reduce((v: unknown, key: string) =>
    (v as Record<string, unknown>)[key], contract) : declared;
  const verify = validator.compile({ ...entry.content['application/json'].schema, components: contract.components });
  const body = await response.json();
  expect(verify(body), JSON.stringify(verify.errors)).toBe(true);
  return body;
}

describe('contrato de recuperación de acceso', () => {
  beforeEach(reset);

  it('responde igual para cuentas desconocidas, pendientes, inactivas y activas', async () => {
    await request('/api/v1/accounts', 'POST', { name: 'Pendiente', email: 'pending@pilot.edu.co', role: 'TEACHER' }, await login());
    const { account } = await inviteTeacher('inactive@pilot.edu.co');
    await db.update(userAccounts).set({ status: 'INACTIVA' }).where(eq(userAccounts.id, account.id));
    capturedMail.length = 0;
    const results = await Promise.all(['missing@pilot.edu.co', 'pending@pilot.edu.co',
      'inactive@pilot.edu.co', 'admin@pilot.edu.co'].map(async (email) => {
      const response = await start(email);
      return { status: response.status, body: await response.json() };
    }));
    expect(results).toEqual(Array(4).fill({ status: 202,
      body: { message: 'Si corresponde, recibirás instrucciones en tu correo.' } }));
    expect(capturedMail).toHaveLength(1);
    expect(capturedMail[0]?.to).toBe('admin@pilot.edu.co');
  });

  it('valida token y contraseña sin revelar cuenta ni consumir un enlace por error de formato', async () => {
    expect((await finish('inexistente', 'NewPass123')).status).toBe(410);
    expect((await start('admin@pilot.edu.co')).status).toBe(202);
    const token = new URL(capturedMail[0]!.url).searchParams.get('token')!;
    expect((await finish(token, 'invalid')).status).toBe(400);
    const valid = await finish(token, 'NewPass123');
    expect(valid.status).toBe(200);
    expect(await valid.json()).toEqual({ success: true });
    const spent = await finish(token, 'OtherPass123');
    expect(spent.status).toBe(410);
    expect(JSON.stringify(await spent.json())).not.toContain('admin@pilot.edu.co');
  });

  it('conserva cerrada la superficie nativa de reset y el registro público', async () => {
    for (const path of ['/api/auth/request-password-reset', '/api/auth/reset-password', '/api/auth/sign-up/email'])
      expect((await request(path, 'POST', {})).status).toBe(403);
  });

  it('valida con OpenAPI los dos flujos y errores sin revelar enlace ni contraseña', async () => {
    const requestPath = '/api/v1/auth/password-recovery/request';
    const confirmPath = '/api/v1/auth/password-recovery/confirm';
    await matches(requestPath, await start('missing@pilot.edu.co'));
    await matches(requestPath, await start('admin@pilot.edu.co'));
    const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token')!;
    await matches(confirmPath, await finish('bad', 'ChangedPass123'));
    const invalid = await matches(confirmPath, await finish(token, 'weak'));
    expect(JSON.stringify(invalid)).not.toContain(token);
    const changed = await matches(confirmPath, await finish(token, 'ChangedPass123'));
    expect(changed).toEqual({ success: true });
  });

  it('una caída del correo no identifica si la cuenta existe ni crea acceso', async () => {
    Object.assign(process.env, { MAIL_MODE: 'smtp', MAIL_HOST: '127.0.0.1', MAIL_PORT: '1',
      MAIL_USER: 'test', MAIL_PASSWORD: 'test', MAIL_FROM: 'noreply@pilot.edu.co' });
    try {
      const active = await matches('/api/v1/auth/password-recovery/request', await start('admin@pilot.edu.co'));
      const missing = await matches('/api/v1/auth/password-recovery/request', await start('missing@pilot.edu.co'));
      expect(active).toEqual(missing);
      expect(capturedMail).toHaveLength(0);
    } finally {
      process.env.MAIL_MODE = 'capture';
      delete process.env.MAIL_HOST; delete process.env.MAIL_PORT;
      delete process.env.MAIL_USER; delete process.env.MAIL_PASSWORD; delete process.env.MAIL_FROM;
    }
  });
});
