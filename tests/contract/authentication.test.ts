import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
import { once } from 'node:events';
import { serve } from '@hono/node-server';
import type { AddressInfo } from 'node:net';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { app } from '../../src/app.js';
import { session as authSession } from '../../src/db/schema/auth.js';
import { inviteTeacher, login, request, reset } from '../helpers.js';

const spec = parse(readFileSync('specs/003-autenticar-usuarios/contracts/auth.openapi.yaml', 'utf8'));
const validator = new Ajv2020({ strict: false });
(addFormatsModule as unknown as FormatsPlugin)(validator);
async function assertContract(path: string, method: string, response: Response) {
  const declared = spec.paths[path][method].responses[String(response.status)];
  expect(declared).toBeDefined();
  const entry = declared.$ref ? declared.$ref.slice(2).split('/').reduce((v: unknown, key: string) =>
    (v as Record<string, unknown>)[key], spec) : declared;
  const verify = validator.compile({ ...entry.content['application/json'].schema, components: spec.components });
  const body = await response.json();
  expect(verify(body), JSON.stringify(verify.errors)).toBe(true);
  return body;
}

describe('contrato de autenticación del personal', () => {
  beforeEach(reset);

  it('expone identidad propia y rol vigente tras el ingreso, sin campos sensibles', async () => {
    const response = await request('/api/auth/sign-in/email', 'POST', {
      email: 'admin@pilot.edu.co', password: 'TestingA123',
    });
    expect(response.status).toBe(200);
    const credential = response.headers.get('set-auth-token');
    expect(credential || response.headers.get('set-cookie')).toBeTruthy();
    const body = await response.json();
    expect(body.user).toMatchObject({ email: 'admin@pilot.edu.co', role: 'ADMIN' });
    expect(JSON.stringify(body)).not.toContain('TestingA123');
    const session = await request('/api/auth/get-session', 'GET', undefined, await login());
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({ user: { email: 'admin@pilot.edu.co', role: 'ADMIN' },
      session: { id: expect.any(String), expiresAt: expect.any(String) } });
  });

  it('deniega ingreso con error idéntico para credencial errónea, desconocida, pendiente e inactiva', async () => {
    await request('/api/v1/accounts', 'POST', { name: 'Pendiente', email: 'pending@pilot.edu.co', role: 'TEACHER' }, await login());
    const { account } = await inviteTeacher();
    await db.update(userAccounts).set({ status: 'INACTIVA' }).where(eq(userAccounts.id, account.id));
    const attempts = [
      ['missing@pilot.edu.co', 'TestingA123'], ['admin@pilot.edu.co', 'WrongPass123'],
      ['pending@pilot.edu.co', 'TeacherPass1'], ['teacher@pilot.edu.co', 'TeacherPass1'],
    ];
    const results = await Promise.all(attempts.map(async ([email, password]) => {
      const response = await request('/api/auth/sign-in/email', 'POST', { email, password });
      expect(response.headers.get('set-auth-token')).toBeNull();
      return { status: response.status, body: await response.json() };
    }));
    expect(results).toEqual(Array(4).fill({ status: 401,
      body: { code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' } }));
  });

  it('rechaza consulta sin sesión y no revela una cuenta desactivada con credencial previa', async () => {
    expect((await request('/api/auth/get-session', 'GET')).status).toBe(401);
    const { account, teacher } = await inviteTeacher();
    await db.update(userAccounts).set({ status: 'INACTIVA' }).where(eq(userAccounts.id, account.id));
    const response = await request('/api/auth/get-session', 'GET', undefined, teacher);
    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).not.toContain('teacher@pilot.edu.co');
  });

  it('cierra solo la sesión presentada y la consulta posterior no la reabre', async () => {
    const credential = await login();
    const closed = await request('/api/auth/sign-out', 'POST', undefined, credential);
    expect(closed.status).toBe(200);
    expect(await closed.json()).toEqual({ success: true });
    expect((await request('/api/auth/get-session', 'GET', undefined, credential)).status).toBe(401);
  });

  it('no prolonga por consulta una sesión inactiva aunque la expiración interna sea futura', async () => {
    const credential = await login();
    const { session: current } = await (await request('/api/auth/get-session', 'GET', undefined, credential)).json();
    await db.update(authSession).set({ createdAt: new Date(Date.now() - 1_800_000),
      expiresAt: new Date(Date.now() + 1_800_000) }).where(eq(authSession.id, current.id));
    const response = await request('/api/auth/get-session', 'GET', undefined, credential);
    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).not.toContain('admin@pilot.edu.co');
  });

  it('valida las respuestas de ingreso, consulta y cierre con OpenAPI y sin secretos', async () => {
    const signIn = '/api/auth/sign-in/email';
    const bad = await assertContract(signIn, 'post', await request(signIn, 'POST', { email: 'bad', password: 'A' }));
    expect(bad).not.toHaveProperty('password');
    const invalid = await assertContract(signIn, 'post', await request(signIn, 'POST',
      { email: 'admin@pilot.edu.co', password: 'WrongPass123' }));
    expect(JSON.stringify(invalid)).not.toContain('WrongPass123');
    const credential = await login();
    const session = await assertContract('/api/auth/get-session', 'get',
      await request('/api/auth/get-session', 'GET', undefined, credential));
    expect(session.user.role).toBe('ADMIN');
    await assertContract('/api/auth/sign-out', 'post', await request('/api/auth/sign-out', 'POST', undefined, credential));
    await assertContract('/api/auth/get-session', 'get',
      await request('/api/auth/get-session', 'GET', undefined, credential));
    await assertContract(signIn, 'post', await request(signIn, 'POST',
      { email: 'admin@pilot.edu.co', password: 'TestingA123' }));
  });

  it('permite cerrar mediante HTTP real sin cuerpo, tal como indica el contrato', async () => {
    const credential = await login();
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
    if (!server.listening) await once(server, 'listening');
    try {
      const address = server.address() as AddressInfo;
      const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/sign-out`,
        { method: 'POST', headers: credential });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ success: true });
      expect((await request('/api/auth/get-session', 'GET', undefined, credential)).status).toBe(401);
    } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  });
});
