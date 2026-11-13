import { describe, expect, it } from 'vitest';
import { BANK } from '../../src/modules/tareas/runtime/tg03/bank.js';
import { calculate } from '../../src/modules/evolucion/tg03.js';
import { envelope } from '../tg03-envelope.js';
import type { Envelope } from '../../src/modules/tareas/runtime/tg03/contract.js';

const metric = (result: ReturnType<typeof calculate>, code: string, scope = 'SESSION') => result.indicators.find(value => value.metricCode === code && value.scope === scope)!;
function respond(trial: Envelope['events'][number], result: 'correct' | 'incorrect' | 'omission' | 'interrupted', rt = 500) {
  const item = BANK.items.find(item => item.id === trial.itemId)!;
  if (result === 'omission' || result === 'interrupted') {
    Object.assign(trial, { selectedIdx: null, selectedAtMs: null, responseDevice: null, closureReason: result === 'omission' ? 'timeout' : 'interruption',
      closedAtMs: trial.optionsShownAtMs! + (result === 'omission' ? 30000 : 100) });
  } else Object.assign(trial, { selectedIdx: result === 'correct' ? item.correctIdx : (item.correctIdx + 1) % 4,
    selectedAtMs: trial.optionsShownAtMs! + rt, closedAtMs: trial.optionsShownAtMs! + rt });
}

