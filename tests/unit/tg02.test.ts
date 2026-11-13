import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import bank from '../../src/modules/tareas/runtime/tg02/items.json' with { type: 'json' };
import { buildSequence, originalSequenceHash } from '../../src/modules/tareas/runtime/tg02/sequence.js';
import { PROFILE } from '../../src/modules/tareas/runtime/tg02/profile.js';
import { hash } from '../../src/modules/tareas/runtime/contract.js';
import { calculate, type Trial } from '../../src/modules/evolucion/tg02.js';

const original = createRequire(import.meta.url)('../fixtures/tg02/original.cjs');
const sequence = buildSequence();
const trials = (count = 18): Trial[] => sequence.seq.slice(0, count).map((row, i) => ({
  trial: i + 1, itemId: row.item.id, selectedIdx: row.targetIdx, rtMs: 400 + i * 100,
  valid: true, invalidReason: null, closureReason: 'response',
}));
function oracle(events: Trial[]) {
  return original.computeIndicators(events.map((event, i) => {
    const row = sequence.seq[i]!;
    const rt = event.rtMs === null ? null : Math.round(event.rtMs * 10) / 10;
    return { level: row.item.level, segment: row.plannedSegment, selectedIdx: event.selectedIdx, rtMs: rt,
      valid: event.valid && event.invalidReason === null,
      result: event.closureReason === 'response' ? event.selectedIdx === row.targetIdx ? 'correct' : 'incorrect' :
        event.closureReason === 'timeout' ? 'omission' : null,
      anticipatory: rt !== null && rt < 400 };
  }), original.CONFIG);
}

describe('TG02 reference parity — CA-05/06/07/08/10', () => {
  it('preserves the exact source bank, fixed RNG sequence, practice and original hash', () => {
    const bytes = readFileSync(new URL('../../src/modules/tareas/runtime/tg02/items.json', import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('869979e45ad25c05b186732c0eed5b1ba08a1486f9fbd2c414557499108a7157');
    const expected = original.buildSequence(bank, original.CONFIG);
    expect(sequence).toEqual(expected);
    expect(originalSequenceHash(sequence.seq)).toBe(original.hashString(JSON.stringify(expected.seq.map((row: typeof sequence.seq[number]) => [row.item.id, row.words]))));
    expect(PROFILE.bankHash).toBe(hash(bank));
    expect(PROFILE.sequenceHash).toBe(hash(expected));
    expect(PROFILE.validationStatus).toContain('PENDIENTE');
    expect(sequence.practice).toHaveLength(3);
    expect(new Set(sequence.seq.map(row => row.item.id)).size).toBe(18);
    for (const segment of [1, 2, 3]) for (const level of [1, 2, 3])
      expect(sequence.seq.filter(row => row.plannedSegment === segment && row.item.level === level)).toHaveLength(2);
    for (const position of [0, 1, 2, 3]) expect([4, 5]).toContain(sequence.seq.filter(row => row.targetIdx === position).length);
    for (let i = 2; i < 18; i++) {
      expect(new Set(sequence.seq.slice(i - 2, i + 1).map(row => row.targetIdx)).size).toBeGreaterThan(1);
      expect(new Set(sequence.seq.slice(i - 2, i + 1).map(row => row.item.level)).size).toBeGreaterThan(1);
    }
    sequence.seq[0]!.words[0] = 'mutated caller';
    expect(buildSequence()).toEqual(expected);
    sequence.seq[0]!.words[0] = expected.seq[0].words[0];
  });

  it('matches original summaries across 200 deterministic complete/partial/mixed sessions', () => {
    for (let scenario = 0; scenario < 200; scenario++) {
      const events = trials(scenario % 19).map((event, i): Trial => {
        const mode = (scenario * 7 + i * 3) % 11;
        if (mode === 0) return { ...event, selectedIdx: null, rtMs: null, closureReason: 'timeout' };
        if (mode === 1) return { ...event, valid: false, invalidReason: 'tab_hidden' };
        if (mode === 2) return { ...event, selectedIdx: (event.selectedIdx! + 1) % 4 };
        if (mode === 3) return { ...event, rtMs: 399.9 };
        return { ...event, rtMs: 400 + (scenario * 37 + i * 13) / 10 };
      });
      if (scenario % 3 === 0 && events.length) events[events.length - 1] = {
        ...events.at(-1)!, selectedIdx: null, rtMs: null, closureReason: 'interruption', valid: false, invalidReason: 'interruption',
      };
      expect(calculate({ events }, true).summary).toEqual(oracle(events));
    }
  });

  it('keeps anticipatory correct answers in accuracy, but requires 5 global and 3 group RTs', () => {
    const events = trials(5);
    events[0]!.rtMs = 399.9;
    let result = calculate({ events }, true);
    expect(result.summary.overall).toMatchObject({ precisionPct: 100, nRt: 4, nAnticipatory: 1, rtMeanMs: null });
    events[0]!.rtMs = 400;
    result = calculate({ events }, true);
    expect(result.summary.overall).toMatchObject({ nRt: 5, rtMeanMs: 600, rtSdMs: 141.4, rtCvPct: 23.6 });
    expect(calculate({ events: trials(2) }, true).summary.bySegment[0]!.rtMeanMs).toBeNull();
    expect(calculate({ events: trials(3) }, true).summary.bySegment[0]!.rtMeanMs).toBe(500);
  });

  it('separates omission/error and excludes invalid and interrupted items, without fictitious zero', () => {
    const events = trials(4);
    events[1] = { ...events[1]!, selectedIdx: null, rtMs: null, closureReason: 'timeout' };
    events[2] = { ...events[2]!, valid: false, invalidReason: 'focus_lost' };
    events[3] = { ...events[3]!, selectedIdx: null, rtMs: null, closureReason: 'interruption' };
    expect(calculate({ events }, true).summary.overall).toMatchObject({ nPresented: 4, nValid: 2, precisionPct: 50, errorRatePct: 0, omissionRatePct: 50 });
    expect(calculate({ events: [] }, true).summary.overall).toMatchObject({ nPresented: 0, nValid: 0, precisionPct: null, rtMeanMs: null });
    expect(calculate({ events: [] }, true).indicators[0]!.unavailabilityReason).toBe('NO_VALID_ITEMS');
  });

  it('gates every indicator and summary metric when the method is not approved', () => {
    const result = calculate({ events: trials() }, false);
    expect(result.indicators).toHaveLength(49);
    expect(result.indicators.every(row => row.value === null && row.unavailabilityReason === 'METHOD_NOT_APPROVED')).toBe(true);
    expect(result.summary.overall).toMatchObject({ precisionPct: null, rtMeanMs: null, status: 'method_not_approved', nValid: 18 });
  });

  it('refuses reordered identity, invalid selections and impossible response time', () => {
    for (const change of [{ trial: 2 }, { itemId: 'other' }, { selectedIdx: 4 }, { rtMs: NaN }, { rtMs: -1 },
      { closureReason: 'timeout' as const }, { selectedIdx: null }]) {
      expect(() => calculate({ events: [{ ...trials(1)[0]!, ...change }] }, true)).toThrow();
    }
  });
});
