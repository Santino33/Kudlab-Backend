import { beforeEach, afterEach, expect, it } from 'vitest';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { students } from '../../src/db/schema/academic.js';
import { consentRecords, consentEvents } from '../../src/db/schema/consents.js';
import { gameSessions, indicatorRules, runtimeCapabilities, resultReceipts } from '../../src/db/schema/game.js';
import { createApp } from '../../src/app.js';
import { gameFixture } from '../game-fixture.js';
import { reset } from '../helpers.js';
import { createGameService } from '../../src/modules/tareas/runtime/service.js';
import { secretDigest } from '../../src/modules/tareas/runtime/contract.js';

process.env.GAME_RUNTIME_ORIGIN = 'http://127.0.0.1:4178';
process.env.GAME_GRANT_KEYS = JSON.stringify({ test1: 'ab'.repeat(32) });
process.env.GAME_ACTIVE_KEY_ID = 'test1'; process.env.GAME_CURSOR_KEY = 'cd'.repeat(32);
process.env.GAME_ACCESS_ENABLED = 'true'; process.env.GAME_ACCESS_KEYS = JSON.stringify({ test1: 'ef'.repeat(32) }); process.env.GAME_ACCESS_ACTIVE_KEY_ID = 'test1';
process.env.GAME_ACCESS_LOOKUP_KEY = '12'.repeat(32); process.env.GAME_ACCESS_IP_KEY = '34'.repeat(32);
const app = createApp(); // Real consent provider, no synthetic participation injected.
async function resetCatalog() {
  if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test')) throw new Error('Test database required');
  await reset();
  await db.execute(sql`truncate tasks restart identity cascade`);
  await db.execute(sql.raw(readFileSync(new URL('../../src/db/migrations/0009_task_catalog.sql', import.meta.url), 'utf8').split('--> statement-breakpoint').at(-1)!));
}
beforeEach(resetCatalog);
afterEach(resetCatalog);
async function request(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return app.request('/api/v1' + path, { method: body === undefined ? 'GET' : 'POST', headers: {
    origin: path.startsWith('/game-runtime') ? process.env.GAME_RUNTIME_ORIGIN! : process.env.SPA_ORIGIN!, 'content-type': 'application/json', ...headers,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function fixture() {
  const f = await gameFixture();
  // Test-only methodological prerequisite; not an approval or formula change in product.
  await db.update(indicatorRules).set({ approvalStatus: 'APPROVED', approvedAt: new Date(), approvalReference: 'TEST-ONLY-NOT-METHODOLOGICAL-APPROVAL' });
  const recordId = randomUUID();
  await db.insert(consentRecords).values({ id: recordId, studentId: f.student.id, signedOn: '2026-01-01', receivedOn: '2026-01-01', objectKey: `consents/${recordId}`, mediaType: 'image/png', byteSize: 1, sha256: 'a'.repeat(64) });
  await db.insert(consentEvents).values({ studentId: f.student.id, recordId, version: 1, type: 'REGISTER', actorId: f.a.account.id, actorName: 'Docente ficticio' });
  const input = { requestId: randomUUID(), taskId: 'TG-01', publishedVersionId: f.versionId, groupId: f.student.groupId, studentIds: [f.student.id], startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), maxAttempts: 2 };
  const res = await request('/task-assignments', input, f.a.teacher); expect(res.status).toBe(201);
  const assignment = await res.json();
  const grantRes = await request(`/task-assignment-recipients/${assignment.recipients[0].id}/launch-grants`, { requestId: randomUUID() }, f.a.teacher);
  expect(grantRes.status).toBe(201); const grant = await grantRes.json();
  const claim = { claimId: randomUUID(), runtimeSecret: randomBytes(32).toString('base64url') };
  const claimed = await request('/game-runtime/launches/claim', claim, { authorization: `Bearer ${grant.launchGrant}` });
  expect(claimed.status).toBe(200); const context = await claimed.json();
  const runtime = { authorization: `Bearer ${claim.runtimeSecret}` }, path = `/game-runtime/sessions/${context.sessionId}`;
  const revoke = () => request(`/students/${f.student.id}/consents/revocations`, { requestId: randomUUID(), expectedVersion: 1, recordId, reason: 'Retiro ficticio D' }, f.a.teacher);
  return { ...f, input, assignment, grant, claim, context, runtime, path, revoke, recordId };
}
it('CA-04/05/08: real CURRENT allows preparation with finite deadline; revocation blocks old context/claim/start without attempt', async () => {
  const f = await fixture();
  expect(Number.isFinite(Date.parse(f.context.startAllowedUntil))).toBe(true);
  expect((await f.revoke()).status).toBe(200);
  for (const response of [await request(f.path, undefined, f.runtime), await request(`${f.path}/start`, { startId: randomUUID() }, f.runtime),
    await request('/game-runtime/launches/claim', f.claim, { authorization: `Bearer ${f.grant.launchGrant}` }),
    await request('/task-assignments', { ...f.input, requestId: randomUUID() }, f.a.teacher)]) expect(response.status).toBe(403);
  const [s] = await db.select().from(gameSessions).where(eq(gameSessions.id, f.context.sessionId));
  expect(s!.attemptNumber).toBeNull(); expect(s!.participationAuthorizationRef).toBeNull();
});
it('CA-04/07: NONE and inactive cannot assign; start persists real reference under student lock', async () => {
  const f = await fixture();
  expect((await request('/task-assignments', { ...f.input, requestId: randomUUID(), studentIds: [f.secondStudent.id] }, f.a.teacher)).status).toBe(403);
  await db.update(students).set({ isActive: false }).where(eq(students.id, f.student.id));
  expect((await request(`${f.path}/start`, { startId: randomUUID() }, f.runtime)).status).toBe(403);
  await db.update(students).set({ isActive: true }).where(eq(students.id, f.student.id));
  expect((await request(`${f.path}/start`, { startId: randomUUID() }, f.runtime)).status).toBe(200);
  const [s] = await db.select().from(gameSessions).where(eq(gameSessions.id, f.context.sessionId));
  expect(s!.participationAuthorizationRef).toBe(`CONSENT:${f.recordId}`); expect(s!.attemptNumber).toBe(1);
});
function evidence(c: Awaited<ReturnType<typeof fixture>>['context']) {
  return { contractVersion: c.contractVersion, sessionId: c.sessionId, submissionId: randomUUID(), taskId: c.taskId,
    publishedVersionId: c.publishedVersionId, configVersion: c.configVersion, configurationHash: c.configurationHash, gameBuildId: c.gameBuildId,
    state: 'interrupted', terminationReason: 'user_exit', clock: { id: randomUUID(), timeOriginUnixMs: Date.now() },
    timing: { startedAtMs: 0, finishedAtMs: 100, lastCheckpointAtMs: 100 },
    device: { viewportWidth: 390, viewportHeight: 844, stageWidthCss: 390, stageHeightCss: 772, stageScale: .8125, touchCapable: true }, events: [], incidents: [] };
}
it('CA-05/06: revoked/inactive session replays start, recovers expired permission and commits once without another attempt', async () => {
  const f = await fixture(), start = { startId: randomUUID() }, e = evidence(f.context);
  const started = await request(`${f.path}/start`, start, f.runtime); expect(started.status).toBe(200); const original = await started.json();
  expect((await f.revoke()).status).toBe(200);
  await db.update(students).set({ isActive: false }).where(eq(students.id, f.student.id));
  expect(await (await request(`${f.path}/start`, start, f.runtime)).json()).toEqual(original);
  expect((await request(`${f.path}/start`, { startId: randomUUID() }, f.runtime)).status).toBe(409);
  expect((await request(f.path, undefined, f.runtime)).status).toBe(200);
  await db.update(runtimeCapabilities).set({ expiresAt: new Date(Date.now() - 1000) });
  expect((await request(`${f.path}/results`, e, f.runtime)).status).toBe(401);
  const recoveryInput = { requestId: randomUUID(), submissionId: e.submissionId };
  const recovered = await request(`/task-sessions/${e.sessionId}/recovery-grants`, recoveryInput, f.a.teacher); expect(recovered.status).toBe(201);
  const g = await recovered.json(), claim = { claimId: randomUUID(), runtimeSecret: randomBytes(32).toString('base64url') };
  for (let n = 0; n < 2; n++) {
    const r = await request('/game-runtime/launches/claim', claim, { authorization: `Bearer ${g.launchGrant}` }); expect(r.status).toBe(200);
    expect((await r.json()).capabilities).toEqual({ canStart: false, canSubmit: true, canReadReceipt: true });
  }
  const auth = { authorization: `Bearer ${claim.runtimeSecret}` };
  expect((await request(`${f.path}/start`, start, auth)).status).toBe(409);
  const committed = await request(`${f.path}/results`, e, auth); expect(committed.status).toBe(201);
  expect(await (await request(`${f.path}/results`, e, auth)).json()).toEqual(await committed.json());
  expect((await request(`${f.path}/results`, { ...e, device: { ...e.device, touchCapable: false } }, auth)).status).toBe(409);
  expect(await db.select().from(resultReceipts)).toHaveLength(1);
  const [s] = await db.select().from(gameSessions).where(eq(gameSessions.id, e.sessionId)); expect(s!.attemptNumber).toBe(1);
  await db.update(runtimeCapabilities).set({ expiresAt: new Date(Date.now() - 1000) });
  expect((await request(`${f.path}/receipt?submissionId=${e.submissionId}`, undefined, auth)).status).toBe(200);
});
it('CA-03/05/06: SUBMIT_ONLY code reveal/replacement/recovery/retry after revocation, never another session', async () => {
  const f = await fixture(), e = evidence(f.context);
  expect((await request(`${f.path}/start`, { startId: randomUUID() }, f.runtime)).status).toBe(200);
  expect((await f.revoke()).status).toBe(200);
  const issued = await request(`/task-sessions/${e.sessionId}/access-recovery-codes`, { requestId: randomUUID() }, f.a.teacher); expect(issued.status).toBe(201);
  const first = await issued.json(); expect(first.canReveal).toBe(true);
  const replaced = await request(`/task-access-codes/${first.id}/replace`, { requestId: randomUUID() }, f.a.teacher); expect(replaced.status).toBe(201);
  const next = await replaced.json(), revealed = await request(`/task-access-codes/${next.id}/reveal`, {}, f.a.teacher); expect(revealed.status).toBe(200);
  const { code } = await revealed.json(), payload = { code, sessionId: e.sessionId, submissionId: e.submissionId, claimId: randomUUID(), runtimeSecret: randomBytes(32).toString('base64url') };
  // In-process calls have no remote socket/IP; exercise service here and real HTTP in T-16.
  const service = createGameService();
  await expect(service.accessClaim({ code, claimId: randomUUID(), runtimeSecret: randomBytes(32).toString('base64url') })).rejects.toMatchObject({ status: 403 });
  await expect(service.accessClaim({ ...payload, sessionId: randomUUID() }, true)).rejects.toMatchObject({ status: 403 });
  for (let n = 0; n < 2; n++) expect((await service.accessClaim(payload, true)).capabilities.canStart).toBe(false);
  const auth = { authorization: `Bearer ${payload.runtimeSecret}` };
  expect((await request(`${f.path}/results`, e, auth)).status).toBe(201);
  expect((await request(`/game-runtime/sessions/${randomUUID()}/results`, e, auth)).status).toBe(404);
});
it('CA-03/06: malformed, foreign and synthetic references cannot authorize historical delivery in normal composition', async () => {
  const f = await fixture(), e = evidence(f.context);
  expect((await request(`${f.path}/start`, { startId: randomUUID() }, f.runtime)).status).toBe(200);
  const [original] = await db.select().from(gameSessions).where(eq(gameSessions.id, e.sessionId));
  let attempt = 1;
  for (const ref of ['', `CONSENT:${randomUUID()}`, `SYNTHETIC-J02:${f.student.id}`]) {
    const id = randomUUID(), token = randomBytes(32).toString('base64url');
    await db.insert(gameSessions).values({ ...original!, id, startRequestId: randomUUID(), attemptNumber: ++attempt, executionStatus: 'UNCONFIRMED', participationAuthorizationRef: ref });
    await db.insert(runtimeCapabilities).values({ sessionId: id, claimId: randomUUID(), secretDigest: secretDigest(token), canStart: false, canSubmit: true, canReadReceipt: true, startAllowedUntil: new Date(), expiresAt: new Date(Date.now() + 60000) });
    expect((await request(`/game-runtime/sessions/${id}/results`, { ...e, sessionId: id }, { authorization: `Bearer ${token}` })).status).toBe(403);
    expect((await request(`/task-sessions/${id}/recovery-grants`, { requestId: randomUUID(), submissionId: e.submissionId }, f.a.teacher)).status).toBe(403);
  }
  expect(await db.select().from(resultReceipts)).toHaveLength(0);
});
