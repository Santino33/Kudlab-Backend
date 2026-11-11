import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { createApp } from '../../src/app.js';
import { db } from '../../src/db/client.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { consentEvents, consentOperations, consentRecords } from '../../src/db/schema/consents.js';
import { assignments, recipients, gameSessions, runtimeCapabilities } from '../../src/db/schema/game.js';
import { publishTg01 } from '../../src/modules/tareas/catalog/publish.js';
import { academicFixture, reset } from '../helpers.js';
import { consentDependencies, type ConsentDependencies } from '../../src/modules/academico/consents/consents.service.js';

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
  const revoke = (body: unknown, auth = headers) => app.request(`${path}/revocations`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...auth }, body: JSON.stringify(body),
  });
  return { ...scope, student: student!, app, path, headers, storage, validate, read, write, revoke };
}
it('CA-01/02/03 correctivo: validación normal sin worker, rechazo previo a reserva y activación solo tras guardado', async () => {
  const f = await fixture();
  f.validate.mockImplementation(consentDependencies().validate);
  const requestId = randomUUID();
  const send = (content: string, name = 'ficticio.pdf', auth = f.headers) => {
    const form = new FormData();
    form.append('file', new File([content], name, { type: 'application/pdf' }));
    form.append('metadata', JSON.stringify({ requestId, expectedVersion: 0, signedOn: '2026-01-01', receivedOn: '2026-01-02' }));
    return f.app.request(f.path, { method: 'POST', headers: auth, body: form });
  };
  for (const [content, name] of [['', 'empty.pdf'], ['not a PDF', 'fake.pdf'], ['%PDF-1.7', 'wrong.png']]) {
    expect((await send(content!, name!)).status).toBe(400);
  }
  expect(f.storage.putImmutable).not.toHaveBeenCalled();
  expect(await db.select().from(consentOperations)).toHaveLength(0);
  expect((await (await f.read()).json()).student.isActive).toBe(false);
  f.storage.putImmutable.mockRejectedValueOnce(new Error('controlled storage failure'));
  expect((await send('%PDF-1.7')).status).toBe(503);
  expect((await (await f.read()).json()).student.isActive).toBe(false);
  expect(await db.select().from(consentRecords)).toHaveLength(0);
  const response = await send('%PDF-1.7');
  expect(response.status).toBe(201);
  const result = await response.json();
  expect(result.snapshot.student.isActive).toBe(true);
  expect((await send('%PDF-1.7')).status).toBe(200);
  expect(await db.select().from(consentEvents)).toHaveLength(1);
  const document = await f.read(`/${result.acknowledgement.recordId}/document`);
  expect(document.headers.get('content-type')).toBe('application/pdf');
  expect(document.headers.get('x-content-type-options')).toBe('nosniff');
  expect(document.headers.get('content-disposition')).toContain('attachment;');
  expect(await document.text()).toBe('%PDF-1.7');
});
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
  expect((await f.write(randomUUID(), 0, 'fixture', { origin: process.env.SPA_ORIGIN! })).status).toBe(401);
  expect((await f.write(randomUUID(), 0, 'fixture', { ...f.a.admin, origin: process.env.SPA_ORIGIN! })).status).toBe(403);
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
it('CA-05/07/09: revoca sin inactivar, conserva evidencia e historia y replay devuelve acuse original/snapshot actual', async () => {
  const f = await fixture(), registered = await (await f.write()).json();
  const input = { requestId: randomUUID(), expectedVersion: 1, recordId: registered.acknowledgement.recordId, reason: 'Comunicación ficticia' };
  // Persistence fixture only; real runtime authorization is covered by T-14/T-15.
  const version = await publishTg01(), until = new Date(Date.now() + 86400000);
  const [assignment] = await db.insert(assignments).values({ taskId: 'TG-01', publishedVersionId: version,
    groupId: f.student.groupId, createdBy: f.a.account.id, startsAt: new Date(), endsAt: until,
    maxAttempts: 2, requestId: randomUUID(), requestHash: 'fixture' }).returning();
  const [recipient] = await db.insert(recipients).values({ assignmentId: assignment!.id, studentId: f.student.id }).returning();
  const [session] = await db.insert(gameSessions).values({ recipientId: recipient!.id, studentId: f.student.id, taskId: 'TG-01',
    executionStatus: 'RUNNING', attemptNumber: 1, startedAtServer: new Date(), startRequestId: randomUUID(),
    startAllowedUntil: until, uploadAllowedUntil: until, participationAuthorizationRef: `CONSENT:${input.recordId}` }).returning();
  await db.insert(runtimeCapabilities).values({ sessionId: session!.id, secretDigest: 'fixture-not-a-credential', claimId: randomUUID(),
    canStart: false, canSubmit: true, canReadReceipt: true, startAllowedUntil: until, expiresAt: until });
  const before = { assignments: await db.select().from(assignments), recipients: await db.select().from(recipients),
    sessions: await db.select().from(gameSessions), capabilities: await db.select().from(runtimeCapabilities) };
  const response = await f.revoke(input);
  expect(response.status).toBe(200);
  const revoked = await response.json();
  expect(revoked.snapshot.student.isActive).toBe(true);
  expect(revoked.snapshot.consent).toMatchObject({ state: 'REVOKED', version: 2 });
  expect(revoked.acknowledgement.repeated).toBe(false);
  expect({ assignments: await db.select().from(assignments), recipients: await db.select().from(recipients),
    sessions: await db.select().from(gameSessions), capabilities: await db.select().from(runtimeCapabilities) }).toEqual(before);
  expect((await (await f.read(`/operations/${input.requestId}`)).json())).toMatchObject({ action: 'REVOKE', status: 'COMMITTED' });
  expect(await (await f.read(`/${input.recordId}/document`)).text()).toBe('fixture');
  const renewed = await (await f.write(randomUUID(), 2, 'second')).json();
  const replay = await (await f.revoke(input)).json();
  expect(replay.acknowledgement).toEqual({ ...revoked.acknowledgement, repeated: true });
  expect(replay.snapshot.consent).toMatchObject({ state: 'CURRENT', version: 3 });
  const history = await (await f.read('/history')).json();
  expect(history.items.map((e: { type: string }) => e.type)).toEqual(['REPLACE', 'REVOKE', 'REGISTER']);
  expect(history.items[1]).toMatchObject({ reason: input.reason, author: { id: f.a.account.id }, occurredAt: revoked.acknowledgement.confirmedAt });
  expect(await (await f.read(`/${input.recordId}/document`)).text()).toBe('fixture');
  expect(await (await f.read(`/${renewed.acknowledgement.recordId}/document`)).text()).toBe('second');
  expect(await db.select().from(consentRecords)).toHaveLength(2);
});
it('CA-03/05/08: rechaza motivo/objetivo/versión/payload/origen y autoriza revocación por responsable actual', async () => {
  const f = await fixture();
  expect((await f.revoke({ requestId: randomUUID(), expectedVersion: 0, recordId: randomUUID(), reason: 'Sin registro' })).status).toBe(409);
  const registered = await (await f.write()).json();
  const input = { requestId: randomUUID(), expectedVersion: 1, recordId: registered.acknowledgement.recordId, reason: 'Motivo ficticio' };
  for (const reason of ['', '  \n ', 'a'.repeat(2001), null]) expect((await f.revoke({ ...input, reason })).status).toBe(400);
  expect((await f.revoke({ ...input, actorId: f.b.account.id })).status).toBe(400);
  expect((await f.revoke({ ...input, recordId: randomUUID() })).status).toBe(409);
  expect((await f.revoke({ ...input, expectedVersion: 0 })).status).toBe(409);
  expect((await f.revoke(input, { origin: process.env.SPA_ORIGIN! })).status).toBe(401);
  expect((await f.revoke(input, { ...f.a.admin, origin: process.env.SPA_ORIGIN! })).status).toBe(403);
  expect((await f.revoke(input, { ...f.b.teacher, origin: process.env.SPA_ORIGIN! })).status).toBe(404);
  expect((await f.revoke(input, { ...f.headers, origin: 'https://other.invalid' })).status).toBe(403);
  expect((await f.revoke({ ...input, reason: 'a'.repeat(16385) })).status).toBe(413);
  expect((await f.app.request(`${f.path}/revocations`, { method: 'POST', headers: f.headers, body: '{}' })).status).toBe(415);
  expect((await f.app.request(`${f.path}/revocations`, { method: 'POST', headers: { ...f.headers, 'content-type': 'application/json' }, body: '{' })).status).toBe(400);
  expect(await db.select().from(consentOperations)).toHaveLength(1);
  await db.update(groups).set({ teacherId: f.b.account.id }).where(eq(groups.id, f.student.groupId));
  expect((await f.revoke(input)).status).toBe(404);
  await db.update(students).set({ isActive: false }).where(eq(students.id, f.student.id));
  expect((await f.revoke(input, { ...f.b.teacher, origin: process.env.SPA_ORIGIN! })).status).toBe(200);
  const history = await (await f.read('/history', f.b.teacher)).json();
  expect(history.items.map((e: { author: { id: string } }) => e.author.id)).toEqual([f.b.account.id, f.a.account.id]);
  expect((await (await f.read('', f.b.teacher)).json()).student.isActive).toBe(false);
});
it('CA-08: revocar durante almacenamiento de renovación impide su commit y conserva el evento', async () => {
  const f = await fixture(), registered = await (await f.write()).json(), requestId = randomUUID();
  f.storage.putImmutable.mockImplementationOnce(async () => {
    expect((await f.revoke({ requestId: randomUUID(), expectedVersion: 1, recordId: registered.acknowledgement.recordId, reason: 'Retiro durante carga' })).status).toBe(200);
  });
  expect((await f.write(requestId, 1, 'second')).status).toBe(409);
  expect((await (await f.read(`/operations/${requestId}`)).json()).status).toBe('REJECTED');
  expect((await (await f.read()).json()).consent.state).toBe('REVOKED');
  expect(await db.select().from(consentRecords)).toHaveLength(1);
  expect(await db.select().from(consentEvents)).toHaveLength(2);
});
it('CA-08: revocación concurrente, conflicto de otra operación y renovación antigua no borran la revocación', async () => {
  const f = await fixture(), registered = await (await f.write()).json();
  const input = { requestId: randomUUID(), expectedVersion: 1, recordId: registered.acknowledgement.recordId, reason: 'Retiro ficticio' };
  const results = await Promise.all([f.revoke(input), f.revoke(input)]);
  expect(results.map(r => r.status)).toEqual([200, 200]);
  expect((await Promise.all(results.map(r => r.json()))).map(r => r.acknowledgement.repeated).sort()).toEqual([false, true]);
  expect((await f.revoke({ ...input, reason: 'Otro motivo' })).status).toBe(409);
  const other = await f.revoke({ ...input, requestId: randomUUID(), expectedVersion: 2 });
  expect(other.status).toBe(409);
  expect((await other.json()).fields).toEqual([{ field: 'operation', reason: 'NOT_CURRENT' }]);
  expect((await f.write(randomUUID(), 1)).status).toBe(409);
  expect(await db.select().from(consentEvents)).toHaveLength(2);
  expect(await db.select().from(consentOperations)).toHaveLength(2);
});
it('CA-08: fallo de traza revierte también operación de revocación; consulta ausente no prueba éxito', async () => {
  const f = await fixture(), registered = await (await f.write()).json();
  const input = { requestId: randomUUID(), expectedVersion: 1, recordId: registered.acknowledgement.recordId, reason: 'Retiro ficticio' };
  await db.execute(sql`create function consent_revoke_test_fail() returns trigger language plpgsql as $$ begin raise exception 'test'; end $$`);
  await db.execute(sql`create trigger consent_revoke_test_fail before insert on consent_events for each row execute function consent_revoke_test_fail()`);
  try {
    expect((await f.revoke(input)).status).toBe(503);
    expect((await f.read(`/operations/${input.requestId}`)).status).toBe(404);
    expect((await (await f.read()).json()).consent.state).toBe('CURRENT');
    expect(await db.select().from(consentOperations)).toHaveLength(1);
  } finally {
    await db.execute(sql`drop trigger consent_revoke_test_fail on consent_events`);
    await db.execute(sql`drop function consent_revoke_test_fail()`);
  }
  expect((await f.revoke(input)).status).toBe(200);
});
