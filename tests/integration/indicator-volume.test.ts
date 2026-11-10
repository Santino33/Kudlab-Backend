import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { reset } from '../helpers.js';
import { indicatorWorld, seedCourseYear } from '../indicator-fixture.js';
import { readStudentHistoryPage, readStudentSessionResults, RESULT_SET_LIMIT, ResultSetTooLargeError } from '../../src/modules/evolucion/read/history.service.js';

// Capa b (volumen): inserciones directas; recordedTrialCount no es representativo y este conjunto no acredita evidencia ni gameplay.
describe('volumen de curso/año y límite del conjunto (T-C02, T-G04)', () => {
  beforeEach(async () => { await reset(); });
  afterAll(async () => { await reset(); });

  it('exactamente RESULT_SET_LIMIT sesiones pasan completas; límite + 1 lanza RESULT_SET_TOO_LARGE, nunca parcial', async () => {
    const w = await indicatorWorld(), seeded = await seedCourseYear(w, { sessions: RESULT_SET_LIMIT });
    expect(seeded.sessions).toBe(RESULT_SET_LIMIT); expect(seeded.studentIds).toHaveLength(40);
    const count = (await db.execute(sql`select count(*)::int n from task_sessions where participation_authorization_ref = 'SYNTHETIC-VOLUME'`)).rows[0]!.n;
    expect(count).toBe(RESULT_SET_LIMIT);
    const t0 = performance.now(), heap0 = process.memoryUsage().heapUsed;
    const { items } = await db.transaction(tx => readStudentSessionResults(tx, { studentIds: seeded.studentIds, scope: { kind: 'course', groupId: seeded.groupId } }));
    const ms = Math.round(performance.now() - t0), heapMb = Math.round((process.memoryUsage().heapUsed - heap0) / 1e6);
    console.log(JSON.stringify({ event: 'indicator_volume_measure', generatorVersion: seeded.generatorVersion, sessions: items.length, students: seeded.students, assignments: seeded.assignments, readMs: ms, heapDeltaMb: heapMb, limit: RESULT_SET_LIMIT }));
    expect(items).toHaveLength(RESULT_SET_LIMIT);
    for (let i = 1; i < items.length; i++) expect(items[i - 1]!.occurredAt >= items[i]!.occurredAt).toBe(true);
    expect(items.every(i => i.calculation !== null && i.indicators.length === 24)).toBe(true);
    expect(new Set(items.map(i => i.sessionId)).size).toBe(RESULT_SET_LIMIT);
    // Un solo estudiante del conjunto: paginación completa sin repetir ni omitir.
    const one = seeded.studentIds[0]!, seen: string[] = [];
    let after: { at: Date; id: string } | undefined;
    for (let n = 0; n < 10; n++) {
      const page = await db.transaction(tx => readStudentHistoryPage(tx, { studentId: one, viewerAccountId: w.f.a.account.id, limit: 100, ...(after ? { after } : {}) }));
      seen.push(...page.items.map(i => i.sessionId)); if (!page.next) break; after = page.next;
    }
    expect(seen).toHaveLength(RESULT_SET_LIMIT / 40); expect(new Set(seen).size).toBe(seen.length);
  }, 600000);

  it('límite + 1 falla con ResultSetTooLargeError', async () => {
    const w = await indicatorWorld(), seeded = await seedCourseYear(w, { sessions: RESULT_SET_LIMIT + 1 });
    await expect(db.transaction(tx => readStudentSessionResults(tx, { studentIds: seeded.studentIds, scope: { kind: 'course', groupId: seeded.groupId } }))).rejects.toBeInstanceOf(ResultSetTooLargeError);
    await expect(db.transaction(tx => readStudentSessionResults(tx, { studentIds: seeded.studentIds, scope: { kind: 'course', groupId: seeded.groupId } }))).rejects.toMatchObject({ code: 'RESULT_SET_TOO_LARGE' });
  }, 600000);
});
