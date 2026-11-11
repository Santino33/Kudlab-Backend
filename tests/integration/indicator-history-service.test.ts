import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { reset } from '../helpers.js';
import { indicatorWorld, runSession } from '../indicator-fixture.js';
import { readStudentHistoryPage, readStudentSessionResults } from '../../src/modules/evolucion/read/history.service.js';

const dates = ['2026-03-02T15:00:00Z', '2026-04-10T15:00:00Z', '2026-05-20T15:00:00Z'].map(d => new Date(d));
const counts = async () => (await db.execute(sql`select (select count(*) from task_sessions)::int s, (select count(*) from indicator_calculation_runs)::int r, (select count(*) from calculated_indicators)::int i`)).rows[0];

async function world() {
  const w = await indicatorWorld();
  // La sesión pendiente se crea la última: processOne consume siempre la pendiente más antigua.
  const first = await runSession(w, { startedAt: dates[0]! }), third = await runSession(w, { startedAt: dates[2]!, processing: 'unapproved' }), second = await runSession(w, { startedAt: dates[1]!, processing: 'none' });
  return { w, ids: [first.sessionId, second.sessionId, third.sessionId], studentId: w.f.student.id, teacherId: w.f.a.account.id as string, otherTeacherId: w.f.b.account.id as string };
}
describe('readStudentSessionResults (T-A05)', () => {
  beforeEach(async () => { await reset(); });
  afterAll(async () => { await reset(); });

  it('ordena por fecha descendente, sin ejecución vigente → calculation null, y solo hechos de lectura', async () => {
    const x = await world();
    const { items } = await db.transaction(tx => readStudentSessionResults(tx, { studentIds: [x.studentId], scope: { kind: 'student-history' }, viewerAccountId: x.teacherId }));
    expect(items.map(i => i.sessionId)).toEqual([x.ids[2], x.ids[1], x.ids[0]]);
    expect(items[1]).toMatchObject({ processingStatus: 'PENDING', calculation: null, indicators: [], approvalAtCalculation: null });
    expect(items[0]!.indicators).toHaveLength(24); expect(items[0]!.indicators[0]).toMatchObject({ metricCode: 'accuracy_pct', scope: 'SESSION' });
    expect(items[0]!.indicators.every(i => i.status === 'NOT_AVAILABLE' && i.value === null && i.unavailabilityReason === 'METHOD_NOT_APPROVED')).toBe(true);
    expect(items[2]).toMatchObject({ rule: { code: 'TG01-DESCRIPTIVE-1', approval: { current: 'PROPOSED', approvedAt: null } }, approvalAtCalculation: 'NOT_ESTABLISHED' });
    expect(JSON.stringify(items)).not.toMatch(/assignment|groupId|approvalReference/i);
  });
  it('los valores coinciden con el detalle de sesión y consultar no escribe (CA-10)', async () => {
    const x = await world(), before = await counts();
    const { items } = await db.transaction(tx => readStudentSessionResults(tx, { studentIds: [x.studentId], scope: { kind: 'student-history' }, viewerAccountId: x.teacherId }));
    for (const id of [x.ids[0]!, x.ids[2]!]) {
      const detail = await (await x.w.request(`/task-sessions/${id}`, 'GET', undefined, x.w.f.a.teacher)).json();
      const mine = items.find(i => i.sessionId === id)!;
      expect(mine.indicators.map(i => [i.metricCode, i.scope, i.status, i.value, i.unavailabilityReason])).toEqual(detail.calculation.indicators.map((i: { metricCode: string; scope: string; status: string; value: number | null; unavailabilityReason: string | null }) => [i.metricCode, i.scope, i.status, i.value, i.unavailabilityReason]));
      expect(mine).toMatchObject({ executionStatus: detail.executionStatus, processingStatus: detail.processingStatus, incidentCount: detail.incidentCount, recordedTrialCount: detail.recordedTrialCount, configVersion: detail.configVersion });
    }
    expect(await counts()).toEqual(before);
  });
  it('filtra por instantes (desde inclusivo, antes exclusivo), indicador y alcance', async () => {
    const x = await world(), run = (filter: object) => db.transaction(tx => readStudentSessionResults(tx, { studentIds: [x.studentId], scope: { kind: 'student-history' }, filter, viewerAccountId: x.teacherId }));
    expect((await run({ startedFrom: dates[1]! })).items.map(i => i.sessionId)).toEqual([x.ids[2], x.ids[1]]);
    expect((await run({ startedBefore: dates[1]! })).items.map(i => i.sessionId)).toEqual([x.ids[0]]);
    expect((await run({ startedFrom: new Date('2027-01-01T00:00:00Z') })).items).toEqual([]);
    const narrow = (await run({ metricCodes: ['omission_rate_pct'], scopes: ['SESSION', 'SEGMENT_2'] })).items.find(i => i.sessionId === x.ids[0])!;
    expect(narrow.indicators.map(i => `${i.metricCode}:${i.scope}`)).toEqual(['omission_rate_pct:SESSION', 'omission_rate_pct:SEGMENT_2']);
    expect((await run({ taskId: 'TG-01' })).items).toHaveLength(3);
  });
  it('ámbito de curso por la asignación y detailAccess según el docente que consulta', async () => {
    const x = await world(), read = (scope: object, viewer?: string) => db.transaction(tx => readStudentSessionResults(tx, { studentIds: [x.studentId], scope: scope as never, ...(viewer ? { viewerAccountId: viewer } : {}) }));
    expect((await read({ kind: 'course', groupId: x.w.f.student.groupId })).items).toHaveLength(3);
    expect((await read({ kind: 'course', groupId: x.w.f.bGroups[0]!.id })).items).toEqual([]);
    expect((await read({ kind: 'student-history' }, x.teacherId)).items.every(i => i.detailAccess === 'AVAILABLE')).toBe(true);
    expect((await read({ kind: 'student-history' }, x.otherTeacherId)).items.every(i => i.detailAccess === 'UNAVAILABLE')).toBe(true);
    expect((await read({ kind: 'student-history' })).items.every(i => i.detailAccess === 'UNAVAILABLE')).toBe(true);
    expect((await db.transaction(tx => readStudentSessionResults(tx, { studentIds: [], scope: { kind: 'student-history' } }))).items).toEqual([]);
  });
  it('paginación sin repetir ni omitir', async () => {
    const x = await world(), seen: string[] = [];
    let after: { at: Date; id: string } | undefined;
    for (let n = 0; n < 5; n++) {
      const page = await db.transaction(tx => readStudentHistoryPage(tx, { studentId: x.studentId, viewerAccountId: x.teacherId, limit: 2, ...(after ? { after } : {}) }));
      seen.push(...page.items.map(i => i.sessionId));
      if (!page.next) break; after = page.next;
    }
    expect(seen).toEqual([x.ids[2], x.ids[1], x.ids[0]]);
  });
});

import { readIndicatorCatalog } from '../../src/modules/evolucion/read/catalog.service.js';
import { indicatorDefinitionsResponseSchema } from '../../src/modules/evolucion/read/dto.js';
describe('readIndicatorCatalog (T-A06)', () => {
  beforeEach(async () => { await reset(); });
  it('con TG-01 publicada la regla figura como propuesta; ninguna ruta del código la aprueba', async () => {
    await indicatorWorld();
    const { items } = await readIndicatorCatalog();
    expect(indicatorDefinitionsResponseSchema.safeParse({ items }).success).toBe(true);
    expect(items).toHaveLength(6);
    expect(items.every(i => i.rule?.approval.current === 'PROPOSED' && i.rule.approval.approvedAt === null)).toBe(true);
  });
});
