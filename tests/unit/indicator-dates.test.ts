import { describe, expect, it } from 'vitest';
import { bogotaDayRange, IndicatorDateRangeError } from '../../src/modules/evolucion/read/dates.js';

describe('bogotaDayRange (America/Bogota, UTC−5 fijo)', () => {
  it('sin parámetros no filtra', () => { expect(bogotaDayRange()).toEqual({}); });
  it('from inicia a las 00:00 locales (05:00 UTC)', () => {
    expect(bogotaDayRange('2026-03-02').startedFrom?.toISOString()).toBe('2026-03-02T05:00:00.000Z');
  });
  it('to es inclusivo: el límite exclusivo es el día siguiente 00:00 locales', () => {
    expect(bogotaDayRange(undefined, '2026-03-02').startedBefore?.toISOString()).toBe('2026-03-03T05:00:00.000Z');
  });
  it('from igual a to cubre un día completo', () => {
    const r = bogotaDayRange('2026-06-10', '2026-06-10');
    expect(r.startedFrom?.toISOString()).toBe('2026-06-10T05:00:00.000Z');
    expect(r.startedBefore?.toISOString()).toBe('2026-06-11T05:00:00.000Z');
  });
  it('acepta años bisiestos y cambio de mes', () => {
    expect(bogotaDayRange('2026-02-28', '2026-03-01').startedBefore?.toISOString()).toBe('2026-03-02T05:00:00.000Z');
    expect(bogotaDayRange('2028-02-28', '2028-02-29').startedBefore?.toISOString()).toBe('2028-03-01T05:00:00.000Z');
  });
  it.each([
    ['2026-02-30', undefined], ['2025-02-29', undefined], ['2026-13-01', undefined],
    ['2026-1-01', undefined], ['2026-03-02', '2026-03-01'], ['x', undefined],
  ])('rechaza %s / %s', (from, to) => {
    expect(() => bogotaDayRange(from, to)).toThrow(IndicatorDateRangeError);
  });
});
