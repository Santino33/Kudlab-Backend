import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db/client.js';
import { reset } from '../helpers.js';
import { advancePending, indicatorWorld, runSession } from '../indicator-fixture.js';
import { readStudentSessionResults } from '../../src/modules/evolucion/read/history.service.js';

// Barrera determinista (sin sleep): la lectura espera a que el procesador real termine entre sus dos consultas.
function barrier() { let release!: () => void; const open = new Promise<void>(r => { release = r; }); return { open, release }; }

describe('instantánea y finalización digital entre consultas (T-C03)', () => {
  beforeEach(async () => { await reset(); });
  afterAll(async () => { await reset(); });

  it('bajo REPEATABLE READ del llamador ven una única instantánea aunque el procesador real complete una sesión entre consultas', async () => {
    const w = await indicatorWorld();
    const done = await runSession(w, { startedAt: new Date('2026-03-02T15:00:00Z') });
    const pending = await runSession(w, { startedAt: new Date('2026-04-10T15:00:00Z'), processing: 'none' });
    const input = { studentIds: [w.f.student.id], scope: { kind: 'student-history' as const } };
    const firstRead = barrier(), processed = barrier();
    const reader = db.transaction(async tx => {
      const first = await readStudentSessionResults(tx, input);
      firstRead.release(); await processed.open;
      const second = await readStudentSessionResults(tx, input);
      return { first, second };
    }, { isolationLevel: 'repeatable read' });
    await firstRead.open;
    expect(await advancePending()).toBe(true);      // procesador real, otra conexión
    processed.release();
    const { first, second } = await reader;
    const before = first.items.find(i => i.sessionId === pending.sessionId)!;
    expect(before).toMatchObject({ processingStatus: 'PENDING', calculation: null, indicators: [] });
    expect(second).toEqual(first);                  // misma instantánea: ni cobertura antigua con valor nuevo ni al revés
    // Una lectura nueva ya ve el cálculo completado, completo (24 indicadores) y coherente con la sesión.
    const { items } = await db.transaction(tx => readStudentSessionResults(tx, input));
    const after = items.find(i => i.sessionId === pending.sessionId)!;
    expect(after).toMatchObject({ processingStatus: 'COMPLETED' }); expect(after.calculation).not.toBeNull(); expect(after.indicators).toHaveLength(24);
    expect(items.find(i => i.sessionId === done.sessionId)).toEqual(first.items.find(i => i.sessionId === done.sessionId));
  });
  it('por defecto cada lectura es coherente: sesión con ejecución vigente trae sus 24 indicadores o ninguno, y repetir la operación completa es seguro', async () => {
    const w = await indicatorWorld();
    await runSession(w, { startedAt: new Date('2026-03-02T15:00:00Z') });
    const pending = await runSession(w, { startedAt: new Date('2026-04-10T15:00:00Z'), processing: 'none' });
    const input = { studentIds: [w.f.student.id], scope: { kind: 'student-history' as const } };
    const reads = await Promise.all([db.transaction(tx => readStudentSessionResults(tx, input)), advancePending().then(() => db.transaction(tx => readStudentSessionResults(tx, input)))]);
    for (const { items } of reads) for (const item of items) expect(item.calculation === null ? item.indicators.length === 0 : item.indicators.length === 24).toBe(true);
    const again = await db.transaction(tx => readStudentSessionResults(tx, input));
    expect(again).toEqual(await db.transaction(tx => readStudentSessionResults(tx, input)));
    expect(again.items.find(i => i.sessionId === pending.sessionId)!.processingStatus).toBe('COMPLETED');
  });
});
