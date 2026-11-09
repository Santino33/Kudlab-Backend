import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { calculate, RULE } from '../../src/modules/evolucion/tg01.js';
import { INDICATOR_DEFINITIONS, UNAVAILABILITY_REASONS } from '../../src/modules/evolucion/read/definitions.js';
import type { Envelope } from '../../src/modules/tareas/runtime/contract.js';

const envelope = {
  timing: { startedAtMs: 0, finishedAtMs: 100_000 }, incidents: [],
  events: [
    { trial: 1, segment: 1, stimulus: 'star', result: 'hit', presentedAtMs: 0, respondedAtMs: 400, closedAtMs: 1000 },
    { trial: 2, segment: 1, stimulus: 'star', result: 'miss', presentedAtMs: 1000, respondedAtMs: null, closedAtMs: 2000 },
    { trial: 3, segment: 2, stimulus: 'moon', result: 'false_alarm', presentedAtMs: 2000, respondedAtMs: 2300, closedAtMs: 3000 },
    { trial: 4, segment: 2, stimulus: 'moon', result: 'correct_rejection', presentedAtMs: 3000, respondedAtMs: null, closedAtMs: 4000 },
    { trial: 5, segment: 3, stimulus: 'star', result: 'hit', presentedAtMs: 4000, respondedAtMs: 4600, closedAtMs: 5000 },
  ],
} as unknown as Envelope;

describe('catálogo de indicadores TG-01', () => {
  const result = calculate(envelope, true).indicators;
  it('tiene exactamente los seis indicadores de TG-01 en orden', () => {
    expect(INDICATOR_DEFINITIONS.map(d => d.metricCode)).toEqual(['accuracy_pct', 'omission_rate_pct', 'commission_rate_pct', 'median_reaction_time_ms', 'rt_sd_ms', 'rt_cv_pct']);
    expect(INDICATOR_DEFINITIONS.every(d => d.taskId === 'TG-01')).toBe(true);
  });
  it('métricas, alcances y unidades coinciden con lo que calcula tg01', () => {
    for (const d of INDICATOR_DEFINITIONS) {
      const produced = result.filter(i => i.metricCode === d.metricCode);
      expect(produced.map(i => i.scope)).toEqual([...d.scopes]);
      expect(new Set(produced.map(i => i.unit))).toEqual(new Set([d.unit]));
    }
    expect(new Set(result.map(i => i.metricCode))).toEqual(new Set(INDICATOR_DEFINITIONS.map(d => d.metricCode)));
  });
  it('cada motivo declarado existe en tg01 y todo motivo de tg01 está declarado', () => {
    const source = readFileSync(new URL('../../src/modules/evolucion/tg01.ts', import.meta.url), 'utf8');
    const declared = new Set(INDICATOR_DEFINITIONS.flatMap(d => d.unavailabilityReasons));
    for (const reason of declared) expect(source).toContain(`'${reason}'`);
    expect([...declared].sort()).toEqual([...UNAVAILABILITY_REASONS].sort());
    const inSource = [...source.matchAll(/'((?:NO_VALID|INSUFFICIENT|SEGMENT_NOT|TECHNICAL_EXCLUSION|ZERO_MEAN|METHOD_NOT)[A-Z0-9_]*)'/g)].map(m => m[1]!);
    expect(inSource.length).toBeGreaterThan(0);
    for (const reason of new Set(inSource)) expect(declared.has(reason as never)).toBe(true);
  });
  it('declara la regla y no usa lenguaje diagnóstico', () => {
    expect(RULE.code).toBe('TG01-DESCRIPTIVE-1');
    const text = JSON.stringify(INDICATOR_DEFINITIONS).toLowerCase();
    for (const word of ['diagnóstic', 'déficit', 'anormal', 'ranking', 'riesgo', 'mejora', 'empeora', 'tendencia']) expect(text).not.toContain(word);
  });
});
