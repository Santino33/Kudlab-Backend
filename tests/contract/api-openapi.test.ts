import { beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { app } from '../../src/app.js';
import { capturedMail } from '../../src/modules/usuarios/invitations/invitations.mailer.js';
import { db } from '../../src/db/client.js';
import { groups } from '../../src/db/schema/academic.js';
import { academicFixture, login, request, reset } from '../helpers.js';
import { assertResponse, operations, readContract, resolve } from '../openapi.helpers.js';

const spec = () => readContract();
beforeEach(reset);
it('contrasta igualdad con montajes reales y lista blanca auth', () => {
  const allowed = ['post /api/auth/sign-in/email', 'post /api/auth/sign-out', 'get /api/auth/get-session', 'get /api/auth/jwks', 'get /api/auth/token'];
  const mounted = app.routes.filter((r) => r.method !== 'ALL' && r.path.startsWith('/api/v1/'))
    .map((r) => `${r.method.toLowerCase()} ${r.path.replace(/:(\w+)/g, '{$1}').replace(/\/$/, '')}`);
  expect(operations(spec()).map(([p, m]) => `${m} ${p}`).sort()).toEqual([...new Set([...mounted, ...allowed])].sort());
});

it('valida éxitos de todas las operaciones y errores de cada dominio contra el catálogo canónico', async () => {
  const doc = spec();
  const successes = new Set<string>();
  async function check(path: string, method: string, response: Response, status: number) {
    expect(response.status, `${method} ${path}`).toBe(status);
    if (response.ok) successes.add(`${method.toLowerCase()} ${path}`);
    return assertResponse(doc, path, method, response);
  }
  const signIn = await request('/api/auth/sign-in/email', 'POST', { email: 'admin@pilot.edu.co', password: 'TestingA123' });
  expect(signIn.headers.get('set-auth-token')).toBeTruthy();
  await check('/api/auth/sign-in/email', 'POST', signIn, 200);
  const admin = await login();
  await check('/api/v1/tasks', 'GET', await request('/api/v1/tasks', 'GET', undefined, admin), 200);
  await check('/api/v1/tasks/{taskId}', 'GET', await request('/api/v1/tasks/TG-01', 'GET', undefined, admin), 200);
  for (const path of ['/api/auth/get-session', '/api/auth/jwks', '/api/auth/token'])
    await check(path, 'GET', await request(path, 'GET', undefined, admin), 200);
  const base = '/api/v1/accounts';
  await check(base, 'GET', await request(base, 'GET'), 401);
  await check(base, 'POST', await request(base, 'POST', {}, admin), 400);
  const account = await check(base, 'POST', await request(base, 'POST', { name: 'Docente Ficticio', email: 'canonical@pilot.edu.co', role: 'TEACHER' }, admin), 201);
  await check(base, 'POST', await request(base, 'POST', { name: 'Docente Ficticio', email: account.email, role: 'TEACHER' }, admin), 409);
  const invitation = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
  const invite = '/api/v1/account-invitations/accept';
  await check(invite, 'POST', await request(invite, 'POST', { token: 'not-active', password: 'FicticioA123' }), 410);
  await check(invite, 'POST', await request(invite, 'POST', { token: invitation, password: 'FicticioA123' }), 200);
  let teacher = await login(account.email, 'FicticioA123');
  await check(base, 'GET', await request(base, 'GET', undefined, admin), 200);
  await check(`${base}/{id}`, 'GET', await request(`${base}/${account.id}`, 'GET', undefined, admin), 200);
  await check(`${base}/{id}/audit`, 'GET', await request(`${base}/${account.id}/audit`, 'GET', undefined, admin), 200);
  await check(`${base}/{id}`, 'PATCH', await request(`${base}/${account.id}`, 'PATCH', { name: 'Docente Ejemplo', email: 'changed@pilot.edu.co' }, admin), 200);
  const emailToken = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
  const emailConfirm = '/api/v1/account-email-changes/confirm';
  await check(emailConfirm, 'POST', await request(emailConfirm, 'POST', { token: emailToken }), 200);
  teacher = await login('changed@pilot.edu.co', 'FicticioA123');
  const recovery = '/api/v1/auth/password-recovery';
  await check(`${recovery}/request`, 'POST', await request(`${recovery}/request`, 'POST', { email: 'changed@pilot.edu.co' }), 202);
  const resetToken = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
  await check(`${recovery}/confirm`, 'POST', await request(`${recovery}/confirm`, 'POST', { token: resetToken, newPassword: 'NuevoFicticio123' }), 200);
  teacher = await login('changed@pilot.edu.co', 'NuevoFicticio123');
  const [group] = await db.insert(groups).values({ teacherId: account.id, name: 'Grupo sintético', grade: '3', schoolYear: 2026 }).returning();
  const courses = '/api/v1/groups';
  const course = await check(courses, 'POST', await request(courses, 'POST', { teacherId: account.id, name: 'Curso ficticio', grade: '3', schoolYear: 2026 }, admin), 201);
  await check(courses, 'GET', await request(courses, 'GET', undefined, teacher), 200);
  await check(`${courses}/teachers`, 'GET', await request(`${courses}/teachers`, 'GET', undefined, admin), 200);
  await check(`${courses}/{id}`, 'GET', await request(`${courses}/${course.id}`, 'GET', undefined, teacher), 200);
  await check(`${courses}/{id}`, 'PATCH', await request(`${courses}/${course.id}`, 'PATCH', { name: 'Curso corregido' }, admin), 200);
  await check(`${courses}/{id}/students`, 'GET', await request(`${courses}/${course.id}/students`, 'GET', undefined, teacher), 200);
  await check(`${courses}/{id}`, 'DELETE', await request(`${courses}/${course.id}`, 'DELETE', undefined, admin), 200);
  const students = '/api/v1/students';
  const student = await check(students, 'POST', await request(students, 'POST', { groupId: group!.id, studentCode: 'SYN-006', firstName: 'Participante', lastName: 'Ficticio' }, teacher), 201);
  await check(students, 'GET', await request(students, 'GET', undefined, teacher), 200);
  await check(students, 'GET', await request(`${students}?limit=1`, 'GET', undefined, teacher), 400);
  await check(students, 'GET', await request(students, 'GET', undefined, admin), 403);
  await check(`${students}/{id}`, 'GET', await request(`${students}/bad`, 'GET', undefined, teacher), 404);
  await check(`${students}/{id}`, 'GET', await request(`${students}/${student.id}`, 'GET', undefined, teacher), 200);
  await check(`${students}/{id}`, 'PATCH', await request(`${students}/${student.id}`, 'PATCH', { firstName: 'Ejemplo' }, teacher), 200);
  await check(`${students}/{id}/deactivate`, 'POST', await request(`${students}/${student.id}/deactivate`, 'POST', undefined, teacher), 200);
  const roles = '/api/v1/admin-role-requests';
  const role = await check(roles, 'POST', await request(roles, 'POST', undefined, teacher), 201);
  await check(roles, 'GET', await request(roles, 'GET', undefined, admin), 200);
  await check(`${roles}/{id}/reject`, 'POST', await request(`${roles}/${role.id}/reject`, 'POST', undefined, admin), 200);
  const second = await request(roles, 'POST', undefined, teacher);
  const secondRole = await second.json();
  await check(`${roles}/{id}/approve`, 'POST', await request(`${roles}/${secondRole.id}/approve`, 'POST', undefined, admin), 200);
  await check(`${base}/{id}/role`, 'PUT', await request(`${base}/${account.id}/role`, 'PUT', { role: 'TEACHER' }, admin), 200);
  await check(`${base}/{id}/deactivate`, 'POST', await request(`${base}/${account.id}/deactivate`, 'POST', { confirm: true }, admin), 200);
  await check(`${base}/{id}/reactivate`, 'POST', await request(`${base}/${account.id}/reactivate`, 'POST', { confirm: true }, admin), 200);
  await check('/api/auth/sign-out', 'POST', await request('/api/auth/sign-out', 'POST', undefined, await login()), 200);
  // J-02 validates its real responses separately with the isolated participation provider.
  expect([...successes].sort()).toEqual(operations(doc).filter(([, , op]) => !op.tags.some((tag: string) => ['Actividades', 'Runtime', 'Accesos'].includes(tag))).map(([p, m]) => `${m} ${p}`).sort());
});

it('documenta el código real de cada token vencido, no copia un ejemplo de otro flujo', () => {
  const doc = spec();
  for (const [path, code] of [
    ['/api/v1/account-invitations/accept', 'INVITATION_EXPIRED'],
    ['/api/v1/account-email-changes/confirm', 'TOKEN_EXPIRED'],
    ['/api/v1/auth/password-recovery/confirm', 'VERIFICATION_EXPIRED'],
  ]) expect(resolve(doc, doc.paths[path!].post.responses['410']).content['application/json'].example.code).toBe(code);
});

it('valida fallos de sesión, rol, ámbito, entradas y tokens sin revelar datos ajenos', async () => {
  const doc = spec();
  const { a, b, aGroups } = await academicFixture();
  const admin = a.admin;
  const check = async (path: string, method: string, response: Response, status: number) => {
    expect(response.status, `${method} ${path}`).toBe(status);
    return assertResponse(doc, path, method, response);
  };
  for (const [path, method, op] of operations(doc)) {
    // Runtime credentials/origins are independent, exercised in game-integration/access-codes tests.
    if (path.startsWith('/api/v1/game-runtime/')) continue;
    const concrete = path.replace('{id}', randomUUID()).replace('{taskId}', 'TG-01');
    if (op.security.length) await check(path, method, await request(concrete, method.toUpperCase()), 401);
    else if (method === 'post') {
      await check(path, method, await request(concrete, 'POST', {}), 400);
    }
    if (op.tags[0] === 'Cuentas') await check(path, method, await request(concrete, method.toUpperCase(), undefined, a.teacher), 403);
    if (op.tags[0] === 'Estudiantes') await check(path, method, await request(concrete, method.toUpperCase(), undefined, admin), 403);
  }
  for (const [path, body] of [
    ['/api/v1/account-invitations/accept', { token: 'invalid', password: 'DemoFicticia123' }],
    ['/api/v1/account-email-changes/confirm', { token: 'invalid' }],
    ['/api/v1/auth/password-recovery/confirm', { token: 'invalid', newPassword: 'DemoFicticia123' }],
  ] as const) await check(path, 'POST', await request(path, 'POST', body), 410);
  const students = '/api/v1/students';
  const body = { groupId: aGroups[0]!.id, studentCode: 'SYN-ERROR', firstName: 'Participante', lastName: 'Ficticio' };
  const created = await (await request(students, 'POST', body, a.teacher)).json();
  await check(students, 'POST', await request(students, 'POST', body, a.teacher), 409);
  const invalid = await check(students, 'POST', await request(students, 'POST', { ...body, firstName: '' }, a.teacher), 400);
  expect(invalid.fields).toEqual({ firstName: 'required' });
  const foreign = await check(`${students}/{id}`, 'GET', await request(`${students}/${created.id}`, 'GET', undefined, b.teacher), 404);
  const missing = await check(`${students}/{id}`, 'GET', await request(`${students}/${randomUUID()}`, 'GET', undefined, b.teacher), 404);
  expect(foreign).toEqual(missing);
  const jwt = await (await request('/api/auth/token', 'GET', undefined, admin)).json();
  await check('/api/v1/accounts', 'GET', await request('/api/v1/accounts', 'GET', undefined, { authorization: `Bearer ${jwt.token}` }), 401);
  const neuter = await check('/api/v1/auth/password-recovery/request', 'POST', await request('/api/v1/auth/password-recovery/request', 'POST', { email: 'unknown@pilot.edu.co' }), 202);
  expect(neuter.message).toBe('Si corresponde, recibirás instrucciones en tu correo.');
  // Cookie path exercises actual provider origin checks; Bearer does not bypass business guards.
  const signedIn = await request('/api/auth/sign-in/email', 'POST', { email: 'admin@pilot.edu.co', password: 'TestingA123', rememberMe: false });
  const cookies = signedIn.headers.getSetCookie();
  const sessionCookie = cookies.find((cookie) => cookie.startsWith('better-auth.session_token='))!;
  expect(sessionCookie).toContain('HttpOnly');
  expect(sessionCookie).not.toContain('Max-Age=');
  expect(cookies.some((cookie) => cookie.startsWith('better-auth.dont_remember='))).toBe(true);
  const forbiddenOrigin = await app.request('/api/auth/sign-out', { method: 'POST', headers: { cookie: sessionCookie.split(';')[0]!, origin: 'https://invalid.example' } });
  // Better Auth defaults to skipOriginCheck in test. Assert real non-test behavior separately.
  await check('/api/auth/sign-out', 'POST', forbiddenOrigin, 200);
  for (const path of ['/api/auth/sign-up/email', '/api/auth/admin/list-users', '/api/auth/open-api/generate-schema'])
    expect((await request(path, 'POST', {})).status).toBe(403);
});

it('verifica cookies HTTPS, CSRF y rate limit del proveedor fuera del modo test en proceso aislado', async () => {
  const output = execFileSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', `
    const {app} = await import('./src/app.ts');
    const {pool} = await import('./src/db/client.ts');
    try {
      const login = await app.request('/api/auth/sign-in/email', {method:'POST', headers:{'content-type':'application/json',origin:'http://localhost:5173'}, body:JSON.stringify({email:'admin@pilot.edu.co',password:'TestingA123'})});
      const cookies=login.headers.getSetCookie();
      const cookie=cookies.find(c=>c.startsWith('__Secure-better-auth.session_token='));
      const rejected=await app.request('/api/auth/sign-out',{method:'POST',headers:{cookie:cookie.split(';')[0],origin:'https://invalid.example'}});
      const missing=await app.request('/api/auth/sign-out',{method:'POST',headers:{cookie:cookie.split(';')[0]}});
      let limited;
      for(let n=0;n<110;n++) {const res=await app.request('/api/auth/jwks');if(res.status===429){limited=res;break;}}
      console.log(JSON.stringify({cookies,rejected:{status:rejected.status,body:await rejected.json()},missing:{status:missing.status,body:await missing.json()},limited:limited&&{status:limited.status,body:await limited.json(),retry:limited.headers.get('x-retry-after')}}));
    } finally {await pool.end();}
  `], { cwd: new URL('../../', import.meta.url), encoding: 'utf8', timeout: 20000,
    env: { ...process.env, NODE_ENV: 'production', TEST: '', BETTER_AUTH_URL: 'https://localhost:3000',
      MAIL_MODE: 'smtp', MAIL_HOST: 'localhost', MAIL_USER: 'synthetic', MAIL_PASSWORD: 'synthetic', MAIL_FROM: 'no-send@ejemplo.edu.co' } });
  const result = JSON.parse(output.trim().split('\n').at(-1)!);
  const cookie = result.cookies.find((c: string) => c.startsWith('__Secure-better-auth.session_token='));
  expect(cookie).toContain('Secure');
  expect(cookie).toContain('HttpOnly');
  expect(cookie).toContain('Max-Age=1800');
  expect(result.rejected).toMatchObject({ status: 403, body: { code: 'INVALID_ORIGIN' } });
  expect(result.missing).toMatchObject({ status: 403, body: { code: 'MISSING_OR_NULL_ORIGIN' } });
  expect(result.limited).toMatchObject({ status: 429, body: { message: 'Too many requests. Please try again later.' } });
  expect(result.limited.retry).toMatch(/^\d+$/);
  const doc = spec();
  for (const error of [result.rejected, result.missing])
    await assertResponse(doc, '/api/auth/sign-out', 'post', Response.json(error.body, { status: error.status }));
  await assertResponse(doc, '/api/auth/jwks', 'get', Response.json(result.limited.body, { status: 429 }));
});
