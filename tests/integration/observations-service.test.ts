import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { desc, eq, sql } from 'drizzle-orm';
import { db, pool } from '../../src/db/client.js';
import pg from 'pg';
import { session } from '../../src/db/schema/auth.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { teacherObservations as observations, teacherObservationRevisions as revisions } from '../../src/db/schema/observations.js';
import * as consent from '../../src/modules/academico/consents/consent-decision.js';
import { createObservation, correctObservation, getObservationHistory, getObservationReceipt, getObservationRevisions } from '../../src/modules/seguimiento/observations/observations.service.js';
import { reset } from '../helpers.js';
import { assertObservationTestDatabase, observationFixture } from '../observations-fixture.js';

beforeEach(async () => { assertObservationTestDatabase(); await reset(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
async function actor(accountId: string) {
  const [account] = await db.select().from(userAccounts).where(eq(userAccounts.id, accountId));
  const [current] = await db.select().from(session).where(eq(session.userId, account!.authUserId!)).orderBy(desc(session.createdAt));
  return { accountId, authUserId: account!.authUserId!, sessionId: current!.id };
}
it('T-05/CA-01/02/07: alta atómica con consentimiento real, misma intención concurrente y nuevo hecho igual', async () => {
  const f = await observationFixture(), a = await actor(f.a.account.id), input = f.input();
  await expect(createObservation(a, f.student.id, input)).rejects.toMatchObject({ fields: [{ reason: 'STUDENT_INACTIVE' }] });
  expect(await db.select().from(observations)).toHaveLength(0);
  await f.activate();
  const results = await Promise.all([createObservation(a, f.student.id, input), createObservation(a, f.student.id, input)]);
  expect(results.map(r => r.repeated).sort()).toEqual([false, true]);
  expect(results[0]!.receipt).toEqual(results[1]!.receipt);
  expect(await createObservation(a, f.student.id.toUpperCase(), { ...input, requestId: input.requestId.toUpperCase() }))
    .toEqual({ receipt: results[0]!.receipt, repeated: true });
  expect(await db.select().from(observations)).toHaveLength(1);
  expect(await db.select().from(revisions)).toHaveLength(1);
  await expect(createObservation(a, f.student.id, { ...input, frequency: 'ALWAYS' })).rejects.toMatchObject({ fields: [{ reason: 'REQUEST_MISMATCH' }] });
  await createObservation(a, f.student.id, { ...input, requestId: randomUUID() });
  expect(await db.select().from(observations)).toHaveLength(2);
  const o = (await db.select().from(observations))[0]!;
  expect(o.authorId).toBe(f.a.account.id);
  expect(results[0]!.receipt.revision.actorId).toBe(f.a.account.id);
});
it('T-05/06/CA-07/08: revocar bloquea escrituras, no lectura/replay confirmado ni recibo nulo', async () => {
  const f = await observationFixture(), a = await actor(f.a.account.id), c = await f.activate(), input = f.input();
  const first = await createObservation(a, f.student.id, input);
  const revoked = await f.app.request(`${f.consentPath}/revocations`, { method: 'POST', headers: f.headers,
    body: JSON.stringify({ requestId: randomUUID(), expectedVersion: 1, recordId: c.acknowledgement.recordId, reason: 'Retiro ficticio' }) });
  expect(revoked.status).toBe(200);
  await expect(createObservation(a, f.student.id, f.input())).rejects.toMatchObject({ fields: [{ reason: 'CONSENT_REQUIRED' }] });
  expect(await createObservation(a, f.student.id, input)).toEqual({ ...first, repeated: true });
  expect(await getObservationReceipt(a, f.student.id, input.requestId)).toEqual({ receipt: first.receipt });
  expect(await getObservationReceipt(a, f.student.id, randomUUID())).toEqual({ receipt: null });
  await db.update(students).set({ isActive: false }).where(eq(students.id, f.student.id));
  expect((await getObservationHistory(a, f.student.id, {})).items).toHaveLength(1);
  expect(await createObservation(a, f.student.id, input)).toEqual({ ...first, repeated: true });
  expect((await getObservationRevisions(a, f.student.id, first.receipt.observationId, {})).items).toHaveLength(1);
});
it('T-05/CA-08: NONE/unavailable/incoherente fallan cerrado, sin identidad ni revisión parcial', async () => {
  const f = await observationFixture(), a = await actor(f.a.account.id);
  await f.activate();
  const read = vi.spyOn(consent, 'readConsentDecision');
  for (const [value, status] of [[{ kind: 'available', state: 'NONE', version: 0 }, 409], [{ kind: 'unavailable' }, 503],
    [{ kind: 'available', state: 'NONE', version: 1 }, 503], [{ kind: 'available', state: 'REVOKED', version: 0 }, 503],
    [{ kind: 'available', state: 'CURRENT', version: 1, validUntil: null }, 503],
    [{ kind: 'available', state: 'CURRENT', version: 0, authorizationReference: 'bad', validUntil: null }, 503]] as const) {
    read.mockResolvedValueOnce(value as never);
    await expect(createObservation(a, f.student.id, f.input())).rejects.toMatchObject({ status });
  }
  expect(await db.select().from(observations)).toHaveLength(0);
  expect(await db.select().from(revisions)).toHaveLength(0);
});
it('T-06/CA-03/04: filtros vigentes, rango inclusivo, área vacía y cursor ligado a estudiante/filtros', async () => {
  const f = await observationFixture(), a = await actor(f.a.account.id); await f.activate();
  const created = [];
  for (const patch of [{ observedOn: '2026-01-01', schoolYear: 2025, term: 1 },
    { observedOn: '2026-01-02', schoolYear: 2026, term: 2, area: 'MATHEMATICS' },
    { observedOn: '2026-01-03', schoolYear: 2026, term: 3, behavior: 'FOLLOWING_INSTRUCTIONS', area: 'LANGUAGE_READING' }])
    created.push(await createObservation(a, f.student.id, { ...f.input(), ...patch }));
  const all = await getObservationHistory(a, f.student.id, {});
  expect(all.items).toHaveLength(3);
  const sorted = [...all.items].sort((x, y) => y.createdAt.localeCompare(x.createdAt) || y.id.localeCompare(x.id));
  expect(all.items.map(i => i.id)).toEqual(sorted.map(i => i.id));
  for (const [query, count] of [[{ schoolYear: 2025 }, 1], [{ term: 2 }, 1], [{ behavior: 'ATTENTION' }, 2],
    [{ area: 'UNSPECIFIED' }, 1], [{ area: 'MATHEMATICS' }, 1], [{ observedFrom: '2026-01-02', observedTo: '2026-01-03' }, 2],
    [{ schoolYear: 2024 }, 0]] as const)
    expect((await getObservationHistory(a, f.student.id, query)).items).toHaveLength(count);
  const page1 = await getObservationHistory(a, f.student.id, { limit: 1 });
  const page2 = await getObservationHistory(a, f.student.id, { limit: 1, cursor: page1.nextCursor! });
  const page3 = await getObservationHistory(a, f.student.id, { limit: 1, cursor: page2.nextCursor! });
  expect([page1, page2, page3].flatMap(p => p.items.map(i => i.id))).toEqual(all.items.map(i => i.id));
  expect(page3.nextCursor).toBeNull();
  await expect(async () => getObservationHistory(a, f.student.id, { cursor: page1.nextCursor!, schoolYear: 2026 })).rejects.toMatchObject({ status: 400 });
  await expect(async () => getObservationHistory(a, randomUUID(), { cursor: page1.nextCursor! })).rejects.toMatchObject({ status: 400 });
  await expect(async () => getObservationHistory(a, f.student.id, { cursor: 'bad' })).rejects.toMatchObject({ status: 400 });
  const first = created[0]!.receipt;
  await correctObservation(a, f.student.id, first.observationId, { ...f.input(), expectedVersion: 1, schoolYear: 2024, area: 'MATHEMATICS' });
  expect((await getObservationHistory(a, f.student.id, { schoolYear: 2025 })).items).toHaveLength(0);
  expect((await getObservationHistory(a, f.student.id, { schoolYear: 2024 })).items[0]!.id).toBe(first.observationId);
});
it('T-07/CA-04/07: corrección append-only, CAS dos pestañas y recibo histórico distinto del valor vigente', async () => {
  const f = await observationFixture(), a = await actor(f.a.account.id); await f.activate();
  const first = await createObservation(a, f.student.id, f.input()), id = first.receipt.observationId;
  const correction = { ...f.input(), expectedVersion: 1, frequency: 'ALWAYS' };
  const concurrent = await Promise.allSettled([correctObservation(a, f.student.id, id, correction),
    correctObservation(a, f.student.id, id, { ...correction, requestId: randomUUID(), frequency: 'NEVER' })]);
  expect(concurrent.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect(concurrent.find(r => r.status === 'rejected')).toMatchObject({ reason: { status: 409, fields: [{ reason: 'STALE_VERSION' }] } });
  const history = await getObservationRevisions(a, f.student.id, id, { limit: 1 });
  expect(history.items[0]).toEqual(first.receipt.revision);
  const second = await getObservationRevisions(a, f.student.id, id, { limit: 1, cursor: history.nextCursor! });
  expect(second.items[0]!.version).toBe(2); expect(second.nextCursor).toBeNull();
  expect((await getObservationReceipt(a, f.student.id, first.receipt.requestId)).receipt!.revision.version).toBe(1);
  expect((await getObservationHistory(a, f.student.id, {})).items[0]!.version).toBe(2);
  expect(await db.select().from(observations)).toHaveLength(1);
  expect(await db.select().from(revisions)).toHaveLength(2);
});
it('T-07/CA-04: 23:59:59 permite, 24:00:00 cierra sin reiniciar plazo; replay posterior no escribe', async () => {
  const f = await observationFixture(), a = await actor(f.a.account.id); await f.activate();
  const now = Date.now(), original = now - 86400000;
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(original);
  const first = await createObservation(a, f.student.id, f.input());
  vi.setSystemTime(original + 86399000);
  const body = { ...f.input(), expectedVersion: 1, frequency: 'ALWAYS' };
  const corrected = await correctObservation(a, f.student.id, first.receipt.observationId, body);
  vi.setSystemTime(original + 86400000);
  await expect(correctObservation(a, f.student.id, first.receipt.observationId, { ...body, requestId: randomUUID(), expectedVersion: 2 }))
    .rejects.toMatchObject({ fields: [{ reason: 'CORRECTION_CLOSED' }] });
  expect(await correctObservation(a, f.student.id, first.receipt.observationId, body)).toEqual({ ...corrected, repeated: true });
  expect((await getObservationRevisions(a, f.student.id, first.receipt.observationId, {})).items).toHaveLength(2);
});
it('T-05/06/07/CA-08: ámbito actual, autor original y cuenta/rol/sesión verificadas en servidor', async () => {
  const f = await observationFixture(), a = await actor(f.a.account.id), b = await actor(f.b.account.id); await f.activate();
  const input = f.input(), first = await createObservation(a, f.student.id, input), id = first.receipt.observationId;
  await expect(createObservation(b, f.student.id, f.input())).rejects.toMatchObject({ status: 404 });
  await expect(createObservation(a, f.student.id, { ...f.input(), groupId: f.bGroups[0]!.id })).rejects.toMatchObject({ status: 404 });
  await expect(getObservationRevisions(a, f.student.id, randomUUID(), {})).rejects.toMatchObject({ status: 404 });
  await expect(createObservation({ ...a, sessionId: 'missing' }, f.student.id, f.input())).rejects.toMatchObject({ status: 401 });
  await expect(createObservation({ ...a, accountId: randomUUID() }, f.student.id, f.input())).rejects.toMatchObject({ status: 403 });
  await db.update(groups).set({ teacherId: f.b.account.id }).where(eq(groups.id, f.student.groupId));
  for (const action of [() => getObservationHistory(a, f.student.id, {}), () => getObservationReceipt(a, f.student.id, input.requestId),
    () => correctObservation(a, f.student.id, id, { ...f.input(), expectedVersion: 1 })]) await expect(action()).rejects.toMatchObject({ status: 404 });
  expect((await getObservationHistory(b, f.student.id, {})).items[0]!.author.id).toBe(a.accountId);
  expect(await getObservationReceipt(b, f.student.id, input.requestId)).toEqual({ receipt: null });
  await expect(correctObservation(b, f.student.id, id, { ...f.input(), expectedVersion: 1 })).rejects.toMatchObject({ fields: [{ reason: 'AUTHOR_REQUIRED' }] });
  expect((await createObservation(b, f.student.id, f.input())).receipt.revision.actorId).toBe(b.accountId);
});
async function waitForBlockedBy(pid: number) {
  // Database barrier, no timing sleeps and no HTTP/client-visible test controls.
  for (let attempt = 0; attempt < 1000; attempt++) {
    const result = await pool.query('select pid from pg_stat_activity where $1 = any(pg_blocking_pids(pid))', [pid]);
    if (result.rowCount) return;
  }
  throw new Error('Expected PostgreSQL lock wait not observed');
}
it('T-07/CA-04: espera real del lock cruza 24 h; hora posterior al lock y rollback íntegro', async () => {
  const f = await observationFixture(), a = await actor(f.a.account.id); await f.activate();
  const now = Date.now(), original = now - 86400000;
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(original);
  const first = await createObservation(a, f.student.id, f.input());
  const locker = new pg.Client({ connectionString: process.env.DATABASE_URL }); await locker.connect();
  try {
    await locker.query('begin');
    const pid = (await locker.query('select pg_backend_pid() as pid')).rows[0].pid;
    await locker.query('select id from teacher_observations where id=$1 for update', [first.receipt.observationId]);
    vi.setSystemTime(original + 86399000);
    const pending = correctObservation(a, f.student.id, first.receipt.observationId, { ...f.input(), expectedVersion: 1 })
      .then(value => value, error => error);
    await waitForBlockedBy(pid);
    vi.setSystemTime(original + 86400000);
    await locker.query('commit');
    expect(await pending).toMatchObject({ status: 409, fields: [{ reason: 'CORRECTION_CLOSED' }] });
    expect(await db.select().from(revisions)).toHaveLength(1);
    expect((await db.select().from(observations))[0]!.version).toBe(1);
  } finally { await locker.query('rollback'); await locker.end(); }
});
it('T-05/CA-08: inactivación confirmada mientras se espera estudiante impide escribir', async () => {
  const f = await observationFixture(), a = await actor(f.a.account.id); await f.activate();
  const locker = new pg.Client({ connectionString: process.env.DATABASE_URL }); await locker.connect();
  try {
    await locker.query('begin');
    const pid = (await locker.query('select pg_backend_pid() as pid')).rows[0].pid;
    await locker.query('update students set is_active=false where id=$1', [f.student.id]);
    const pending = createObservation(a, f.student.id, f.input()).then(value => value, error => error);
    await waitForBlockedBy(pid); await locker.query('commit');
    expect(await pending).toMatchObject({ status: 409, fields: [{ reason: 'STUDENT_INACTIVE' }] });
    expect(await db.select().from(observations)).toHaveLength(0);
  } finally { await locker.query('rollback'); await locker.end(); }
});
it('T-05/CA-07: fallo SQL de revisión revierte también la identidad, sin recibo falso', async () => {
  const f = await observationFixture(), a = await actor(f.a.account.id); await f.activate();
  await db.execute(sql`create function observation_test_fail() returns trigger language plpgsql as $$ begin raise exception 'isolated test'; end $$`);
  await db.execute(sql`create trigger observation_test_fail before insert on teacher_observation_revisions for each row execute function observation_test_fail()`);
  const input = f.input();
  try {
    await expect(createObservation(a, f.student.id, input)).rejects.toThrow();
    expect(await db.select().from(observations)).toHaveLength(0);
    expect(await getObservationReceipt(a, f.student.id, input.requestId)).toEqual({ receipt: null });
  } finally {
    await db.execute(sql`drop trigger observation_test_fail on teacher_observation_revisions`);
    await db.execute(sql`drop function observation_test_fail()`);
  }
  expect((await createObservation(a, f.student.id, input)).repeated).toBe(false);
});
it('T-05/CA-08: sesión vencida durante espera revierte identidad/revisión en revalidación final', async () => {
  const f = await observationFixture(), a = await actor(f.a.account.id); await f.activate();
  const now = Date.now();
  await db.update(session).set({ expiresAt: new Date(now + 1000) }).where(eq(session.id, a.sessionId));
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
  const locker = new pg.Client({ connectionString: process.env.DATABASE_URL }); await locker.connect();
  try {
    await locker.query('begin');
    const pid = (await locker.query('select pg_backend_pid() as pid')).rows[0].pid;
    await locker.query('select id from students where id=$1 for update', [f.student.id]);
    const pending = createObservation(a, f.student.id, f.input()).then(value => value, error => error);
    await waitForBlockedBy(pid); vi.setSystemTime(now + 2000); await locker.query('commit');
    expect(await pending).toMatchObject({ status: 401 });
    expect(await db.select().from(observations)).toHaveLength(0);
    expect(await db.select().from(revisions)).toHaveLength(0);
  } finally { await locker.query('rollback'); await locker.end(); }
});
