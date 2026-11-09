import { describe, expect, it } from 'vitest';
import { indicatorHistoryQuerySchema, indicatorHistorySessionSchema, indicatorValueSchema } from '../../src/modules/evolucion/read/dto.js';

const id = '11111111-1111-4111-8111-111111111111';
const calculated = { metricCode: 'accuracy_pct', scope: 'SESSION', status: 'CALCULATED', value: 80, unit: '%', numerator: 8, denominator: 10, sampleSize: 10, unavailabilityReason: null };
const missing = { ...calculated, status: 'NOT_AVAILABLE', value: null, numerator: null, denominator: null, sampleSize: 0, unavailabilityReason: 'NO_VALID_TARGETS' };
const session = { sessionId: id, taskId: 'TG-01', attemptNumber: 1, occurredAt: '2026-03-02T15:00:00.000Z', executionStatus: 'COMPLETED', processingStatus: 'COMPLETED',
  configVersion: 1, publishedVersionId: id, incidentCount: 0, recordedTrialCount: 10, rule: { code: 'TG01-DESCRIPTIVE-1', version: 1, approval: { current: 'PROPOSED', approvedAt: null } },
  approvalAtCalculation: 'NOT_ESTABLISHED', calculation: { runId: id, calculatedAt: '2026-03-02T15:05:00.000Z' }, indicators: [calculated, missing], detailAccess: 'AVAILABLE' };

describe('indicatorValueSchema (ausencia ≠ cero)', () => {
  it('acepta calculado y no disponible coherentes', () => {
    expect(indicatorValueSchema.safeParse(calculated).success).toBe(true);
    expect(indicatorValueSchema.safeParse(missing).success).toBe(true);
  });
  it('rechaza NOT_AVAILABLE con valor, incluido cero, o sin motivo', () => {
    expect(indicatorValueSchema.safeParse({ ...missing, value: 0 }).success).toBe(false);
    expect(indicatorValueSchema.safeParse({ ...missing, unavailabilityReason: null }).success).toBe(false);
  });
  it('rechaza CALCULATED sin valor o con motivo', () => {
    expect(indicatorValueSchema.safeParse({ ...calculated, value: null }).success).toBe(false);
    expect(indicatorValueSchema.safeParse({ ...calculated, unavailabilityReason: 'NO_VALID_RT' }).success).toBe(false);
  });
  it('rechaza métricas, alcances y motivos fuera de catálogo y campos extra', () => {
    expect(indicatorValueSchema.safeParse({ ...calculated, metricCode: 'iq' }).success).toBe(false);
    expect(indicatorValueSchema.safeParse({ ...calculated, scope: 'SEGMENT_4' }).success).toBe(false);
    expect(indicatorValueSchema.safeParse({ ...missing, unavailabilityReason: 'OTHER' }).success).toBe(false);
    expect(indicatorValueSchema.safeParse({ ...calculated, score: 1 }).success).toBe(false);
  });
});

describe('indicatorHistorySessionSchema', () => {
  it('acepta una sesión válida y una sin ejecución vigente', () => {
    expect(indicatorHistorySessionSchema.safeParse(session).success).toBe(true);
    expect(indicatorHistorySessionSchema.safeParse({ ...session, calculation: null, indicators: [], processingStatus: 'PENDING' }).success).toBe(true);
  });
  it('rechaza indicadores sin ejecución vigente y no expone asignación, curso ni referencia de aprobación', () => {
    expect(indicatorHistorySessionSchema.safeParse({ ...session, calculation: null }).success).toBe(false);
    for (const extra of [{ assignmentId: id }, { groupId: id }, { approvalReference: 'x' }]) expect(indicatorHistorySessionSchema.safeParse({ ...session, ...extra }).success).toBe(false);
  });
});

describe('indicatorHistoryQuerySchema', () => {
  it('acepta consulta vacía y filtros válidos, con límite numérico', () => {
    expect(indicatorHistoryQuerySchema.safeParse({}).success).toBe(true);
    const parsed = indicatorHistoryQuerySchema.parse({ metricCode: 'rt_cv_pct', scope: 'SEGMENT_2', from: '2026-03-01', to: '2026-03-31', limit: '50' });
    expect(parsed.limit).toBe(50);
  });
  it('rechaza parámetros desconocidos, límite fuera de 1–100, fechas mal formadas y tarea ajena', () => {
    for (const bad of [{ extra: '1' }, { limit: '0' }, { limit: '101' }, { limit: 'x' }, { from: '2026-3-1' }, { taskId: 'TG-02' }, { metricCode: 'x' }])
      expect(indicatorHistoryQuerySchema.safeParse(bad).success).toBe(false);
  });
});
