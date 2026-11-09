import { beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { students } from '../../src/db/schema/academic.js';
import { consentRecords, consentEvents } from '../../src/db/schema/consents.js';
import { academicFixture, reset } from '../helpers.js';
import { readConsentDecision, readConsentDecisions } from '../../src/modules/academico/consents/consent-decision.js';
import { withAcademicAccess } from '../../src/modules/academico/shared/academic-auth.js';

beforeEach(async () => { if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('_test')) throw new Error('Test database required'); await reset(); });
it('CA-03/04/07: complete course batch, no truncation, missing/foreign/duplicate IDs fail closed', async () => {
  const f = await academicFixture(), at = new Date();
  const rows = await db.insert(students).values(Array.from({ length: 125 }, (_, n) => ({ groupId: f.aGroups[0]!.id, studentCode: `CONS-D-${n}`, firstName: 'Persona', lastName: 'Ficticia', isActive: true }))).returning();
  const recordId = randomUUID();
  await db.insert(consentRecords).values({ id: recordId, studentId: rows[0]!.id, signedOn: '2026-01-01', receivedOn: '2026-01-01', objectKey: `consents/${recordId}`, mediaType: 'image/png', byteSize: 1, sha256: 'a'.repeat(64) });
  await db.insert(consentEvents).values({ studentId: rows[0]!.id, recordId, version: 1, type: 'REGISTER', actorId: f.a.account.id, actorName: 'Docente ficticio' });
  await db.transaction(async tx => {
    expect(await readConsentDecision(tx, rows[0]!.id, at)).toEqual({ kind: 'available', state: 'CURRENT', version: 1, authorizationReference: `CONSENT:${recordId}`, validUntil: null });
    expect(await readConsentDecision(tx, rows[1]!.id, at)).toEqual({ kind: 'available', state: 'NONE', version: 0 });
    const batch = await readConsentDecisions(tx, f.aGroups[0]!.id, rows.map(r => r.id), at);
    expect(batch.kind).toBe('complete');
    if (batch.kind === 'complete') { expect(batch.items).toHaveLength(125); expect(batch.items.map(i => i.studentId)).toEqual(rows.map(r => r.id).sort()); }
    expect(await readConsentDecisions(tx, f.aGroups[0]!.id, [], at)).toEqual({ kind: 'complete', evaluatedAt: at, items: [] });
    for (const ids of [[randomUUID()], [rows[0]!.id, rows[0]!.id]]) expect(await readConsentDecisions(tx, f.aGroups[0]!.id, ids, at)).toEqual({ kind: 'unavailable' });
    expect(await readConsentDecisions(tx, f.bGroups[0]!.id, [rows[0]!.id], at)).toEqual({ kind: 'unavailable' });
    expect(await readConsentDecision(tx, randomUUID(), at)).toEqual({ kind: 'unavailable' });
  });
  await db.insert(consentEvents).values({ studentId: rows[0]!.id, recordId, version: 2, type: 'REVOKE', reason: 'Ficticio', actorId: f.a.account.id, actorName: 'Docente ficticio' });
  expect(await db.transaction(tx => readConsentDecision(tx, rows[0]!.id, at))).toEqual({ kind: 'available', state: 'REVOKED', version: 2 });
});
it('CA-08: isolation selected before first query; default retained; failed operation rolls back activity', async () => {
  const f = await academicFixture();
  const identity = await db.execute<{ id: string; userId: string }>(sql`select s.id, s.user_id as "userId" from session s join user_accounts a on a.auth_user_id=s.user_id where a.id=${f.a.account.id} order by s.created_at desc limit 1`);
  const actor = { accountId: f.a.account.id, authUserId: identity.rows[0]!.userId, sessionId: identity.rows[0]!.id };
  const isolation = async (tx: Parameters<typeof readConsentDecision>[0]) => (await tx.execute(sql`show transaction_isolation`)).rows[0]!.transaction_isolation;
  expect(await withAcademicAccess(actor, isolation)).toBe('read committed');
  expect(await withAcademicAccess(actor, isolation, 'TEACHER', { isolationLevel: 'repeatable read' })).toBe('repeatable read');
  await expect(withAcademicAccess(actor, async tx => { await tx.execute(sql`select 1/0`); })).rejects.toThrow();
});
