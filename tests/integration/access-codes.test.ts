import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { gameSessions, runtimeCapabilities } from '../../src/db/schema/game.js';
import { accessCodes, accessLimits } from '../../src/db/schema/access.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { reset } from '../helpers.js';
import { gameFixture, testGameApp, authorizations } from '../game-fixture.js';
import { accessLimit, cleanAccessLimits } from '../../src/modules/tareas/runtime/access-limit.js';
import { codeInput, accessDigest, sealCode, openCode } from '../../src/modules/tareas/runtime/access-security.js';
import * as codeSecurity from '../../src/modules/tareas/runtime/access-security.js';
import { hash, envelopeSchema } from '../../src/modules/tareas/runtime/contract.js';
import { processOne } from '../../src/modules/evolucion/processor.js';
import { gameDependencies } from '../game-fixture.js';
import { assertResponse, operations, readContract } from '../openapi.helpers.js';

process.env.GAME_RUNTIME_ORIGIN = 'http://127.0.0.1:4178';
process.env.GAME_GRANT_KEYS = JSON.stringify({ test1: 'ab'.repeat(32) }); process.env.GAME_ACTIVE_KEY_ID = 'test1'; process.env.GAME_CURSOR_KEY = 'cd'.repeat(32);
process.env.GAME_ACCESS_ENABLED = 'true'; process.env.GAME_ACCESS_KEYS = JSON.stringify({ test1: 'ef'.repeat(32) }); process.env.GAME_ACCESS_ACTIVE_KEY_ID = 'test1';
process.env.GAME_ACCESS_LOOKUP_KEY = '12'.repeat(32); process.env.GAME_ACCESS_IP_KEY = '34'.repeat(32);
const app = testGameApp(), contract = readContract();
async function request(path: string, method = 'POST', body?: unknown, headers: Record<string, string> = {}, target = app) {
  const response = await target.request('/api/v1' + path, { method, headers: { origin: path.startsWith('/game-runtime') ? process.env.GAME_RUNTIME_ORIGIN! : 'http://localhost:5173', 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const operation = operations(contract).find(([route, m]) => m === method.toLowerCase() && new RegExp('^' + route.replace(/\{[^}]+\}/g, '[^/]+') + '$').test('/api/v1' + path.split('?')[0]));
  if (operation) await assertResponse(contract, operation[0], method, response.clone());
  return response;
}
async function ok(path: string, body?: unknown, headers?: Record<string, string>, status = 200) {
  const r = await request(path, 'POST', body, headers); expect(r.status, JSON.stringify(await r.clone().json())).toBe(status); return r.json();
}
async function fixture() {
  const f = await gameFixture();
  const a = await ok('/task-assignments', { requestId: randomUUID(), taskId: 'TG-01', publishedVersionId: f.versionId, groupId: f.student.groupId, studentIds: [f.student.id], startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), maxAttempts: 3 }, f.a.teacher, 201);
  const input = { requestId: randomUUID(), recipientIds: [a.recipients[0].id] }, batch = await ok(`/task-assignments/${a.id}/access-codes`, input, f.a.teacher, 201);
  const metadata = batch.items[0], revealed = await ok(`/task-access-codes/${metadata.id}/reveal`, {}, f.a.teacher);
  return { ...f, assignment: a, input, batch, metadata, code: revealed.code };
}
const claimInput = (code: string) => ({ code, claimId: randomUUID(), runtimeSecret: randomBytes(32).toString('base64url') });
describe('J03 access codes with PostgreSQL and isolated synthetic participation', () => {
  beforeEach(reset);
  it('normalizes only ASCII, encrypts with bound AAD, issues/reuses atomically and lists without secrets', async () => {
    expect(codeInput.parse(' e-r d34 ')).toBe('ERD34');
    for (const code of ['ERD３4', 'ERD34\t', 'ERD3O', 'ßRD34', 'ERD345']) expect(codeInput.safeParse(code).success).toBe(false);
    const sealed = sealCode('ERD34', 'bound'); expect(openCode(sealed.ciphertext, sealed.keyId, 'bound')).toBe('ERD34'); expect(() => openCode(sealed.ciphertext, sealed.keyId, 'other')).toThrow();
    const f = await fixture(); expect(f.code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/);
    expect(await ok(`/task-assignments/${f.assignment.id}/access-codes`, f.input, f.a.teacher)).toEqual(f.batch);
    const reused = await ok(`/task-assignments/${f.assignment.id}/access-codes`, { ...f.input, requestId: randomUUID() }, f.a.teacher, 201); expect(reused.reusedCount).toBe(1);
    const list = await request(`/task-assignments/${f.assignment.id}/access-codes`, 'GET', undefined, f.a.teacher); expect(list.status).toBe(200);
    const text = await list.text(); for (const secret of [f.code, 'lookupDigest', 'secretCiphertext']) expect(text).not.toContain(secret);
    const invalid = await request(`/task-assignments/${f.assignment.id}/access-codes`, 'POST', { requestId: randomUUID(), recipientIds: [f.metadata.recipientId, randomUUID()] }, f.a.teacher); expect(invalid.status).toBe(404); expect(await db.select().from(accessCodes)).toHaveLength(1);
    for (const actor of [f.b.teacher, f.a.admin]) expect((await request(`/task-access-codes/${f.metadata.id}/reveal`, 'POST', {}, actor)).status).toBe(actor === f.a.admin ? 403 : 404);
  });
  it('claims anonymously, reconciles lost replies, consumes once and uses unchanged evidence/processor/receipt', async () => {
    const f = await fixture(), input = claimInput(f.code);
    const c = await ok('/game-runtime/access/claim', input);
    expect(await ok('/game-runtime/access/claim', input)).toEqual(expect.objectContaining({ sessionId: c.sessionId }));
    expect(c.attemptNumber).toBeNull(); expect(JSON.stringify(c)).not.toContain(f.student.id);
    expect((await request('/game-runtime/access/claim', 'POST', claimInput(f.code))).status).toBe(403);
    expect((await request(`/task-assignment-recipients/${f.metadata.recipientId}/launch-grants`, 'POST', { requestId: randomUUID() }, f.a.teacher)).status).toBe(409);
    const runtime = { authorization: `Bearer ${input.runtimeSecret}` }, start = { startId: randomUUID() };
    expect((await ok(`/game-runtime/sessions/${c.sessionId}/start`, start, runtime)).attemptNumber).toBe(1); await ok(`/game-runtime/sessions/${c.sessionId}/start`, start, runtime);
    const replaced = await ok(`/task-access-codes/${f.metadata.id}/replace`, { requestId: randomUUID() }, f.a.teacher, 201);
    expect((await request('/game-runtime/access/claim', 'POST', claimInput(f.code))).status).toBe(403);
    const e = envelopeSchema.parse({ contractVersion: '1.1', sessionId: c.sessionId, submissionId: randomUUID(), taskId: 'TG-01', publishedVersionId: c.publishedVersionId, configVersion: c.configVersion, configurationHash: c.configurationHash, gameBuildId: c.gameBuildId, state: 'interrupted', terminationReason: 'user_exit', clock: { id: randomUUID(), timeOriginUnixMs: Date.now() }, timing: { startedAtMs: 0, finishedAtMs: 100, lastCheckpointAtMs: 100 }, device: { viewportWidth: 390, viewportHeight: 844, stageWidthCss: 390, stageHeightCss: 772, stageScale: .8125, touchCapable: false }, events: [], incidents: [] });
    const receipt = await ok(`/game-runtime/sessions/${c.sessionId}/results`, e, runtime, 201); expect(receipt.evidenceHash).toBe(hash(e)); expect(await ok(`/game-runtime/sessions/${c.sessionId}/results`, e, runtime)).toEqual(receipt);
    await processOne(gameDependencies);
    const detail = await (await request(`/task-sessions/${c.sessionId}`, 'GET', undefined, f.a.teacher)).json(); expect(detail).toMatchObject({ launchMode: 'CODE', attemptNumber: 1, processingStatus: 'COMPLETED' });
    expect(detail.calculation.indicators.every((i: { value: number | null }) => i.value === null)).toBe(true);
    const playCode = (await ok(`/task-access-codes/${replaced.id}/reveal`, {}, f.a.teacher)).code;
    const playRecovery = { ...claimInput(playCode), sessionId: c.sessionId, submissionId: e.submissionId };
    expect((await ok('/game-runtime/access/recover', playRecovery)).capabilities).toEqual({ canStart: false, canSubmit: true, canReadReceipt: true });
    expect((await ok('/game-runtime/access/recover', playRecovery)).sessionId).toBe(c.sessionId);
    await db.update(runtimeCapabilities).set({ expiresAt: new Date(Date.now() - 1000) });
    const rc = await ok(`/task-sessions/${c.sessionId}/access-recovery-codes`, { requestId: randomUUID(), reconcileReceipt: true }, f.a.teacher, 201);
    const revealed = await ok(`/task-access-codes/${rc.id}/reveal`, {}, f.a.teacher);
    const recovery = { ...claimInput(revealed.code), sessionId: c.sessionId, submissionId: e.submissionId };
    const ctx = await ok('/game-runtime/access/recover', recovery); expect(ctx.capabilities).toEqual({ canStart: false, canSubmit: true, canReadReceipt: true });
    expect(await ok(`/game-runtime/sessions/${c.sessionId}/results`, e, { authorization: `Bearer ${recovery.runtimeSecret}` })).toEqual(receipt);
    expect((await request(`/game-runtime/sessions/${c.sessionId}/start`, 'POST', start, { authorization: `Bearer ${recovery.runtimeSecret}` })).status).toBe(409);
    expect((await db.select().from(gameSessions))[0]!.attemptNumber).toBe(1); expect(replaced.scope).toBe('PLAY_AND_SUBMIT');
  });
  it('revokes prepared starts and transfer is atomic, irreversible and does not expose data to ADMIN', async () => {
    const f = await fixture(), claim = claimInput(f.code), c = await ok('/game-runtime/access/claim', claim);
    await ok(`/task-access-codes/${f.metadata.id}/revoke`, { requestId: randomUUID() }, f.a.teacher);
    expect((await request(`/game-runtime/sessions/${c.sessionId}/start`, 'POST', { startId: randomUUID() }, { authorization: `Bearer ${claim.runtimeSecret}` })).status).toBe(401);
    const next = await ok(`/task-assignments/${f.assignment.id}/access-codes`, { ...f.input, requestId: randomUUID() }, f.a.teacher, 201);
    const reveal = await ok(`/task-access-codes/${next.items[0].id}/reveal`, {}, f.a.teacher);
    const transfer = await request(`/groups/${f.student.groupId}`, 'PATCH', { teacherId: f.b.account.id, confirmTransfer: true }, f.a.admin); expect(transfer.status).toBe(200);
    expect((await request(`/task-access-codes/${next.items[0].id}/reveal`, 'POST', {}, f.a.teacher)).status).toBe(404);
    expect((await request('/game-runtime/access/claim', 'POST', claimInput(reveal.code))).status).toBe(403);
    expect((await db.select().from(accessCodes)).every(c => c.status !== 'ACTIVE')).toBe(true);
    await db.update(groups).set({ teacherId: f.a.account.id }).where(eq(groups.id, f.student.groupId));
    expect((await request('/game-runtime/access/claim', 'POST', claimInput(reveal.code))).status).toBe(403);
  });
  it('shares IP/digest limits between instances, counts malformed traffic and cleans only expired counters', async () => {
    const f = await fixture(), other = testGameApp();
    for (let n = 0; n < 10; n++) expect((await request('/game-runtime/access/claim', 'POST', claimInput('ERD34'), {}, n % 2 ? app : other)).status).toBe(403);
    const limited = await request('/game-runtime/access/recover', 'POST', { ...claimInput('ERD34'), sessionId: randomUUID(), submissionId: randomUUID() }, {}, other); expect(limited.status).toBe(429); expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    const id = claimInput(f.code); await ok('/game-runtime/access/claim', id); for (let n = 0; n < 12; n++) await ok('/game-runtime/access/claim', id);
    const [counter] = await db.select().from(accessLimits).where(eq(accessLimits.key, `code:${accessDigest(f.code)}`)); expect(counter!.events).toHaveLength(1);
    const results = await Promise.all(Array.from({ length: 31 }, () => accessLimit('school', 'ip', 1000000))); expect(results.every(n => n === 0)).toBe(true);
    for (let n = 0; n < 70; n++) await request('/game-runtime/access/claim', 'POST', {});
    const malformed = await request('/game-runtime/access/claim', 'POST', {}); expect(malformed.status).toBe(429);
    await db.update(accessLimits).set({ expiresAt: new Date(0) }).where(eq(accessLimits.key, `code:${accessDigest(f.code)}`)); await cleanAccessLimits();
    expect(await db.select().from(accessCodes)).toHaveLength(1); expect(await db.select().from(accessLimits).where(eq(accessLimits.key, `code:${accessDigest(f.code)}`))).toHaveLength(0);
  });
  it('normal composition, revoked participation and disabled J03 deny without weakening supervised delivery', async () => {
    const f = await fixture(); authorizations.delete(f.student.id);
    expect((await request('/game-runtime/access/claim', 'POST', claimInput(f.code))).status).toBe(403);
    const { createApp } = await import('../../src/app.js');
    // A real socket is mandatory in normal composition; no caller-controlled forwarded IP fallback.
    expect((await request('/game-runtime/access/claim', 'POST', claimInput(f.code), {}, createApp())).status).toBe(503);
    process.env.GAME_ACCESS_ENABLED = 'false';
    try { expect((await request('/game-runtime/access/claim', 'POST', claimInput(f.code))).status).toBe(503); } finally { process.env.GAME_ACCESS_ENABLED = 'true'; }
  });
  it('retries forced RNG collisions, supports future assignments and expiry never reactivates an old code', async () => {
    const f = await fixture();
    const future = await ok('/task-assignments', { requestId: randomUUID(), taskId: 'TG-01', publishedVersionId: f.versionId, groupId: f.student.groupId, studentIds: [f.secondStudent.id], startsAt: new Date(Date.now() + 3600000).toISOString(), endsAt: new Date(Date.now() + 7200000).toISOString(), maxAttempts: 1 }, f.a.teacher, 201);
    const spy = vi.spyOn(codeSecurity, 'newCode').mockReturnValueOnce(f.code).mockReturnValueOnce(f.code === 'ERD34' ? 'ERD35' : 'ERD34');
    try {
      const generated = await ok(`/task-assignments/${future.id}/access-codes`, { requestId: randomUUID(), recipientIds: [future.recipients[0].id] }, f.a.teacher, 201);
      expect(spy).toHaveBeenCalledTimes(2);
      const reveal = await ok(`/task-access-codes/${generated.items[0].id}/reveal`, {}, f.a.teacher);
      expect((await request('/game-runtime/access/claim', 'POST', claimInput(reveal.code))).status).toBe(403);
    } finally { spy.mockRestore(); }
    const [stored] = await db.select().from(accessCodes).where(eq(accessCodes.id, f.metadata.id));
    expect(stored!.expiresAt.getTime()).toBe(Date.parse(f.assignment.endsAt));
    await db.update(accessCodes).set({ status: 'EXPIRED' }).where(eq(accessCodes.id, f.metadata.id));
    await expect(db.update(accessCodes).set({ status: 'ACTIVE' }).where(eq(accessCodes.id, f.metadata.id))).rejects.toThrow();
    expect((await request('/game-runtime/access/claim', 'POST', claimInput(f.code))).status).toBe(403);
  });
  it('handles 30 public claims from one school IP across two application instances', async () => {
    const f = await fixture(), other = testGameApp();
    const people = await db.insert(students).values(Array.from({ length: 30 }, (_, n) => ({ groupId: f.student.groupId, studentCode: `J03-LOAD-${n}`, firstName: 'Carga', lastName: 'Sintética', isActive: true }))).returning();
    for (const s of people) authorizations.set(s.id, new Date(Date.now() + 86400000));
    const a = await ok('/task-assignments', { requestId: randomUUID(), taskId: 'TG-01', publishedVersionId: f.versionId, groupId: f.student.groupId, studentIds: people.map(s => s.id), startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString(), maxAttempts: 1 }, f.a.teacher, 201);
    const batch = await ok(`/task-assignments/${a.id}/access-codes`, { requestId: randomUUID(), recipientIds: a.recipients.map((r: { id: string }) => r.id) }, f.a.teacher, 201);
    const codes = []; for (const c of batch.items) codes.push((await ok(`/task-access-codes/${c.id}/reveal`, {}, f.a.teacher)).code);
    const started = performance.now(), claims = await Promise.all(codes.map((code, n) => request('/game-runtime/access/claim', 'POST', claimInput(code), {}, n % 2 ? app : other)));
    expect(claims.map(r => r.status).every(status => status === 200)).toBe(true);
    console.log(JSON.stringify({ event: 'j03_synthetic_claim_load', clients: 30, elapsedMs: Math.round(performance.now() - started), scope: 'API_POSTGRES_TWO_APP_INSTANCES_NOT_30_BROWSERS' }));
  }, 120000);
  it('a concurrent transfer serializes reveal/claim/start and preserves SQL provenance', async () => {
    const f = await fixture(), input = claimInput(f.code);
    const [claim, transfer] = await Promise.all([request('/game-runtime/access/claim', 'POST', input), request(`/groups/${f.student.groupId}`, 'PATCH', { teacherId: f.b.account.id, confirmTransfer: true }, f.a.admin)]);
    expect(transfer.status).toBe(200); expect([200, 403]).toContain(claim.status);
    if (claim.ok) { const c = await claim.json(); expect((await request(`/game-runtime/sessions/${c.sessionId}/start`, 'POST', { startId: randomUUID() }, { authorization: `Bearer ${input.runtimeSecret}` })).status).not.toBe(200); }
    expect((await request(`/task-access-codes/${f.metadata.id}/reveal`, 'POST', {}, f.a.teacher)).status).toBe(404);
    expect((await request(`/task-access-codes/${f.metadata.id}/reveal`, 'POST', {}, f.b.teacher)).status).toBe(409);
    const [code] = await db.select().from(accessCodes).where(eq(accessCodes.id, f.metadata.id)); expect(code!.status).toBe('REVOKED');
    await expect(db.update(accessCodes).set({ recipientId: randomUUID() }).where(eq(accessCodes.id, f.metadata.id))).rejects.toThrow();
  });
  it('recovers a pending immutable package after the play window/code expires, but never starts or bypasses participation', async () => {
    const f = await fixture();
    const endsAt = new Date(Date.now() + 3000).toISOString();
    const a = await ok('/task-assignments', { requestId: randomUUID(), taskId: 'TG-01', publishedVersionId: f.versionId, groupId: f.student.groupId, studentIds: [f.secondStudent.id], startsAt: new Date(Date.now() - 60000).toISOString(), endsAt, maxAttempts: 1 }, f.a.teacher, 201);
    const batch = await ok(`/task-assignments/${a.id}/access-codes`, { requestId: randomUUID(), recipientIds: [a.recipients[0].id] }, f.a.teacher, 201);
    const code = (await ok(`/task-access-codes/${batch.items[0].id}/reveal`, {}, f.a.teacher)).code, input = claimInput(code), c = await ok('/game-runtime/access/claim', input);
    await ok(`/game-runtime/sessions/${c.sessionId}/start`, { startId: randomUUID() }, { authorization: `Bearer ${input.runtimeSecret}` });
    await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(endsAt) - Date.now()) + 20));
    const submissionId = randomUUID();
    expect((await request('/game-runtime/access/recover', 'POST', { ...claimInput(f.code), sessionId: c.sessionId, submissionId })).status).toBe(403);
    expect((await request('/game-runtime/access/recover', 'POST', { ...claimInput(code), sessionId: c.sessionId, submissionId })).status).toBe(403);
    const rc = await ok(`/task-sessions/${c.sessionId}/access-recovery-codes`, { requestId: randomUUID() }, f.a.teacher, 201), recoveryCode = (await ok(`/task-access-codes/${rc.id}/reveal`, {}, f.a.teacher)).code;
    expect((await request('/game-runtime/access/claim', 'POST', claimInput(recoveryCode))).status).toBe(403);
    const recovery = { ...claimInput(recoveryCode), sessionId: c.sessionId, submissionId };
    const ctx = await ok('/game-runtime/access/recover', recovery); expect(ctx.capabilities.canStart).toBe(false); expect(Date.parse(ctx.uploadAllowedUntil)).toBeLessThanOrEqual(Date.parse(rc.expiresAt));
    const e = envelopeSchema.parse({ contractVersion: '1.1', sessionId: c.sessionId, submissionId, taskId: 'TG-01', publishedVersionId: c.publishedVersionId, configVersion: c.configVersion, configurationHash: c.configurationHash, gameBuildId: c.gameBuildId, state: 'interrupted', terminationReason: 'user_exit', clock: { id: randomUUID(), timeOriginUnixMs: Date.now() }, timing: { startedAtMs: 0, finishedAtMs: 100, lastCheckpointAtMs: 100 }, device: { viewportWidth: 390, viewportHeight: 844, stageWidthCss: 390, stageHeightCss: 772, stageScale: .8125, touchCapable: false }, events: [], incidents: [] });
    authorizations.delete(f.secondStudent.id);
    expect((await request(`/game-runtime/sessions/${c.sessionId}/results`, 'POST', e, { authorization: `Bearer ${recovery.runtimeSecret}` })).status).toBe(403);
    authorizations.set(f.secondStudent.id, new Date(Date.now() + 86400000));
    await ok(`/game-runtime/sessions/${c.sessionId}/results`, e, { authorization: `Bearer ${recovery.runtimeSecret}` }, 201);
    expect((await db.select().from(gameSessions).where(eq(gameSessions.id, c.sessionId)))[0]!.attemptNumber).toBe(1);
  });
});
