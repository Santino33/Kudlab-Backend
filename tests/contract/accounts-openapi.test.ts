import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import type { FormatsPlugin } from 'ajv-formats';
import { beforeEach } from 'vitest';
import { capturedMail } from '../../src/modules/usuarios/invitations/invitations.mailer.js';
import { login, request, reset } from '../helpers.js';

const spec = parse(readFileSync('specs/001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml', 'utf8'));
const profileSpec = parse(readFileSync('specs/002-validar-perfil-acceso/contracts/validation.openapi.yaml', 'utf8'));
const validator = new Ajv2020({ strict: false, allErrors: true });
(addFormatsModule as unknown as FormatsPlugin)(validator);

async function matchesContract(path: string, method: string, response: Response) {
  const entry = spec.paths[path][method].responses[String(response.status)];
  expect(entry, `${method.toUpperCase()} ${path} HTTP ${response.status} no documentado`).toBeDefined();
  const resolved = entry.$ref ? entry.$ref.slice(2).split('/').reduce((value: unknown, key: string) =>
    (value as Record<string, unknown>)[key], spec) : entry;
  const schema = resolved.content?.['application/json']?.schema;
  expect(schema, `${method.toUpperCase()} ${path} HTTP ${response.status} sin esquema`).toBeDefined();
  const verify = validator.compile({ ...schema, components: spec.components });
  const body = await response.json();
  expect(verify(body), JSON.stringify(verify.errors)).toBe(true);
  return body;
}

async function matchesProfileContract(path: string, method: string, response: Response) {
  const entry = profileSpec.paths[path][method].responses[String(response.status)];
  expect(entry, `${method.toUpperCase()} ${path}: HTTP ${response.status} sin contrato de perfil`).toBeDefined();
  const resolved = entry.$ref ? entry.$ref.slice(2).split('/').reduce((value: unknown, key: string) =>
    (value as Record<string, unknown>)[key], profileSpec) : entry;
  const verify = validator.compile({ ...resolved.content['application/json'].schema, components: profileSpec.components });
  const body = await response.json();
  expect(verify(body), JSON.stringify(verify.errors)).toBe(true);
  return body;
}

it('OpenAPI documenta todas las rutas y respuestas implementadas', () => {
  const expected: Record<string, string[]> = {
    '/api/v1/accounts': ['get', 'post'], '/api/v1/accounts/{id}': ['get', 'patch'],
    '/api/v1/accounts/{id}/audit': ['get'], '/api/v1/accounts/{id}/role': ['put'],
    '/api/v1/accounts/{id}/deactivate': ['post'], '/api/v1/accounts/{id}/reactivate': ['post'],
    '/api/v1/admin-role-requests': ['get', 'post'], '/api/v1/admin-role-requests/{id}/approve': ['post'],
    '/api/v1/admin-role-requests/{id}/reject': ['post'], '/api/v1/account-invitations/accept': ['post'],
    '/api/v1/account-email-changes/confirm': ['post'],
  };
  expect(Object.keys(spec.paths).sort()).toEqual(Object.keys(expected).sort());
  const implemented = new Set(app.routes.filter((route) => route.method !== 'ALL' && route.path.startsWith('/api/v1/'))
    .map((route) => `${route.method.toLowerCase()} ${route.path.replace(/:id\b/g, '{id}')}`));
  for (const [path, methods] of Object.entries(expected)) for (const method of methods) {
    expect(implemented.has(`${method} ${path}`), `${method.toUpperCase()} ${path} falta en Hono`).toBe(true);
    const responses = spec.paths[path][method].responses;
    expect(Object.keys(responses).some((code) => code.startsWith('2'))).toBe(true);
    expect(Object.values(responses).every((response) => typeof response === 'object' && response !== null && ('$ref' in response || 'content' in response))).toBe(true);
  }
});

beforeEach(reset);

