import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { createApp } from '../../src/app.js';
import { assertTestDatabase } from '../../src/modules/academico/shared/participation.js';
import { prepareLocalTg01 } from '../../src/modules/tareas/catalog/prepare-local.js';
import { tasks, taskPublishedVersions } from '../../src/db/schema/tasks.js';
import { assignments, gameConfigurations, indicatorRules, rawEvents } from '../../src/db/schema/game.js';
import { gameFixture } from '../game-fixture.js';
import { reset } from '../helpers.js';

// Exercise the actual local policy on a disposable test DB. Production guards are tested separately without mocks.
vi.mock('../../src/config/local-synthetic.js', () => ({ assertLocalSynthetic: () => assertTestDatabase() }));
beforeEach(async () => {
  assertTestDatabase();
  vi.stubEnv('GAME_RUNTIME_ORIGIN', 'http://127.0.0.1:4178');
  vi.stubEnv('GAME_GRANT_KEYS', JSON.stringify({ test1: 'ab'.repeat(32) }));
  vi.stubEnv('GAME_ACTIVE_KEY_ID', 'test1'); vi.stubEnv('GAME_CURSOR_KEY', 'cd'.repeat(32));
  await reset();
  await db.execute(sql`truncate tasks restart identity cascade`);
  const seed = readFileSync(new URL('../../src/db/migrations/0009_task_catalog.sql', import.meta.url), 'utf8').split('--> statement-breakpoint').at(-1)!;
  await db.execute(sql.raw(seed));
});
afterEach(() => vi.unstubAllEnvs());
function request(app: ReturnType<typeof createApp>, path: string, headers: Record<string, string>, body?: unknown) {
  return app.request(`/api/v1${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { origin: path.startsWith('/game-runtime') ? process.env.GAME_RUNTIME_ORIGIN! : process.env.SPA_ORIGIN!, 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function fixture() {
  const f = await gameFixture(), app = createApp({ localSynthetic: true }), groupId = f.aGroups[1]!.id;
  const payload = { groupId, studentCode: randomUUID(), firstName: 'Nuevo', lastName: 'Sintético' };
  const response = await request(app, '/students', f.a.teacher, payload);
  expect(response.status).toBe(201);
  const student = await response.json(); expect(student.isActive).toBe(true);
  const input = { requestId: randomUUID(), taskId: 'TG-01', publishedVersionId: f.versionId, groupId, studentIds: [student.id], startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), maxAttempts: 2 };
  return { ...f, app, payload, student, input };
}
it('CA-01/02/06/07: local assignment is scoped, fail-closed and idempotent without per-ID authorization seeds', async () => {
  const f = await fixture();
  const catalog = await (await request(f.app, '/tasks', f.a.teacher)).json();
  expect(catalog.items[0].assignable).toBe(true);
  const responses = await Promise.all([request(f.app, '/task-assignments', f.a.teacher, f.input), request(f.app, '/task-assignments', f.a.teacher, f.input)]);
  expect(responses.map(r => r.status).sort()).toEqual([200, 201]);
  expect((await responses[0]!.json()).id).toBe((await responses[1]!.json()).id);
  expect((await request(f.app, '/task-assignments', f.a.teacher, { ...f.input, maxAttempts: 3 })).status).toBe(409);
  for (const [actor, status] of [[f.b.teacher, 404], [f.a.admin, 403], [{}, 401]] as const)
    expect((await request(f.app, '/task-assignments', actor, { ...f.input, requestId: randomUUID() })).status).toBe(status);
  for (const extra of [{ isActive: true }, { consent: true }, { localSynthetic: true }, { KUDLAB_LOCAL_SYNTHETIC_ENABLED: true }])
    expect((await request(f.app, '/students', f.a.teacher, { ...f.payload, ...extra })).status).toBe(400);
  expect(await db.select().from(assignments)).toHaveLength(1);
});
it.each([false, true])('CA-03: deactivation blocks new assignment and runtime (already started=%s) without cancelling history', async started => {
  const f = await fixture();
  const assignment = await (await request(f.app, '/task-assignments', f.a.teacher, f.input)).json();
  const grant = await (await request(f.app, `/task-assignment-recipients/${assignment.recipients[0].id}/launch-grants`, f.a.teacher, { requestId: randomUUID() })).json();
  const secret = randomBytes(32).toString('base64url'), runtime = { authorization: `Bearer ${secret}` };
  const context = await (await request(f.app, '/game-runtime/launches/claim', { authorization: `Bearer ${grant.launchGrant}` }, { claimId: randomUUID(), runtimeSecret: secret })).json();
  if (started) expect((await request(f.app, `/game-runtime/sessions/${context.sessionId}/start`, runtime, { startId: randomUUID() })).status).toBe(200);
  expect((await f.app.request(`/api/v1/students/${f.student.id}/deactivate`, { method: 'POST', headers: { origin: process.env.SPA_ORIGIN!, ...f.a.teacher } })).status).toBe(200);
  const restarted = createApp({ localSynthetic: true });
  expect((await request(restarted, '/task-assignments', f.a.teacher, { ...f.input, requestId: randomUUID() })).status).toBe(403);
  if (!started) expect((await request(restarted, `/game-runtime/sessions/${context.sessionId}/start`, runtime, { startId: randomUUID() })).status).toBe(403);
  else {
    const envelope = { contractVersion: '1.1', sessionId: context.sessionId, submissionId: randomUUID(), taskId: 'TG-01', publishedVersionId: context.publishedVersionId,
      configVersion: context.configVersion, configurationHash: context.configurationHash, gameBuildId: context.gameBuildId, state: 'interrupted', terminationReason: 'user_exit',
      clock: { id: randomUUID(), timeOriginUnixMs: Date.now() }, timing: { startedAtMs: 0, finishedAtMs: 0, lastCheckpointAtMs: 0 },
      device: { viewportWidth: 390, viewportHeight: 844, stageWidthCss: 390, stageHeightCss: 772, stageScale: .8125, touchCapable: true }, events: [], incidents: [] };
    // Consentimiento D-04: an authorized start retains delivery despite later inactivation.
    expect((await request(restarted, `/game-runtime/sessions/${context.sessionId}/results`, runtime, envelope)).status).toBe(201);
  }
  expect((await (await request(restarted, `/task-assignments/${assignment.id}`, f.a.teacher)).json()).status).toBe('OPEN');
  expect(await db.select().from(assignments)).toHaveLength(1); expect(await db.select().from(rawEvents)).toHaveLength(0);
});
it('CA-01/04/05: preparation is idempotent, preserves PROPOSED and never runs on app construction', async () => {
  const first = await prepareLocalTg01(), [task] = await db.select().from(tasks).where(eq(tasks.id, 'TG-01'));
  expect(first.changed).toBe(true); expect(task!.isEnabled).toBe(true);
  expect(await prepareLocalTg01()).toEqual({ ...first, changed: false });
  expect((await db.select().from(tasks).where(eq(tasks.id, 'TG-01')))[0]!.revision).toBe(task!.revision);
  expect(await db.select().from(taskPublishedVersions)).toHaveLength(1);
  expect((await db.select().from(indicatorRules))[0]!.approvalStatus).toBe('PROPOSED');
  await db.update(tasks).set({ isEnabled: false }).where(eq(tasks.id, 'TG-01'));
  createApp({ localSynthetic: true });
  expect((await db.select().from(tasks).where(eq(tasks.id, 'TG-01')))[0]!.isEnabled).toBe(false);
});
it('CA-01/05: a newer incompatible publication aborts preparation without enabling the task or duplicating configurations', async () => {
  await prepareLocalTg01();
  await db.update(tasks).set({ isEnabled: false }).where(eq(tasks.id, 'TG-01'));
  await db.insert(taskPublishedVersions).values({ taskId: 'TG-01', version: 2 });
  const before = await db.select().from(tasks);
  await expect(prepareLocalTg01()).rejects.toThrow('PUBLISHED_CONFIGURATION_CONFLICT');
  expect(await db.select().from(tasks)).toEqual(before);
  expect(await db.select().from(gameConfigurations)).toHaveLength(1);
  expect(await db.select().from(taskPublishedVersions)).toHaveLength(2);
});
