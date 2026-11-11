import { describe, expect, it } from 'vitest';
import { approvalAtCalculation, normalizeExecutionStatus } from '../../src/modules/evolucion/read/run-state.js';

const at = (iso: string) => new Date(iso);
const now = at('2026-03-02T16:00:00.000Z');

describe('normalizeExecutionStatus (paridad con el detalle de sesión)', () => {
  const base = { startAllowedUntil: at('2026-03-02T15:00:00.000Z'), startedAtServer: at('2026-03-02T15:00:00.000Z') as Date | null };
  it('READY con ventana vencida o justo en el límite pasa a EXPIRED', () => {
    expect(normalizeExecutionStatus({ ...base, executionStatus: 'READY' }, now)).toBe('EXPIRED');
    expect(normalizeExecutionStatus({ ...base, executionStatus: 'READY', startAllowedUntil: now }, now)).toBe('EXPIRED');
    expect(normalizeExecutionStatus({ ...base, executionStatus: 'READY', startAllowedUntil: at('2026-03-02T16:00:00.001Z') }, now)).toBe('READY');
  });
  it('RUNNING a 32 min exactos pasa a UNCONFIRMED; un milisegundo antes sigue RUNNING', () => {
    const started = at('2026-03-02T15:28:00.000Z'); // 32 min antes de `now`
    expect(normalizeExecutionStatus({ ...base, executionStatus: 'RUNNING', startedAtServer: started }, now)).toBe('UNCONFIRMED');
    expect(normalizeExecutionStatus({ ...base, executionStatus: 'RUNNING', startedAtServer: new Date(started.getTime() + 1) }, now)).toBe('RUNNING');
  });
  it('los estados terminales no cambian', () => {
    for (const s of ['COMPLETED', 'INTERRUPTED', 'EXPIRED', 'UNCONFIRMED'] as const) expect(normalizeExecutionStatus({ ...base, executionStatus: s }, now)).toBe(s);
  });
});

describe('approvalAtCalculation (D-8, sin inventar historia)', () => {
  const finished = at('2026-03-02T15:05:00.000Z');
  it('APPROVED solo si approved_at ≤ fin del cálculo', () => {
    expect(approvalAtCalculation({ approvalStatus: 'APPROVED', approvedAt: at('2026-03-01T00:00:00.000Z') }, finished)).toBe('APPROVED');
    expect(approvalAtCalculation({ approvalStatus: 'APPROVED', approvedAt: finished }, finished)).toBe('APPROVED');
  });
  it('NOT_ESTABLISHED si fue aprobada después, sin fecha, sin fin de cálculo o si está propuesta', () => {
    expect(approvalAtCalculation({ approvalStatus: 'APPROVED', approvedAt: at('2026-03-03T00:00:00.000Z') }, finished)).toBe('NOT_ESTABLISHED');
    expect(approvalAtCalculation({ approvalStatus: 'APPROVED', approvedAt: null }, finished)).toBe('NOT_ESTABLISHED');
    expect(approvalAtCalculation({ approvalStatus: 'APPROVED', approvedAt: at('2026-03-01T00:00:00.000Z') }, null)).toBe('NOT_ESTABLISHED');
    expect(approvalAtCalculation({ approvalStatus: 'PROPOSED', approvedAt: at('2026-03-01T00:00:00.000Z') }, finished)).toBe('NOT_ESTABLISHED');
  });
});
