import { beforeEach, afterAll, describe, expect, it } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { tasks } from '../../src/db/schema/tasks.js';
import { palabraIntrusaEvidence, rawEvents, resultReceipts, calculationRuns } from '../../src/db/schema/game.js';
import { reset } from '../helpers.js';
import { gameDependencies, gameFixture, testGameApp } from '../game-fixture.js';
import { publishTg02 } from '../../src/modules/tareas/catalog/publish-tg02.js';
import { processOne } from '../../src/modules/evolucion/processor.js';
import { envelope } from '../tg02-envelope.js';
import { hash } from '../../src/modules/tareas/runtime/contract.js';
import { contextSchema } from '../../src/modules/tareas/runtime/profiles.js';
import { sessionDetailSchema } from '../../src/modules/tareas/runtime/dto.js';
import { readStudentSessionResults } from '../../src/modules/evolucion/read/history.service.js';

process.env.GAME_RUNTIME_ORIGIN = 'http://127.0.0.1:4178';
process.env.GAME_GRANT_KEYS = JSON.stringify({ test1: 'ab'.repeat(32) });
process.env.GAME_ACTIVE_KEY_ID = 'test1'; process.env.GAME_CURSOR_KEY = 'cd'.repeat(32);
const app = testGameApp();
async function request(path: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return app.request('/api/v1' + path, { method, headers: { origin: path.startsWith('/game-runtime') ? process.env.GAME_RUNTIME_ORIGIN! : 'http://localhost:5173', 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function fixture() {
  const f = await gameFixture(), version = await publishTg02();
  expect(await publishTg02()).toBe(version);
  await db.update(tasks).set({ isEnabled: true }).where(eq(tasks.id, 'TG-02'));
  const input = { requestId: randomUUID(), taskId: 'TG-02', publishedVersionId: version, groupId: f.student.groupId, studentIds: [f.student.id], startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), maxAttempts: 2 };
  const created = await request('/task-assignments', 'POST', input, f.a.teacher);
  expect(created.status, await created.clone().text()).toBe(201);
  const assignment = await created.json();
  const g = await request(`/task-assignment-recipients/${assignment.recipients[0].id}/launch-grants`, 'POST', { requestId: randomUUID() }, f.a.teacher);
  expect(g.status).toBe(201);
  const grant = await g.json(), runtimeSecret = randomBytes(32).toString('base64url');
  const claim = await request('/game-runtime/launches/claim', 'POST', { claimId: randomUUID(), runtimeSecret }, { authorization: `Bearer ${grant.launchGrant}` });
  expect(claim.status).toBe(200);
  const context = contextSchema.parse(await claim.json());
  expect(context.taskId).toBe('TG-02');
  const runtime = { authorization: `Bearer ${runtimeSecret}` }, startId = randomUUID();
  const start = () => request(`/game-runtime/sessions/${context.sessionId}/start`, 'POST', { startId }, runtime);
  expect((await start()).status).toBe(200); expect((await start()).status).toBe(200);
  const e = { ...envelope(), sessionId: context.sessionId, publishedVersionId: context.publishedVersionId, configVersion: context.configVersion };
  e.incidents.push({ sequence: 1, type: 'transition_skipped', phase: 'intro', clockId: e.clock.id, atMs: 10, recordedAtClient: null, durationMs: null, detail: null });
  return { ...f, e, runtime, input };
}
describe('TG-02 PostgreSQL integration / CA-01,03,08,09,10,11', () => {
  beforeEach(reset);
  afterAll(reset);
  it('persists once, calculates and reads scoped detail without longitudinal contamination', async () => {
    const f = await fixture(), path = `/game-runtime/sessions/${f.e.sessionId}/results`;
    const [a, b] = await Promise.all([request(path, 'POST', f.e, f.runtime), request(path, 'POST', f.e, f.runtime)]);
    expect([a.status, b.status].sort()).toEqual([200, 201]);
    const receipt = await a.json(); expect(await b.json()).toEqual(receipt); expect(receipt.evidenceHash).toBe(hash(f.e));
    expect(await db.select().from(rawEvents)).toHaveLength(0);
    const [stored] = await db.select().from(palabraIntrusaEvidence); expect(hash(stored!.envelope)).toBe(hash(f.e));
    await expect(db.update(palabraIntrusaEvidence).set({ envelope: f.e })).rejects.toThrow();
    await expect(db.delete(palabraIntrusaEvidence)).rejects.toThrow();
    await processOne(gameDependencies);
    const response = await request(`/task-sessions/${f.e.sessionId}`, 'GET', undefined, f.a.teacher);
    expect(response.status).toBe(200);
    const detail = sessionDetailSchema.parse(await response.json());
    expect(detail).toMatchObject({ taskId: 'TG-02', executionStatus: 'COMPLETED', processingStatus: 'COMPLETED', recordedTrialCount: 18, incidentCount: 1, attemptNumber: 1,
      measuredDurationMs: f.e.timing.measurementFinishedAtMs! - f.e.timing.measurementStartedAtMs!, preparation: f.e.preparation });
    expect(detail.calculation!.indicators).toHaveLength(49);
    expect(detail.calculation!.indicators.find(i => i.metricCode === 'accuracy_pct' && i.scope === 'SESSION')!.value).toBe(100);
    expect((await request(`/students/${f.student.id}/indicator-history?taskId=TG-02`, 'GET', undefined, f.a.teacher)).status).toBe(400);
    expect(await db.transaction(tx => readStudentSessionResults(tx, { studentIds: [f.student.id], scope: { kind: 'course', groupId: f.student.groupId } }))).toEqual({ items: [] });
    const page = await (await request(`/task-sessions/${f.e.sessionId}/evidence?kind=trials&limit=1`, 'GET', undefined, f.a.teacher)).json();
    expect(page.items).toHaveLength(1); expect(page.items[0].calculationDecision.included).toBe(true);
    const next = await (await request(`/task-sessions/${f.e.sessionId}/evidence?kind=trials&limit=1&cursor=${encodeURIComponent(page.nextCursor)}`, 'GET', undefined, f.a.teacher)).json();
    expect(next.items[0].trial).toBe(2);
    const incidents = await (await request(`/task-sessions/${f.e.sessionId}/evidence?kind=incidents`, 'GET', undefined, f.a.teacher)).json();
    expect(incidents.items).toEqual(f.e.incidents);
    expect((await request(`/task-sessions/${f.e.sessionId}`, 'GET', undefined, f.b.teacher)).status).toBe(404);
    expect((await request(`/task-sessions/${f.e.sessionId}`, 'GET', undefined, f.a.admin)).status).toBe(403);
    expect((await request(path, 'POST', { ...f.e, device: { ...f.e.device, touchCapable: true } }, f.runtime)).status).toBe(409);
    expect(await db.select().from(calculationRuns)).toHaveLength(1);
  });
  it('rejects altered words without a receipt, then preserves an empty partial', async () => {
    const f = await fixture(), path = `/game-runtime/sessions/${f.e.sessionId}/results`, altered = structuredClone(f.e);
    altered.events[0]!.words[0] = 'altered';
    expect((await request(path, 'POST', altered, f.runtime)).status).toBe(400);
    expect(await db.select().from(resultReceipts)).toHaveLength(0);
    const partial = { ...f.e, state: 'interrupted', terminationReason: 'user_exit', phaseReached: 'intro', events: [],
      timing: { startedAtMs: 0, finishedAtMs: 100, lastCheckpointAtMs: 100, measurementStartedAtMs: null, measurementFinishedAtMs: null, pausedMs: 0 },
      preparation: { instruction: { shownAtMs: 10, acceptedAtMs: null, repeats: 0 }, practiceCompleted: false, practice: [] } };
    expect((await request(path, 'POST', partial, f.runtime)).status).toBe(201);
    await processOne(gameDependencies);
    const d = sessionDetailSchema.parse(await (await request(`/task-sessions/${f.e.sessionId}`, 'GET', undefined, f.a.teacher)).json());
    expect(d).toMatchObject({ recordedTrialCount: 0, processingStatus: 'COMPLETED', measuredDurationMs: null });
    expect(d.calculation!.indicators.find(i => i.metricCode === 'accuracy_pct')!.unavailabilityReason).toBe('NO_VALID_ITEMS');
  });
  it('keeps existing delivery after disabling without approving methodology', async () => {
    const f = await fixture();
    await db.update(tasks).set({ isEnabled: false }).where(eq(tasks.id, 'TG-02'));
    expect((await request('/task-assignments', 'POST', { ...f.input, requestId: randomUUID() }, f.a.teacher)).status).toBe(409);
    expect((await request(`/game-runtime/sessions/${f.e.sessionId}/results`, 'POST', f.e, f.runtime)).status).toBe(201);
    const { getTask } = await import('../../src/modules/tareas/catalog/catalog.service.js');
    expect((await getTask('TG-02'))!.unavailableReasons).toContain('METHODOLOGY_PENDING');
    await publishTg02();
    expect((await db.select().from(tasks).where(eq(tasks.id, 'TG-02')))[0]!.isEnabled).toBe(false);
  });
});
