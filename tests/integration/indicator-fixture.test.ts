import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { calculatedIndicators, calculationRuns, gameSessions } from '../../src/db/schema/game.js';
import { reset } from '../helpers.js';
import { advancePending, indicatorWorld, runSession, type TrialSpec } from '../indicator-fixture.js';

async function indicators(sessionId: string) {
  const [s] = await db.select().from(gameSessions).where(eq(gameSessions.id, sessionId));
  const rows = s!.activeCalculationRunId ? await db.select().from(calculatedIndicators).where(eq(calculatedIndicators.runId, s!.activeCalculationRunId)) : [];
  return { session: s!, rows, byKey: new Map(rows.map(r => [`${r.metricCode}:${r.scope}`, r])) };
}
describe('generador de escenarios de indicadores (capa a, flujo real)', () => {
  beforeEach(async () => { await reset(); });
  afterAll(async () => { await reset(); });

  it('sesión completa: valores calculados y ejecución vigente', async () => {
    const w = await indicatorWorld(), s = await runSession(w);
    const r = await indicators(s.sessionId);
    expect(r.session.processingStatus).toBe('COMPLETED'); expect(r.session.executionStatus).toBe('COMPLETED');
    expect(r.rows).toHaveLength(24);
    expect(r.byKey.get('accuracy_pct:SESSION')).toMatchObject({ status: 'CALCULATED' });
    expect(Number(r.byKey.get('accuracy_pct:SESSION')!.value)).toBeCloseTo(66.666667, 5);
  });
  it('segmento no alcanzado: duración corta', async () => {
    const w = await indicatorWorld(), trials: TrialSpec[] = [{ result: 'hit', at: 1000, rt: 300 }, { result: 'miss', at: 3000 }];
    const r = await indicators((await runSession(w, { trials, durationMs: 20000, state: 'interrupted' })).sessionId);
    expect(r.byKey.get('accuracy_pct:SEGMENT_2')).toMatchObject({ status: 'NOT_AVAILABLE', unavailabilityReason: 'SEGMENT_NOT_REACHED', value: null });
    expect(r.byKey.get('accuracy_pct:SEGMENT_1')).toMatchObject({ status: 'CALCULATED' });
  });
  it('exclusión técnica por incidencia que cubre todos los ensayos de un segmento', async () => {
    const w = await indicatorWorld();
    const r = await indicators((await runSession(w, { incidents: [{ type: 'focus_lost', atMs: 0, endedAtMs: 20000 }] })).sessionId);
    expect(r.byKey.get('accuracy_pct:SEGMENT_1')).toMatchObject({ status: 'NOT_AVAILABLE', unavailabilityReason: 'TECHNICAL_EXCLUSION' });
    expect(r.byKey.get('accuracy_pct:SEGMENT_2')).toMatchObject({ status: 'CALCULATED' });
  });
  it('método no aprobado, cálculo pendiente y cálculo fallido', async () => {
    const w = await indicatorWorld();
    const unapproved = await indicators((await runSession(w, { processing: 'unapproved' })).sessionId);
    expect(unapproved.byKey.get('accuracy_pct:SESSION')).toMatchObject({ status: 'NOT_AVAILABLE', unavailabilityReason: 'METHOD_NOT_APPROVED' });
    const pending = await runSession(w, { processing: 'none' });
    const p = await indicators(pending.sessionId);
    expect(p.session.processingStatus).toBe('PENDING'); expect(p.rows).toHaveLength(0); expect(p.session.activeCalculationRunId).toBeNull();
    expect(await advancePending()).toBe(true);
    expect((await indicators(pending.sessionId)).session.processingStatus).toBe('COMPLETED');
    const failed = await runSession(w, { processing: 'failed' });
    const fr = await indicators(failed.sessionId);
    expect(fr.session.processingStatus).toBe('FAILED'); expect(fr.rows).toHaveLength(0);
    expect((await db.select().from(calculationRuns).where(eq(calculationRuns.sessionId, failed.sessionId)))[0]!.status).toBe('FAILED');
  });
  it('varios intentos con fechas controladas y es repetible', async () => {
    const w = await indicatorWorld();
    const a = await runSession(w, { startedAt: new Date('2026-03-02T15:00:00Z') }), b = await runSession(w, { startedAt: new Date('2026-04-10T15:00:00Z') });
    const sessions = await db.select().from(gameSessions);
    expect(new Set(sessions.map(s => s.attemptNumber))).toEqual(new Set([1, 2]));
    expect((await indicators(a.sessionId)).byKey.get('accuracy_pct:SESSION')!.value).toBe((await indicators(b.sessionId)).byKey.get('accuracy_pct:SESSION')!.value);
    expect(sessions.find(s => s.id === a.sessionId)!.startedAtServer!.toISOString()).toBe('2026-03-02T15:00:00.000Z');
  });
});
