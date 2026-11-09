import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/client.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { consentEvents, consentOperations, consentRecords } from '../../src/db/schema/consents.js';
import { academicFixture, reset } from '../helpers.js';
import type { ConsentDependencies } from '../../src/modules/academico/consents/consents.service.js';

beforeEach(async () => {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test')) throw new Error('Exclusive test database required');
  await reset();
});
async function fixture() {
  const scope = await academicFixture();
  const [student] = await db.insert(students).values({ groupId: scope.aGroups[0]!.id, studentCode: 'CONS-TEST', firstName: 'Persona', lastName: 'Ficticia' }).returning();
  const objects = new Map<string, Buffer>();
  const storage = {
    putImmutable: vi.fn(async (evidence, bytes) => { objects.set(evidence.objectKey, Buffer.from(bytes)); }),
    readVerified: vi.fn(async evidence => {
      expect(Object.keys(evidence).sort()).toEqual(['byteSize', 'mediaType', 'objectKey', 'sha256']);
      return Buffer.from(objects.get(evidence.objectKey)!);
    }),
  } satisfies ConsentDependencies['storage'];
  const validate = vi.fn<ConsentDependencies['validate']>(async () => ({ kind: 'valid', mediaType: 'image/png' }));
  const app = createApp({}, { storage, validate });
  const path = `/api/v1/students/${student!.id}/consents`;
  const headers = { ...scope.a.teacher, origin: process.env.SPA_ORIGIN! };
  const read = (suffix = '', auth = scope.a.teacher) => app.request(path + suffix, { headers: auth });
  const write = (requestId = randomUUID(), expectedVersion = 0, content = 'fixture', auth = headers) => {
    const form = new FormData();
    form.append('file', new File([content], 'ficticio.png', { type: 'image/png' }));
    form.append('metadata', JSON.stringify({ requestId, expectedVersion, signedOn: '2026-01-01', receivedOn: '2026-01-02' }));
    return app.request(path, { method: 'POST', headers: auth, body: form });
  };
  return { ...scope, student: student!, app, path, headers, storage, validate, read, write };
}
it('registra/activa atómicamente, reproduce sin reactivar y rechaza payload/versión distintos', async () => {
  const f = await fixture(), id = randomUUID();
  expect((await (await f.read()).json()).consent).toEqual({ state: 'NONE', version: 0, currentRecord: null });
  const first = await f.write(id);
  expect(first.status).toBe(201);
  const result = await first.json();
  expect(result.snapshot.student.isActive).toBe(true);
  expect(result.snapshot.consent).toMatchObject({ state: 'CURRENT', version: 1 });
  expect(JSON.stringify(result)).not.toContain('objectKey');
  await f.app.request(`/api/v1/students/${f.student.id}/deactivate`, { method: 'POST', headers: f.headers });
  const repeated = await f.write(id);
  expect(repeated.status).toBe(200);
  expect((await repeated.json()).snapshot.student.isActive).toBe(false);
  expect((await f.write(id, 0, 'different')).status).toBe(409);
  expect((await f.write()).status).toBe(409);
  expect((await f.write(randomUUID(), 1)).status).toBe(201);
  expect(await db.select().from(consentEvents)).toHaveLength(2);
  expect((await (await f.read(`/operations/${id}`)).json()).status).toBe('COMMITTED');
});
it('autoriza todos los endpoints y rechaza Origin/query sin afectar el CRUD previo', async () => {
  const f = await fixture();
  for (const suffix of ['', '/history', `/operations/${randomUUID()}`, `/${randomUUID()}/document`]) {
    expect((await f.read(suffix, {})).status).toBe(401);
    expect((await f.read(suffix, f.a.admin)).status).toBe(403);
    expect((await f.read(suffix, f.b.teacher)).status).toBe(404);
  }
  expect((await f.write(randomUUID(), 0, 'fixture', { ...f.b.teacher, origin: process.env.SPA_ORIGIN! })).status).toBe(404);
  expect((await f.write(randomUUID(), 0, 'fixture', { ...f.headers, origin: 'https://other.invalid' })).status).toBe(403);
  expect(f.validate).not.toHaveBeenCalled();
  for (const query of ['?other=x', '/history?other=x', '/history?cursor=x&cursor=y', '/history?cursor=x'])
    expect((await f.read(query)).status).toBe(400);
  expect((await f.app.request(`/api/v1/students/${f.student.id}`, { headers: f.headers })).status).toBe(200);
  expect((await f.app.request(`/api/v1/students/${f.student.id}?other=x`, { headers: f.headers })).status).toBe(400);
});
it('fallo del objeto conserva PENDING y no activa; reintento confirma una sola vez', async () => {
  const f = await fixture(), id = randomUUID();
  f.storage.putImmutable.mockRejectedValueOnce(new Error('unavailable'));
  expect((await f.write(id)).status).toBe(503);
  expect(await db.select().from(consentRecords)).toHaveLength(0);
  expect((await (await f.read(`/operations/${id}`)).json()).status).toBe('PENDING');
  expect((await (await f.read()).json()).student.isActive).toBe(false);
  expect((await f.write(id)).status).toBe(201);
  expect(await db.select().from(consentEvents)).toHaveLength(1);
});
it('rollback de traza conserva el objeto y la reserva, sin documento ni activación', async () => {
  const f = await fixture(), id = randomUUID();
  await db.execute(sql`create function consent_test_fail() returns trigger language plpgsql as $$ begin raise exception 'test'; end $$`);
  await db.execute(sql`create trigger consent_test_fail before insert on consent_events for each row execute function consent_test_fail()`);
  try {
    expect((await f.write(id)).status).toBe(503);
    expect(await db.select().from(consentRecords)).toHaveLength(0);
    expect((await (await f.read()).json()).student.isActive).toBe(false);
    expect((await db.select().from(consentOperations))[0]!.status).toBe('PENDING');
  } finally {
    await db.execute(sql`drop trigger consent_test_fail on consent_events`);
    await db.execute(sql`drop function consent_test_fail()`);
  }
  expect((await f.write(id)).status).toBe(201);
});
it('reautoriza después del almacén y después de leer el documento', async () => {
  const f = await fixture();
  const registered = await (await f.write()).json();
  const recordId = registered.acknowledgement.recordId;
  const doc = await f.read(`/${recordId}/document`);
  expect(doc.status).toBe(200);
  expect(doc.headers.get('cache-control')).toBe('private, no-store');
  expect(doc.headers.get('x-content-type-options')).toBe('nosniff');
  expect(doc.headers.get('content-disposition')).toContain('attachment;');
  expect(await doc.text()).toBe('fixture');
  f.storage.readVerified.mockImplementationOnce(async () => {
    await db.update(groups).set({ teacherId: f.b.account.id }).where(eq(groups.id, f.student.groupId));
    return Buffer.from('fixture');
  });
  expect((await f.read(`/${recordId}/document`)).status).toBe(404);
  const history = await (await f.read('/history', f.b.teacher)).json();
  expect(history.items[0].author.id).toBe(f.a.account.id);
  await db.update(groups).set({ teacherId: f.a.account.id }).where(eq(groups.id, f.student.groupId));
  f.storage.putImmutable.mockImplementationOnce(async () => {
    await db.update(groups).set({ teacherId: f.b.account.id }).where(eq(groups.id, f.student.groupId));
  });
  expect((await f.write(randomUUID(), 1)).status).toBe(404);
  expect(await db.select().from(consentEvents)).toHaveLength(1);
});
it('pagina más de 25 eventos con techo estable y no acepta cursor cruzado', async () => {
  const f = await fixture();
  for (let version = 0; version < 26; version++) expect((await f.write(randomUUID(), version)).status).toBe(201);
  const first = await (await f.read('/history')).json();
  expect(first.items).toHaveLength(25);
  expect((await f.write(randomUUID(), 26)).status).toBe(201);
  const second = await (await f.read(`/history?cursor=${first.nextCursor}`)).json();
  expect(second.items.map((item: { version: number }) => item.version)).toEqual([1]);
  expect(second.nextCursor).toBeNull();
  const cursor = JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString());
  cursor.studentId = randomUUID();
  expect((await f.read(`/history?cursor=${Buffer.from(JSON.stringify(cursor)).toString('base64url')}`)).status).toBe(400);
});
it('concurrencia de la misma operación produce un único evento', async () => {
  const f = await fixture(), id = randomUUID();
  const results = await Promise.all([f.write(id), f.write(id)]);
  expect(results.map(r => r.status).sort()).toEqual([200, 201]);
  expect(await db.select().from(consentEvents)).toHaveLength(1);
});
