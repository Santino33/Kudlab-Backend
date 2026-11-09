import { beforeEach, afterEach, expect, it } from 'vitest';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { students } from '../../src/db/schema/academic.js';
import { consentRecords, consentEvents } from '../../src/db/schema/consents.js';
import { gameSessions, indicatorRules } from '../../src/db/schema/game.js';
import { createApp } from '../../src/app.js';
import { gameFixture } from '../game-fixture.js';
import { reset } from '../helpers.js';

process.env.GAME_RUNTIME_ORIGIN = 'http://127.0.0.1:4178';
process.env.GAME_GRANT_KEYS = JSON.stringify({ test1: 'ab'.repeat(32) });
process.env.GAME_ACTIVE_KEY_ID = 'test1'; process.env.GAME_CURSOR_KEY = 'cd'.repeat(32);
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
