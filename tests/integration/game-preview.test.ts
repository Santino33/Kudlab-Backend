import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { assignments } from '../../src/db/schema/game.js';
import { createApp } from '../../src/app.js';
import { gameFixture } from '../game-fixture.js';
import { reset } from '../helpers.js';
import { previewGameApp } from '../game-preview.js';

beforeEach(async () => {
  vi.stubEnv('GAME_RUNTIME_ORIGIN', 'http://127.0.0.1:4178');
  vi.stubEnv('GAME_GRANT_KEYS', JSON.stringify({ test1: 'ab'.repeat(32) }));
  vi.stubEnv('GAME_ACTIVE_KEY_ID', 'test1'); vi.stubEnv('GAME_CURSOR_KEY', 'cd'.repeat(32));
  await reset();
});
afterEach(() => vi.unstubAllEnvs());
const payload = (groupId: string) => ({ groupId, studentCode: randomUUID(), firstName: 'Registro ficticio', lastName: 'De prueba' });
function request(app: ReturnType<typeof createApp>, path: string, headers: Record<string, string>, body?: unknown) {
  return app.request(`/api/v1${path}`, { method: body === undefined ? 'GET' : 'POST', headers: {
    origin: process.env.SPA_ORIGIN!, 'content-type': 'application/json', ...headers,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
it('creates an active synthetic student in an empty course, assigns and launches without an authorization seed', async () => {
  const f = await gameFixture(), app = previewGameApp(), groupId = f.aGroups[1]!.id;
  const roster = await request(app, `/groups/${groupId}/students`, f.a.teacher);
  expect((await roster.json()).items).toHaveLength(0);
  const created = await request(app, '/students', f.a.teacher, payload(groupId));
  expect(created.status).toBe(201);
  const student = await created.json(); expect(student.isActive).toBe(true);
  const input = { requestId: randomUUID(), taskId: 'TG-01', publishedVersionId: f.versionId, groupId, studentIds: [student.id], startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), maxAttempts: 2 };
  const assigned = await request(app, '/task-assignments', f.a.teacher, input);
  expect(assigned.status).toBe(201);
  const assignment = await assigned.json(); expect(assignment.recipients[0].canLaunch).toBe(true);
  expect((await request(previewGameApp(), '/task-assignments', f.a.teacher, input)).status).toBe(200);
  const grant = await request(app, `/task-assignment-recipients/${assignment.recipients[0].id}/launch-grants`, f.a.teacher, { requestId: randomUUID() });
  expect(grant.status).toBe(201);
  const deactivated = await app.request(`/api/v1/students/${student.id}/deactivate`, { method: 'POST', headers: { origin: process.env.SPA_ORIGIN!, ...f.a.teacher } });
  expect(deactivated.status).toBe(200);
  const rejected = await request(app, '/task-assignments', f.a.teacher, { ...input, requestId: randomUUID() });
  expect(rejected.status).toBe(403); expect((await rejected.json()).code).toBe('PARTICIPATION_BLOCKED');
  expect(await db.select().from(assignments).where(eq(assignments.groupId, groupId))).toHaveLength(1);
  expect((await request(app, `/groups/${groupId}`, f.a.teacher)).status).toBe(200);
});
it('keeps normal registration inactive and does not expose the preview switch through HTTP', async () => {
  const f = await gameFixture(), normal = createApp(), groupId = f.aGroups[1]!.id;
  const created = await request(normal, '/students', f.a.teacher, payload(groupId));
  expect(created.status).toBe(201); expect((await created.json()).isActive).toBe(false);
  for (const app of [normal, previewGameApp()]) {
    expect((await request(app, '/students', f.a.teacher, { ...payload(groupId), isActive: true })).status).toBe(400);
    expect((await request(app, '/students', f.a.teacher, { ...payload(groupId), testActiveStudents: true })).status).toBe(400);
    expect((await request(app, '/students', f.b.teacher, payload(groupId))).status).toBe(404);
    expect((await request(app, '/students', f.a.admin, payload(groupId))).status).toBe(403);
  }
});
it('refuses synthetic activation outside test mode or the isolated test database', () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(() => previewGameApp()).toThrow('SYNTHETIC_PARTICIPATION_REQUIRES_ISOLATED_TEST_DATABASE');
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('DATABASE_URL', 'postgres://localhost/school');
  expect(() => previewGameApp()).toThrow('SYNTHETIC_PARTICIPATION_REQUIRES_ISOLATED_TEST_DATABASE');
});
