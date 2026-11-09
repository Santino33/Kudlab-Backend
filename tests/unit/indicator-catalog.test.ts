import { describe, expect, it } from 'vitest';
import { buildIndicatorCatalog } from '../../src/modules/evolucion/read/catalog.service.js';
import { indicatorDefinitionsResponseSchema } from '../../src/modules/evolucion/read/dto.js';

describe('buildIndicatorCatalog', () => {
  it('sin regla publicada: rule null en los seis indicadores y respuesta válida', () => {
    const items = buildIndicatorCatalog(undefined);
    expect(items).toHaveLength(6); expect(items.every(i => i.rule === null)).toBe(true);
    expect(indicatorDefinitionsResponseSchema.safeParse({ items }).success).toBe(true);
  });
  it('regla propuesta o aprobada se refleja sin exponer referencia de aprobación', () => {
    const proposed = buildIndicatorCatalog({ approvalStatus: 'PROPOSED', approvedAt: null });
    expect(proposed[0]!.rule).toEqual({ code: 'TG01-DESCRIPTIVE-1', version: 1, approval: { current: 'PROPOSED', approvedAt: null } });
    const approved = buildIndicatorCatalog({ approvalStatus: 'APPROVED', approvedAt: new Date('2026-03-01T00:00:00Z') });
    expect(approved[5]!.rule?.approval).toEqual({ current: 'APPROVED', approvedAt: '2026-03-01T00:00:00.000Z' });
    expect(JSON.stringify(approved)).not.toContain('approvalReference');
    expect(indicatorDefinitionsResponseSchema.safeParse({ items: approved }).success).toBe(true);
  });
});
