import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { tasks, taskPublishedVersions } from '../../src/db/schema/tasks.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { session, user } from '../../src/db/schema/auth.js';
import { taskReadiness } from '../../src/modules/tareas/catalog/catalog.service.js';
import { inviteTeacher, login, request, reset } from '../helpers.js';
import { assertResponse, readContract } from '../openapi.helpers.js';

const base = '/api/v1/tasks';
const seedSql = readFileSync(new URL('../../src/db/migrations/0009_task_catalog.sql', import.meta.url), 'utf8').split('--> statement-breakpoint').at(-1)!;
async function seed() { await db.execute(sql.raw(seedSql)); }

describe('catálogo persistido y proyección autorizada', () => {
  beforeEach(async () => { await reset(); await db.execute(sql`truncate tasks restart identity cascade`); await seed(); });
  afterEach(() => vi.restoreAllMocks());

  it('ADMIN cambia el estado global con revisión, sin confundir habilitación con preparación', async () => {
    const { admin, teacher } = await inviteTeacher();
    const path = `${base}/TG-01/availability`;
    const change = await request(path, 'PATCH', { isEnabled: true, expectedRevision: 1 }, admin);
    expect(change.status).toBe(200);
    const task = await assertResponse(readContract(), `${base}/{taskId}/availability`, 'patch', change);
    expect(task).toMatchObject({ isEnabled: true, revision: 2, assignable: false });
    expect(task.unavailableReasons).not.toContain('TASK_DISABLED');
    expect(await (await request(`${base}/TG-01`, 'GET', undefined, teacher)).json()).toMatchObject(task);
    expect((await request(path, 'PATCH', { isEnabled: true, expectedRevision: 1 }, admin)).status).toBe(409);
    const noop = await request(path, 'PATCH', { isEnabled: true, expectedRevision: 2 }, admin);
    expect(await noop.json()).toMatchObject({ isEnabled: true, revision: 2 });
    const changes = await Promise.all([false, false].map(isEnabled => request(path, 'PATCH', { isEnabled, expectedRevision: 2 }, admin)));
    expect(changes.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await (await request(`${base}/TG-01`, 'GET', undefined, teacher)).json()).toMatchObject({ isEnabled: false, revision: 3 });
  });

  it('mutación deniega roles/origen/entrada inválidos sin alterar la tarea', async () => {
    const { admin, teacher } = await inviteTeacher();
    const path = `${base}/TG-01/availability`, body = { isEnabled: true, expectedRevision: 1 };
    for (const [headers, status] of [[{}, 401], [teacher, 403], [{ ...admin, origin: 'https://foreign.invalid' }, 403], [{ ...admin, origin: '' }, 403]] as const) {
      const response = await request(path, 'PATCH', body, headers);
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    for (const payload of [{}, { ...body, isEnabled: 'true' }, { ...body, expectedRevision: 0 }, { ...body, expectedRevision: 1.5 }, { ...body, integrationReady: true }, { ...body, padding: 'x'.repeat(2000) }]) {
      expect((await request(path, 'PATCH', payload, admin)).status).toBe(400);
    }
    for (const [suffix, status] of [['TG-02/availability', 404], ['invalid/availability', 400], ['TG-01/availability?x=1', 400]] as const)
      expect((await request(`${base}/${suffix}`, 'PATCH', body, admin)).status).toBe(status);
    expect((await request(path, 'PATCH', body, { ...admin, 'content-type': 'text/plain' })).status).toBe(400);
    expect(await (await request(`${base}/TG-01`, 'GET', undefined, admin)).json()).toMatchObject({ isEnabled: false, revision: 1 });
    const [account] = await db.select().from(userAccounts).where(eq(userAccounts.role, 'ADMIN'));
    await db.update(userAccounts).set({ status: 'INACTIVA' }).where(eq(userAccounts.id, account!.id));
    expect((await request(path, 'PATCH', body, admin)).status).toBe(403);
    expect((await db.select().from(tasks))[0]).toMatchObject({ isEnabled: false, revision: 1 });
  });

  it('un fallo transaccional no confirma ni cambia disponibilidad', async () => {
    const admin = await login();
    vi.spyOn(db, 'transaction').mockImplementationOnce(() => { throw new Error('SYNTHETIC_DB_FAILURE'); });
    const response = await request(`${base}/TG-01/availability`, 'PATCH', { isEnabled: true, expectedRevision: 1 }, admin);
    expect(response.status).toBe(503);
    expect((await db.select().from(tasks))[0]).toMatchObject({ isEnabled: false, revision: 1 });
  });

  it('ADMIN y TEACHER activos consultan solo TG-01 y DTO filtrado', async () => {
    const { teacher, admin } = await inviteTeacher();
    const [initial] = await db.select().from(tasks);
    await db.insert(tasks).values({ ...initial!, id: 'TG-02', title: 'Fuera de alcance' });
    for (const actor of [admin, teacher]) {
      const list = await request(base, 'GET', undefined, actor);
      expect(list.status).toBe(200);
      expect(list.headers.get('cache-control')).toBe('no-store');
      const page = await assertResponse(readContract(), base, 'get', list);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]).toMatchObject({ id: 'TG-01', integrationReady: false, isEnabled: false,
        publishedVersion: null, assignable: false, revision: 1,
        unavailableReasons: ['INTEGRATION_PENDING', 'CONFIGURATION_UNPUBLISHED', 'TASK_DISABLED'] });
      expect(Object.keys(page.items[0]).sort()).toEqual(['id', 'title', 'description', 'isEnabled', 'integrationReady', 'publishedVersion', 'assignable', 'unavailableReasons', 'revision'].sort());
      const response = await request(`${base}/TG-01`, 'GET', undefined, actor);
      const detail = await assertResponse(readContract(), `${base}/{taskId}`, 'get', response);
      expect(detail).toEqual({ ...page.items[0], purpose: initial!.purpose, pedagogicalNotice: initial!.pedagogicalNotice });
      expect((await request(`${base}/TG-02`, 'GET', undefined, actor)).status).toBe(404);
    }
  });

  it('seed es idempotente y no sobrescribe disponibilidad ni metadatos existentes', async () => {
    await db.update(tasks).set({ isEnabled: true, revision: 7, title: 'Título persistido' }).where(eq(tasks.id, 'TG-01'));
    await seed(); await seed();
    const rows = await db.select().from(tasks);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isEnabled: true, revision: 7, title: 'Título persistido' });
  });

  it('habilitar/publicar no acredita integración; usa la mayor versión realmente publicada', async () => {
    const admin = await login();
    await db.update(tasks).set({ isEnabled: true, revision: 2 }).where(eq(tasks.id, 'TG-01'));
    const versions = await db.insert(taskPublishedVersions).values([{ taskId: 'TG-01', version: 3 }, { taskId: 'TG-01', version: 1 }]).returning();
    const detail = await (await request(`${base}/TG-01`, 'GET', undefined, admin)).json();
    expect(detail).toMatchObject({ isEnabled: true, revision: 2, integrationReady: false, assignable: false,
      publishedVersion: { id: versions[0]!.id, version: 3 }, unavailableReasons: ['INTEGRATION_PENDING', 'CONFIGURATION_UNSUPPORTED'] });
  });

  it('distingue vacío, fuera de catálogo y entrada inválida; errores también no-store', async () => {
    const actor = await login();
    for (const [path, status] of [[`${base}?unknown=1`, 400], [`${base}/TG-01?q=1`, 400],
      [`${base}/bad`, 400], [`${base}/TG-99`, 404], [`${base}/TG-00`, 404], [`${base}/TG-06`, 404]] as const) {
      const response = await request(path, 'GET', undefined, actor);
      expect(response.status).toBe(status);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ code: status === 400 ? 'INVALID_INPUT' : 'NOT_FOUND',
        message: status === 400 ? 'Solicitud inválida' : 'Tarea no encontrada' });
    }
    await db.delete(tasks);
    expect(await (await request(base, 'GET', undefined, actor)).json()).toEqual({ items: [] });
    expect((await request(`${base}/TG-01`, 'GET', undefined, actor)).status).toBe(404);
  });

  it('deniega sin sesión, JWT aislado, revocación e identidad/cuenta o rol incompatibles', async () => {
    const { teacher, account, admin } = await inviteTeacher();
    const jwt = await (await request('/api/auth/token', 'GET', undefined, admin)).json();
    for (const path of [base, `${base}/TG-01`]) {
      const response = await request(path, 'GET');
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' });
      expect((await request(path, 'GET', undefined, { authorization: `Bearer ${jwt.token}` })).status).toBe(401);
    }
    await db.update(userAccounts).set({ status: 'INACTIVA' }).where(eq(userAccounts.id, account.id));
    for (const path of [base, `${base}/TG-01`]) {
      const response = await request(path, 'GET', undefined, teacher);
      expect(response.status).toBe(403);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ code: 'FORBIDDEN', message: 'Acceso denegado' });
    }
    await db.update(userAccounts).set({ status: 'ACTIVA' }).where(eq(userAccounts.id, account.id));
    const [stored] = await db.select().from(userAccounts).where(eq(userAccounts.id, account.id));
    await db.update(user).set({ role: 'unknown' }).where(eq(user.id, stored!.authUserId!));
    expect((await request(`${base}/TG-01`, 'GET', undefined, teacher)).status).toBe(403);
    await request('/api/auth/sign-out', 'POST', {}, admin);
    expect((await request(base, 'GET', undefined, admin)).status).toBe(401);
  });

  it('sesión vencida no entrega catálogo y fallo DB no se convierte en lista vacía', async () => {
    const admin = await login();
    const current = await (await request('/api/auth/get-session', 'GET', undefined, admin)).json();
    await db.update(session).set({ createdAt: new Date(Date.now() - 1800001) }).where(eq(session.id, current.session.id));
    expect((await request(base, 'GET', undefined, admin)).status).toBe(401);
    const fresh = await login();
    for (const path of [base, `${base}/TG-01`]) {
      vi.spyOn(db, 'selectDistinctOn').mockImplementationOnce(() => { throw new Error('SYNTHETIC_DB_FAILURE'); });
      const response = await request(path, 'GET', undefined, fresh);
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({ code: 'UNAVAILABLE', message: 'Operación no confirmada' });
    }
  });
});

it('preparación requiere las tres condiciones sin orden de prioridad de razones', () => {
  for (const enabled of [false, true]) for (const integrated of [false, true]) for (const published of [null, { id: crypto.randomUUID(), version: 1 }]) {
    const result = taskReadiness(enabled, integrated, published);
    expect(result.assignable).toBe(enabled && integrated && published !== null);
    expect(result.unavailableReasons.includes('TASK_DISABLED')).toBe(!enabled);
    expect(result.unavailableReasons.includes('INTEGRATION_PENDING')).toBe(!integrated);
    expect(result.unavailableReasons.includes('CONFIGURATION_UNPUBLISHED')).toBe(published === null);
  }
});