it('valida respuestas y errores HTTP contra los esquemas OpenAPI', async () => {
  const base = '/api/v1/accounts';
  await matchesContract(base, 'get', await request(base, 'GET'));
  const admin = await login();
  const invalid = await request(base, 'POST', { name: 'X', email: 'wrong@other.org', role: 'TEACHER' }, admin);
  expect(invalid.status).toBe(400);
  await matchesContract(base, 'post', invalid);
  const created = await matchesContract(base, 'post', await request(base, 'POST',
    { name: 'Docente', email: 'contract@pilot.edu.co', role: 'TEACHER' }, admin));
  await matchesContract(base, 'get', await request(base, 'GET', undefined, admin));
  await matchesContract(`${base}/{id}`, 'get', await request(`${base}/${created.id}`, 'GET', undefined, admin));
  await matchesContract(`${base}/{id}/audit`, 'get', await request(`${base}/${created.id}/audit`, 'GET', undefined, admin));
  const duplicate = await request(base, 'POST', { name: 'Docente', email: 'contract@pilot.edu.co', role: 'TEACHER' }, admin);
  expect(duplicate.status).toBe(409);
  await matchesContract(base, 'post', duplicate);
  const forbidden = await request(base, 'GET', undefined, { authorization: 'Bearer invalid' });
  expect(forbidden.status).toBe(401);
  await matchesContract(base, 'get', forbidden);
  const missing = await request(`${base}/00000000-0000-4000-8000-000000000001`, 'GET', undefined, admin);
  expect(missing.status).toBe(404);
  await matchesContract(`${base}/{id}`, 'get', missing);
  const invalidToken = await request('/api/v1/account-invitations/accept', 'POST', { token: 'invalid', password: 'ValidPass1' });
  expect(invalidToken.status).toBe(410);
  await matchesContract('/api/v1/account-invitations/accept', 'post', invalidToken);
  const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
  await matchesContract('/api/v1/account-invitations/accept', 'post',
    await request('/api/v1/account-invitations/accept', 'POST', { token, password: 'ValidPass1' }));
  const teacher = await login('contract@pilot.edu.co', 'ValidPass1');
  const teacherForbidden = await request(base, 'GET', undefined, teacher);
  expect(teacherForbidden.status).toBe(403);
  await matchesContract(base, 'get', teacherForbidden);
  const promotion = await matchesContract('/api/v1/admin-role-requests', 'post',
    await request('/api/v1/admin-role-requests', 'POST', undefined, teacher));
  await matchesContract('/api/v1/admin-role-requests', 'get',
    await request('/api/v1/admin-role-requests', 'GET', undefined, teacher));
  await matchesContract('/api/v1/admin-role-requests/{id}/approve', 'post',
    await request(`/api/v1/admin-role-requests/${promotion.id}/approve`, 'POST', undefined, admin));
  await matchesContract(`${base}/{id}/role`, 'put',
    await request(`${base}/${created.id}/role`, 'PUT', { role: 'TEACHER' }, admin));
  await matchesContract(`${base}/{id}/deactivate`, 'post',
    await request(`${base}/${created.id}/deactivate`, 'POST', { confirm: true }, admin));
  await matchesContract(`${base}/{id}/reactivate`, 'post',
    await request(`${base}/${created.id}/reactivate`, 'POST', { confirm: true }, admin));
  Object.assign(process.env, { MAIL_MODE: 'smtp', MAIL_HOST: 'localhost', MAIL_PORT: '1',
    MAIL_USER: 'test', MAIL_PASSWORD: 'test', MAIL_FROM: 'noreply@pilot.edu.co' });
  try {
    const unavailable = await request(base, 'POST',
      { name: 'No entregada', email: 'delivery@pilot.edu.co', role: 'TEACHER' }, admin);
    expect(unavailable.status).toBe(503);
    await matchesContract(base, 'post', unavailable);
  } finally {
    process.env.MAIL_MODE = 'capture';
    delete process.env.MAIL_HOST; delete process.env.MAIL_PORT; delete process.env.MAIL_USER;
    delete process.env.MAIL_PASSWORD; delete process.env.MAIL_FROM;
  }
});

it('valida el subconjunto 002 sin sustituir los recorridos de cuentas de 001', async () => {
  const admin = await login();
  const base = '/api/v1/accounts';
  const invalid = await matchesProfileContract(base, 'post',
    await request(base, 'POST', { name: ' ', email: 'docente@pilot.edu.co', role: 'TEACHER' }, admin));
  expect(invalid.fields).toEqual([{ field: 'name', reason: expect.any(String) }]);
  const created = await matchesProfileContract(base, 'post',
    await request(base, 'POST', { name: 'Docente', email: 'docente@pilot.edu.co', role: 'TEACHER' }, admin));
  expect(created.status).toBe('PENDIENTE');
  const duplicate = await matchesProfileContract(base, 'post',
    await request(base, 'POST', { name: 'Otra', email: 'docente@pilot.edu.co', role: 'TEACHER' }, admin));
  expect(duplicate.code).toBe('CONFLICT');
  expect(JSON.stringify(duplicate)).not.toContain('docente@pilot.edu.co');
  const changed = await matchesProfileContract('/api/v1/accounts/{id}', 'patch',
    await request(`${base}/${created.id}`, 'PATCH', { name: 'Docente Dos' }, admin));
  expect(changed.name).toBe('Docente Dos');
  const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
  const invalidPassword = await matchesProfileContract('/api/v1/account-invitations/accept', 'post',
    await request('/api/v1/account-invitations/accept', 'POST', { token, password: 'a' }));
  expect(invalidPassword.fields).toEqual([{ field: 'password', reason: expect.any(String) }]);
  const accepted = await matchesProfileContract('/api/v1/account-invitations/accept', 'post',
    await request('/api/v1/account-invitations/accept', 'POST', { token, password: 'ValidPass1' }));
  expect(accepted.status).toBe('ACTIVA');
});
