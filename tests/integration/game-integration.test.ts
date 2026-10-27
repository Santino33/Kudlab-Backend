import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { assignments, calculationRuns, gameSessions, rawEvents, resultReceipts, runtimeCapabilities } from '../../src/db/schema/game.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { reset } from '../helpers.js';
import { authorizations, gameDependencies, gameFixture, testGameApp } from '../game-fixture.js';
import { hash, envelopeSchema, type Envelope } from '../../src/modules/tareas/runtime/contract.js';
import { processOne } from '../../src/modules/evolucion/processor.js';
import { assertResponse, operations, readContract } from '../openapi.helpers.js';

process.env.GAME_RUNTIME_ORIGIN = 'http://127.0.0.1:4178';
process.env.GAME_GRANT_KEYS = JSON.stringify({ test1: 'ab'.repeat(32) });
process.env.GAME_ACTIVE_KEY_ID = 'test1'; process.env.GAME_CURSOR_KEY = 'cd'.repeat(32);
const app = testGameApp();
const contract = readContract(), covered = new Set<string>();
async function request(path: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  const response = await app.request('/api/v1' + path, { method, headers: { origin: path.startsWith('/game-runtime') ? process.env.GAME_RUNTIME_ORIGIN! : 'http://localhost:5173', 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const operation = operations(contract).find(([route, m]) => m === method.toLowerCase() && new RegExp('^' + route.replace(/\{[^}]+\}/g, '[^/]+') + '$').test('/api/v1' + path.split('?')[0]));
  if (operation) { await assertResponse(contract, operation[0], method, response.clone()); if (response.ok) covered.add(operation[2].operationId); }
  return response;
}
async function fixture() {
  const f = await gameFixture();
  const input = { requestId: randomUUID(), taskId: 'TG-01', publishedVersionId: f.versionId, groupId: f.student.groupId, studentIds: [f.student.id], startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), maxAttempts: 2 };
  const created = await request('/task-assignments', 'POST', input, f.a.teacher);
  expect(created.status, JSON.stringify(await created.clone().json())).toBe(201);
  const assignment = await created.json();
  return { ...f, input, assignment };
}
async function launch(f: Awaited<ReturnType<typeof fixture>>) {
  const response = await request(`/task-assignment-recipients/${f.assignment.recipients[0].id}/launch-grants`, 'POST', { requestId: randomUUID() }, f.a.teacher);
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(201);
  const grant = await response.json(), runtimeSecret = randomBytes(32).toString('base64url'), claim = { claimId: randomUUID(), runtimeSecret };
  const claimed = await request('/game-runtime/launches/claim', 'POST', claim, { authorization: `Bearer ${grant.launchGrant}` });
  expect(claimed.status, JSON.stringify(await claimed.clone().json())).toBe(200);
  return { grant, claim, context: await claimed.json(), runtime: { authorization: `Bearer ${runtimeSecret}` } };
}
async function start(l: Awaited<ReturnType<typeof launch>>) {
  const input = { startId: randomUUID() }, path = `/game-runtime/sessions/${l.context.sessionId}/start`;
  const response = await request(path, 'POST', input, l.runtime);
  expect(response.status, JSON.stringify(await response.clone().json())).toBe(200);
  return { input, result: await response.json(), path };
}
function envelope(context: Awaited<ReturnType<typeof launch>>['context']): Envelope {
  const outcomes = ['hit', 'hit', 'hit', 'miss', 'false_alarm', 'correct_rejection', 'not_evaluated', 'not_evaluated'] as const;
  return envelopeSchema.parse({ contractVersion: '1.1', sessionId: context.sessionId, submissionId: randomUUID(), taskId: 'TG-01',
    publishedVersionId: context.publishedVersionId, configVersion: context.configVersion, configurationHash: context.configurationHash, gameBuildId: context.gameBuildId,
    state: 'interrupted', terminationReason: 'user_exit', clock: { id: randomUUID(), timeOriginUnixMs: Date.now() },
    timing: { startedAtMs: 0.25, finishedAtMs: 10000.25, lastCheckpointAtMs: 10000.25 },
    device: { viewportWidth: 390, viewportHeight: 844, stageWidthCss: 390, stageHeightCss: 772, stageScale: .8125, touchCapable: true },
    events: outcomes.map((result, n) => {
      const response = result === 'hit' || result === 'false_alarm', at = n * 1000 + 100.25, end = response ? at + [300, 500, 700, 0, 300][n]! : at + 800;
      return { trial: n + 1, stimulus: n < 4 || n === 6 ? 'star' : 'moon', spawnedAtMs: at - 50, presentedAtMs: at,
        respondedAtMs: response ? end : null, closedAtMs: end, result, segment: 1,
        closureReason: response ? 'response' : result === 'not_evaluated' ? 'interruption' : 'window_elapsed', responseWindowCompleted: !response && result !== 'not_evaluated',
        responseDevice: response ? 'touch' : null, geometry: { lane: 2, x: 180, size: 90 } };
    }), incidents: [] });
}
describe('J-02 real PostgreSQL, synthetic participation only', () => {
  beforeEach(async () => { await reset(); });
  afterAll(async () => {
    expect([...covered].sort()).toEqual(operations(contract).filter(([, , op]) => op.tags.some((tag: string) => ['Actividades', 'Runtime'].includes(tag))).map(([, , op]) => op.operationId).sort());
    await reset();
    await db.execute(sql`truncate tasks restart identity cascade`);
    const seed = readFileSync(new URL('../../src/db/migrations/0009_task_catalog.sql', import.meta.url), 'utf8').split('--> statement-breakpoint').at(-1)!;
    await db.execute(sql.raw(seed));
  });
  it('assigns, claims, starts once, commits evidence once and calculates the reference fixture', async () => {
    const f = await fixture();
    const repeated = await request('/task-assignments', 'POST', f.input, f.a.teacher);
    expect(repeated.status).toBe(200); expect((await repeated.json()).id).toBe(f.assignment.id);
    expect((await request('/task-assignments', 'POST', { ...f.input, maxAttempts: 3 }, f.a.teacher)).status).toBe(409);
    const l = await launch(f);
    expect((await request('/game-runtime/launches/claim', 'POST', l.claim, { authorization: `Bearer ${l.grant.launchGrant}` })).status).toBe(200);
    expect((await request('/game-runtime/launches/claim', 'POST', { ...l.claim, claimId: randomUUID() }, { authorization: `Bearer ${l.grant.launchGrant}` })).status).toBe(409);
    const e = envelope(l.context);
    expect((await request(`/game-runtime/sessions/${e.sessionId}/results`, 'POST', e, l.runtime)).status).toBe(409);
    const started = await start(l);
    expect((await request(started.path, 'POST', started.input, l.runtime)).status).toBe(200);
    expect((await request(started.path, 'POST', { startId: randomUUID() }, l.runtime)).status).toBe(409);
    const path = `/game-runtime/sessions/${e.sessionId}/results`;
    const responses = await Promise.all([request(path, 'POST', e, l.runtime), request(path, 'POST', e, l.runtime)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 201]);
    const receipt = await responses[0]!.json(); expect(receipt.evidenceHash).toBe(hash(e));
    expect((await request(`/game-runtime/sessions/${e.sessionId}/receipt?submissionId=${e.submissionId}`, 'GET', undefined, l.runtime)).status).toBe(200);
    expect(await responses[1]!.json()).toEqual(receipt);
    expect((await request(path, 'POST', { ...e, device: { ...e.device, touchCapable: false } }, l.runtime)).status).toBe(409);
    expect((await request(path, 'POST', { ...e, submissionId: randomUUID() }, l.runtime)).status).toBe(409);
    await Promise.all([processOne(gameDependencies), processOne(gameDependencies)]);
    const detail = await (await request(`/task-sessions/${e.sessionId}`, 'GET', undefined, f.a.teacher)).json();
    expect(detail).toMatchObject({ attemptNumber: 1, executionStatus: 'INTERRUPTED', processingStatus: 'COMPLETED', recordedTrialCount: 8 });
    const values = Object.fromEntries(detail.calculation.indicators.filter((i: { scope: string }) => i.scope === 'SESSION').map((i: { metricCode: string; value: number }) => [i.metricCode, i.value]));
    expect(values).toMatchObject({ accuracy_pct: 75, omission_rate_pct: 25, commission_rate_pct: 50, median_reaction_time_ms: 500 });
    expect(Math.abs(values.rt_sd_ms - 163.299316)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(values.rt_cv_pct - 32.659863)).toBeLessThanOrEqual(1e-6);
    expect(await db.select().from(resultReceipts)).toHaveLength(1); expect(await db.select().from(calculationRuns)).toHaveLength(1);
    expect((await request(started.path, 'POST', started.input, l.runtime)).status).toBe(409);
  });
  it('neutralizes foreign/admin access and follows current course responsibility', async () => {
    const f = await fixture(), l = await launch(f);
    for (const actor of [f.b.teacher, f.a.admin]) {
      expect((await request(`/task-assignments/${f.assignment.id}`, 'GET', undefined, actor)).status).toBe(actor === f.a.admin ? 403 : 404);
      expect((await request(`/task-sessions/${l.context.sessionId}`, 'GET', undefined, actor)).status).toBe(actor === f.a.admin ? 403 : 404);
    }
    await db.update(groups).set({ teacherId: f.b.account.id }).where(eq(groups.id, f.student.groupId));
    expect((await request(`/task-assignments/${f.assignment.id}`, 'GET', undefined, f.a.teacher)).status).toBe(404);
    expect((await request(`/task-assignments/${f.assignment.id}`, 'GET', undefined, f.b.teacher)).status).toBe(200);
    expect((await request(`/game-runtime/sessions/${l.context.sessionId}/start`, 'POST', { startId: randomUUID() }, l.runtime)).status).toBe(403);
  });
  it('blocks revoked participation, allows accepted identical receipts, recovers submission without another attempt', async () => {
    const f = await fixture(), l = await launch(f); await start(l); const e = envelope(l.context), path = `/game-runtime/sessions/${e.sessionId}/results`;
    authorizations.delete(f.student.id);
    expect((await request(path, 'POST', e, l.runtime)).status).toBe(403);
    expect(await db.select().from(rawEvents)).toHaveLength(0);
    authorizations.set(f.student.id, new Date(Date.now() + 86400000));
    await db.update(runtimeCapabilities).set({ expiresAt: new Date(Date.now() - 1000) });
    expect((await request(path, 'POST', e, l.runtime)).status).toBe(401);
    const g = await (await request(`/task-sessions/${e.sessionId}/recovery-grants`, 'POST', { requestId: randomUUID(), submissionId: e.submissionId }, f.a.teacher)).json();
    const newSecret = randomBytes(32).toString('base64url'), headers = { authorization: `Bearer ${newSecret}` };
    const claim = await request('/game-runtime/launches/claim', 'POST', { claimId: randomUUID(), runtimeSecret: newSecret }, { authorization: `Bearer ${g.launchGrant}` });
    expect((await claim.json()).capabilities).toEqual({ canStart: false, canSubmit: true, canReadReceipt: true });
    expect((await request(path, 'POST', e, headers)).status).toBe(201);
    authorizations.delete(f.student.id);
    expect((await request(path, 'POST', e, headers)).status).toBe(200);
    expect((await request(`/game-runtime/sessions/${e.sessionId}/start`, 'POST', { startId: randomUUID() }, headers)).status).toBe(409);
  });
  it('serializes starts across assignments, recovers expired worker leases and paginates evidence', async () => {
    const f = await fixture(), l = await launch(f); await start(l);
    const second = await request('/task-assignments', 'POST', { ...f.input, requestId: randomUUID() }, f.a.teacher);
    const a = await second.json();
    expect((await request(`/task-assignment-recipients/${a.recipients[0].id}/launch-grants`, 'POST', { requestId: randomUUID() }, f.a.teacher)).status).toBe(409);
    const e = envelope(l.context); await request(`/game-runtime/sessions/${e.sessionId}/results`, 'POST', e, l.runtime);
    await db.update(calculationRuns).set({ status: 'PROCESSING', leaseUntil: new Date(Date.now() - 1000), leaseToken: randomUUID() });
    await processOne(gameDependencies);
    const first = await (await request(`/task-sessions/${e.sessionId}/evidence?kind=trials&limit=3`, 'GET', undefined, f.a.teacher)).json();
    expect(first.items.map((v: { trial: number }) => v.trial)).toEqual([1, 2, 3]);
    const next = await (await request(`/task-sessions/${e.sessionId}/evidence?kind=trials&limit=3&cursor=${first.nextCursor}`, 'GET', undefined, f.a.teacher)).json();
    expect(next.items.map((v: { trial: number }) => v.trial)).toEqual([4, 5, 6]);
    expect((await request(`/task-sessions/${e.sessionId}/evidence?kind=incidents&cursor=${first.nextCursor}`, 'GET', undefined, f.a.teacher)).status).toBe(400);
    await expect(db.update(rawEvents).set({ result: 'miss' })).rejects.toThrow();
  });
  it('normal composition remains unavailable and denies bad origins, cookies-only runtime, unknown fields and oversized bodies', async () => {
    const f = await fixture(), l = await launch(f);
    const { createApp } = await import('../../src/app.js');
    const normal = createApp();
    const blocked = await normal.request(`/api/v1/game-runtime/sessions/${l.context.sessionId}/start`, { method: 'POST', headers: { 'content-type': 'application/json', ...l.runtime }, body: JSON.stringify({ startId: randomUUID() }) });
    expect(blocked.status).toBe(503);
    expect((await request('/game-runtime/launches/claim', 'POST', l.claim, { origin: 'https://evil.invalid', authorization: `Bearer ${l.grant.launchGrant}` })).status).toBe(403);
    expect((await request(`/game-runtime/sessions/${l.context.sessionId}`, 'GET', undefined, f.a.teacher)).status).toBe(401);
    expect((await request('/game-runtime/launches/claim', 'POST', { ...l.claim, studentId: f.student.id }, { authorization: `Bearer ${l.grant.launchGrant}` })).status).toBe(400);
    const huge = await request(`/game-runtime/sessions/${l.context.sessionId}/results`, 'POST', { padding: 'x'.repeat(1048576) }, l.runtime);
    expect(huge.status).toBe(413); expect(huge.headers.get('cache-control')).toBe('no-store');
    const preflight = await app.request('/api/v1/game-runtime/launches/claim', { method: 'OPTIONS', headers: { origin: process.env.GAME_RUNTIME_ORIGIN!, 'access-control-request-method': 'POST' } });
    expect(preflight.headers.get('access-control-allow-origin')).toBe(process.env.GAME_RUNTIME_ORIGIN); expect(preflight.headers.get('access-control-allow-credentials')).toBeNull();
  });
  it('lists sessions, cancels new starts without losing evidence and retries processing idempotently', async () => {
    const f = await fixture(), l = await launch(f); await start(l); const e = envelope(l.context);
    expect((await request(`/task-assignments?groupId=${f.student.groupId}`, 'GET', undefined, f.a.teacher)).status).toBe(200);
    expect((await request(`/students/${f.student.id}/task-sessions`, 'GET', undefined, f.a.teacher)).status).toBe(200);
    expect((await request(`/game-runtime/sessions/${e.sessionId}`, 'GET', undefined, l.runtime)).status).toBe(200);
    expect((await request(`/task-assignments/${f.assignment.id}/cancel`, 'POST', { requestId: randomUUID() }, f.a.teacher)).status).toBe(200);
    expect((await request(`/game-runtime/sessions/${e.sessionId}/results`, 'POST', e, l.runtime)).status).toBe(201);
    await db.update(calculationRuns).set({ status: 'FAILED' }); await db.update(gameSessions).set({ processingStatus: 'FAILED' });
    const input = { requestId: randomUUID() }, path = `/task-sessions/${e.sessionId}/processing-retries`;
    const a = await request(path, 'POST', input, f.a.teacher), b = await request(path, 'POST', input, f.a.teacher);
    expect(a.status).toBe(202); expect(await a.json()).toEqual(await b.json());
    expect(await db.select().from(calculationRuns)).toHaveLength(2);
    await processOne(gameDependencies);
  });
  it('handles 30 synthetic clients with real transactions and reports measured endpoint latency', async () => {
    const f = await fixture();
    const people = await db.insert(students).values(Array.from({ length: 30 }, (_, n) => ({ groupId: f.student.groupId, studentCode: `J02-LOAD-${n}`, firstName: 'Carga', lastName: 'Sintética', isActive: true }))).returning();
    for (const s of people) authorizations.set(s.id, new Date(Date.now() + 86400000));
    const a = await (await request('/task-assignments', 'POST', { ...f.input, requestId: randomUUID(), studentIds: people.map(s => s.id) }, f.a.teacher)).json();
    const latencies: number[] = [];
    const clients = await Promise.all(a.recipients.map(async (r: { id: string }) => {
      const startedAt = performance.now();
      const g = await (await request(`/task-assignment-recipients/${r.id}/launch-grants`, 'POST', { requestId: randomUUID() }, f.a.teacher)).json();
      const secret = randomBytes(32).toString('base64url'), runtime = { authorization: `Bearer ${secret}` };
      const context = await (await request('/game-runtime/launches/claim', 'POST', { claimId: randomUUID(), runtimeSecret: secret }, { authorization: `Bearer ${g.launchGrant}` })).json();
      expect((await request(`/game-runtime/sessions/${context.sessionId}/start`, 'POST', { startId: randomUUID() }, runtime)).status).toBe(200);
      const e = envelope(context);
      expect((await request(`/game-runtime/sessions/${context.sessionId}/results`, 'POST', e, runtime)).status).toBe(201);
      latencies.push(performance.now() - startedAt);
      return e.sessionId;
    }));
    expect(new Set(clients).size).toBe(30); expect(await db.select().from(resultReceipts)).toHaveLength(30);
    latencies.sort((a, b) => a - b);
    console.log(JSON.stringify({ event: 'j02_synthetic_load', clients: 30, roundTripP50Ms: Math.round(latencies[14]!), roundTripP95Ms: Math.round(latencies[28]!), scope: 'API_POSTGRES_NOT_DEVICE_CAPACITY' }));
  }, 120000);
  it('serializes concurrent grant/claim/start reconciliation and consumes exactly one attempt', async () => {
    const f = await fixture(), input = { requestId: randomUUID() }, path = `/task-assignment-recipients/${f.assignment.recipients[0].id}/launch-grants`;
    const responses = await Promise.all([request(path, 'POST', input, f.a.teacher), request(path, 'POST', input, f.a.teacher)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 201]);
    const grants = await Promise.all(responses.map(r => r.json())); expect(grants[0]).toEqual(grants[1]);
    const secret = randomBytes(32).toString('base64url'), claim = { claimId: randomUUID(), runtimeSecret: secret }, headers = { authorization: `Bearer ${grants[0].launchGrant}` };
    const claims = await Promise.all([request('/game-runtime/launches/claim', 'POST', claim, headers), request('/game-runtime/launches/claim', 'POST', claim, headers)]);
    expect(claims.map(r => r.status)).toEqual([200, 200]);
    const context = await claims[0]!.json(), runtime = { authorization: `Bearer ${secret}` };
    const starts = await Promise.all([request(`/game-runtime/sessions/${context.sessionId}/start`, 'POST', { startId: randomUUID() }, runtime), request(`/game-runtime/sessions/${context.sessionId}/start`, 'POST', { startId: randomUUID() }, runtime)]);
    expect(starts.map(r => r.status).sort()).toEqual([200, 409]);
    const sessions = await db.select().from(gameSessions); expect(sessions).toHaveLength(1); expect(sessions[0]!.attemptNumber).toBe(1);
    const [second] = await db.insert(students).values({ groupId: f.student.groupId, studentCode: 'J02-CONCURRENT', firstName: 'Participante', lastName: 'Sintético B', isActive: true }).returning();
    authorizations.set(second!.id, new Date(Date.now() + 86400000));
    const a = await (await request('/task-assignments', 'POST', { ...f.input, requestId: randomUUID(), studentIds: [second!.id] }, f.a.teacher)).json();
    const other = await launch({ ...f, student: second!, assignment: a }); await start(other);
    const e1 = envelope(context), e2 = envelope(other.context); e2.submissionId = e1.submissionId;
    const results = await Promise.all([request(`/game-runtime/sessions/${e1.sessionId}/results`, 'POST', e1, runtime), request(`/game-runtime/sessions/${e2.sessionId}/results`, 'POST', e2, other.runtime)]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect((await results.find(r => r.status === 409)!.json()).code).toBe('RESULT_CONFLICT');
    expect(await db.select().from(resultReceipts)).toHaveLength(1);
  });
  it('rolls back an ingestion failure after its receipt/first event instead of leaving partial evidence', async () => {
    const f = await fixture(), l = await launch(f); await start(l); const e = envelope(l.context);
    await db.execute(sql`create function j02_synthetic_ingest_failure() returns trigger language plpgsql as $$ begin if NEW.trial_number = 2 then raise exception 'SYNTHETIC_INGEST_FAILURE'; end if; return NEW; end; $$`);
    await db.execute(sql`create trigger j02_synthetic_ingest_failure before insert on raw_events for each row execute function j02_synthetic_ingest_failure()`);
    try {
      expect((await request(`/game-runtime/sessions/${e.sessionId}/results`, 'POST', e, l.runtime)).status).toBe(503);
      expect(await db.select().from(resultReceipts)).toHaveLength(0); expect(await db.select().from(rawEvents)).toHaveLength(0); expect(await db.select().from(calculationRuns)).toHaveLength(0);
      expect((await db.select().from(gameSessions))[0]!.executionStatus).toBe('RUNNING');
    } finally {
      await db.execute(sql`drop trigger j02_synthetic_ingest_failure on raw_events`);
      await db.execute(sql`drop function j02_synthetic_ingest_failure()`);
    }
    expect((await request(`/game-runtime/sessions/${e.sessionId}/results`, 'POST', e, l.runtime)).status).toBe(201);
  });
});