describe('TG03-DESCRIPTIVE-1 / CA-09,10,13', () => {
  it('reproduces the approved isolated arithmetic oracle, not a continuation-eligible production session', () => {
    const e = envelope(); const groups = [1, 2, 3, 4].map(load => e.events.filter(trial => trial.load === load));
    respond(groups[0]![0]!, 'correct', 500); respond(groups[0]![1]!, 'correct', 700); respond(groups[0]![2]!, 'interrupted');
    respond(groups[1]![0]!, 'correct', 900); respond(groups[1]![1]!, 'incorrect'); respond(groups[1]![2]!, 'omission');
    respond(groups[2]![0]!, 'correct', 300); respond(groups[2]![1]!, 'correct', 1100); respond(groups[2]![2]!, 'omission');
    respond(groups[3]![0]!, 'correct', 1300); respond(groups[3]![1]!, 'incorrect'); respond(groups[3]![2]!, 'incorrect');
    const r = calculate(e, true);
    expect(r.summary).toMatchObject({ observed: 12, included: 11, excluded: 1, nCorrect: 6, nIncorrect: 3, nOmission: 2, nAnticipatory: 1, nRt: 5 });
    expect(metric(r, 'accuracy_pct').value).toBeCloseTo(600 / 11);
    expect(metric(r, 'error_rate_pct').value).toBeCloseTo(300 / 11);
    expect(metric(r, 'omission_rate_pct').value).toBeCloseTo(200 / 11);
    expect(metric(r, 'mean_reaction_time_ms').value).toBe(900);
    expect(metric(r, 'median_reaction_time_ms').value).toBe(900);
    expect(metric(r, 'rt_sd_ms').value).toBeCloseTo(Math.sqrt(80000));
    expect(metric(r, 'rt_cv_pct').value).toBeCloseTo(Math.sqrt(80000) / 9);
    expect(metric(r, 'delta_precision_pts').value).toBeCloseTo(-200 / 3);
    expect(metric(r, 'delta_precision_rel_pct').value).toBeCloseTo(-200 / 3);
    for (const load of [1, 2, 3, 4]) expect(metric(r, 'median_reaction_time_ms', `LOAD_${load}`).unavailabilityReason).toBe('INSUFFICIENT_RT_DATA');
    expect(r.summary.selectionPositionCounts.reduce((sum, value) => sum + value, 0)).toBe(9);
    expect(r.decisions.filter(row => row.included && row.anticipatory)).toHaveLength(1);
  });
  it('uses the exact 400ms boundary without excluding anticipatories from accuracy', () => {
    const e = envelope();
    respond(e.events[0]!, 'correct', 399.999); respond(e.events[1]!, 'correct', 400);
    const r = calculate(e, true);
    expect(r.decisions[0]).toMatchObject({ included: true, rtIncluded: false, anticipatory: true });
    expect(r.decisions[1]).toMatchObject({ included: true, rtIncluded: true, anticipatory: false });
    expect(metric(r, 'accuracy_pct').value).toBe(100);
  });
  it.each([4, 5])('requires five eligible global times, observed %s', n => {
    const e = envelope();
    e.events.forEach((trial, index) => respond(trial, index < n ? 'correct' : 'incorrect'));
    expect(metric(calculate(e, true), 'mean_reaction_time_ms').status).toBe(n === 5 ? 'CALCULATED' : 'NOT_AVAILABLE');
  });
  it.each([2, 3])('requires three eligible times per load, observed %s', n => {
    const e = envelope(); const group = e.events.filter(trial => trial.load === 2);
    group.forEach((trial, index) => respond(trial, index < n ? 'correct' : 'incorrect'));
    expect(metric(calculate(e, true), 'rt_sd_ms', 'LOAD_2').status).toBe(n === 3 ? 'CALCULATED' : 'NOT_AVAILABLE');
  });
  it('does not invent zero when no measurement exists, but keeps chance as a reference', () => {
    const e = envelope(); e.events = [];
    const r = calculate(e, true);
    expect(metric(r, 'accuracy_pct')).toMatchObject({ value: null, denominator: 0, unavailabilityReason: 'NO_VALID_ITEMS' });
    expect(metric(r, 'accuracy_pct', 'LOAD_1').unavailabilityReason).toBe('LOAD_NOT_REACHED');
    expect(metric(r, 'delta_precision_pts').unavailabilityReason).toBe('INSUFFICIENT_LOAD_DATA');
    expect(metric(r, 'selection_position_1_count').value).toBeNull();
    expect(metric(r, 'chance_level_pct')).toMatchObject({ value: 25, sampleSize: 0 });
  });
  it('keeps real zero accuracy with omissions, and guards division by zero baseline', () => {
    const e = envelope(); e.events.forEach(trial => respond(trial, 'omission'));
    const r = calculate(e, true);
    expect(metric(r, 'accuracy_pct').value).toBe(0);
    expect(metric(r, 'omission_rate_pct').value).toBe(100);
    expect(metric(r, 'delta_precision_pts').value).toBe(0);
    expect(metric(r, 'delta_precision_rel_pct')).toMatchObject({ value: null, unavailabilityReason: 'ZERO_BASELINE' });
    expect(metric(r, 'mean_reaction_time_ms')).toMatchObject({ value: null, sampleSize: 0, unavailabilityReason: 'INSUFFICIENT_RT_DATA' });
  });
  it('distinguishes network context, technical exclusion and interruption from a child error', () => {
    const e = envelope(); const first = e.events[0]!;
    e.incidents = [{ sequence: 1, type: 'network_lost', clockId: e.clock.id, atMs: first.startedAtMs, endedAtMs: null, recordedAtClient: null, category: 'CONTEXT_ONLY' }];
    expect(calculate(e, true).decisions[0]!.included).toBe(true);
    e.incidents[0] = { ...e.incidents[0]!, type: 'focus_lost', category: 'EXECUTION_INTERRUPTED', atMs: first.startedAtMs + 100, endedAtMs: first.closedAtMs };
    expect(calculate(e, true).decisions[0]).toMatchObject({ included: false, rtIncluded: false, reason: 'TECHNICAL_EXCLUSION' });
  });
  it('never publishes personal indicators for an unapproved method or mixes practice with measurement', () => {
    const e = envelope();
    const r = calculate(e, false);
    expect(r.indicators.every(indicator => indicator.value === null && indicator.unavailabilityReason === 'METHOD_NOT_APPROVED')).toBe(true);
    expect(r.summary.observed).toBe(12);
    expect(r.summary.nRt).toBe(12);
    expect(new Set(r.indicators.map(value => `${value.metricCode}:${value.scope}`)).size).toBe(r.indicators.length);
  });
});
