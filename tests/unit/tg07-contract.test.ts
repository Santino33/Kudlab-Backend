import { describe, expect, it } from 'vitest';
import { configSchema, envelopeSchema, profile } from '../../src/modules/tareas/runtime/tg07/contract.js';
import { buildSequences } from '../../src/modules/tareas/runtime/tg07/sequence.js';
import { calculate } from '../../src/modules/evolucion/tg07.js';
import { drumTrial, envelope } from '../tg07-envelope.js';

describe('TG-07 strict evidence / CA-02,04,07,09', () => {
  it('accepts a deterministic completed session and recalculates zero accuracy', () => {
    const parsed = envelopeSchema.parse(envelope());
    expect(calculate(parsed, true).summary).toMatchObject({ observed: 2, included: 2, correctTrials: 0 });
  });
  it.each(['seed', 'startLength', 'maxLength', 'stimOnMs', 'responseTimeoutMs'] as const)('rejects altered fixed config: %s', key => {
    expect(configSchema.safeParse({ ...profile(), [key]: 42 }).success).toBe(false);
  });
  it('rejects altered sequence hashes, unexpected fields and task/build/version identities', () => {
    expect(configSchema.safeParse({ ...profile(), sequenceHash: 'f'.repeat(64) }).success).toBe(false);
    for (const delta of [{ taskId: 'TG-03' }, { gameBuildId: 'tg01-1' }, { contractVersion: '1.1' },
      { configurationHash: '0'.repeat(64) }, { summary: { precisionPct: 100 } }])
      expect(envelopeSchema.safeParse({ ...envelope(), ...delta }).success).toBe(false);
  });
  it.each(['trial', 'length', 'sequenceIndex', 'attemptAtLength'] as const)('rejects crossed trial identity: %s', key => {
    const e = envelope(); e.events[0]![key] = 7;
    expect(envelopeSchema.safeParse(e).success).toBe(false);
  });
  it('rejects sequence alteration and repeated trials', () => {
    const e = envelope(); e.events[0]!.sequence.reverse();
    expect(envelopeSchema.safeParse(e).success).toBe(false);
    const repeated = envelope(); repeated.events[1] = structuredClone(repeated.events[0]!);
    expect(envelopeSchema.safeParse(repeated).success).toBe(false);
  });
  it('accepts one reserve and preserves its attempt-at-length metadata', () => {
    const e = envelope(); e.events[0]!.valid = false; e.events[0]!.invalidReason = 'focus_lost';
    e.events[1]!.attemptAtLength = 1;
    const reserve = { ...drumTrial(buildSequences().byLength[2]![2]!, e.events[1]!.closedAtMs + 1500), trial: 3,
      sequenceIndex: 2, attemptAtLength: 2, isReplacement: true };
    e.events.push(reserve);
    e.timing.finishedAtMs = e.timing.lastCheckpointAtMs = e.timing.measurementFinishedAtMs = reserve.closedAtMs + 1500;
    expect(envelopeSchema.safeParse(e).success).toBe(true);
    e.events.push({ ...reserve, trial: 4 });
    expect(envelopeSchema.safeParse(e).success).toBe(false);
  });
  it('rejects continuing beyond the original failure criterion', () => {
    const e = envelope(); e.events.push({ ...drumTrial(buildSequences().byLength[3]![0]!, e.events[1]!.closedAtMs + 1500), trial: 3 });
    e.timing.finishedAtMs = e.timing.lastCheckpointAtMs = e.timing.measurementFinishedAtMs = e.events[2]!.closedAtMs + 1500;
    expect(envelopeSchema.safeParse(e).success).toBe(false);
  });
  it('accepts interruption before measurement with no fabricated practice or trials', () => {
    const e = envelope(); Object.assign(e, { state: 'interrupted', terminationReason: 'user_exit', phaseReached: 'intro', events: [] });
    e.preparation = { instruction: { shownAtMs: 10, acceptedAtMs: null, repeats: 0 }, demoShown: false, practiceCompleted: false, practice: [] };
    e.timing = { startedAtMs: 0, finishedAtMs: 100, lastCheckpointAtMs: 100, measurementStartedAtMs: null, measurementFinishedAtMs: null };
    expect(envelopeSchema.safeParse(e).success).toBe(true);
  });
  it('accepts a durable partial presentation without resuming or inventing responses', () => {
    const e = envelope(); Object.assign(e, { state: 'interrupted', terminationReason: 'recovered_after_reload', phaseReached: 'test' });
    const trial = e.events[0]!;
    Object.assign(trial, { closureReason: 'interruption', valid: false, invalidReason: 'interrupted', responseOpenedAtMs: null, closedAtMs: trial.presentationStartMs! + 100 });
    e.events = [trial]; e.timing.finishedAtMs = e.timing.lastCheckpointAtMs = trial.closedAtMs; e.timing.measurementFinishedAtMs = null;
    e.incidents = [{ sequence: 1, type: 'recovered_after_reload', phase: 'test', clockId: null, atMs: null,
      recordedAtClient: '2026-11-13T12:00:00.000Z', durationMs: null, detail: null }];
    expect(envelopeSchema.safeParse(e).success).toBe(true);
    expect(calculate(envelopeSchema.parse(e), true).summary.included).toBe(0);
  });
  it('rejects invalidated practice being counted as valid measurement', () => {
    const e = envelope(); e.events[0]!.sequence = buildSequences().practice[1]!;
    expect(envelopeSchema.safeParse(e).success).toBe(false);
  });
  it('rejects time reversal and a fabricated early timeout', () => {
    const e = envelope(); e.events[0]!.closedAtMs = e.events[0]!.responseOpenedAtMs! + 7990;
    expect(envelopeSchema.safeParse(e).success).toBe(false);
    e.events[0]!.closedAtMs = -1;
    expect(envelopeSchema.safeParse(e).success).toBe(false);
  });
  it('requires a focus incident to invalidate the affected trial, not terminate the whole game', () => {
    const e = envelope(); e.incidents.push({ sequence: 1, type: 'loss_of_focus', phase: 'test', clockId: e.clock.id,
      atMs: e.events[0]!.startedAtMs + 100, recordedAtClient: null, durationMs: null, detail: null });
    expect(envelopeSchema.safeParse(e).success).toBe(false);
  });
  it('rejects skipping required practice and forging completion', () => {
    const e = envelope(); e.preparation.practice = []; e.preparation.practiceCompleted = false;
    expect(envelopeSchema.safeParse(e).success).toBe(false);
    const other = envelope(); other.events.pop();
    expect(envelopeSchema.safeParse(other).success).toBe(false);
  });
  it('bounds tap arrays before refinement', () => {
    const e = envelope(); e.events[0]!.earlyTaps = Array.from({ length: 1001 }, () => ({ drum: 0, atMs: 6000, pointerType: 'mouse' }));
    expect(envelopeSchema.safeParse(e).success).toBe(false);
  });
  it('rejects shortened presentation or a closing window shorter than the original', () => {
    const e = envelope(); e.events[0]!.responseOpenedAtMs = e.events[0]!.presentationStartMs! + 500;
    expect(envelopeSchema.safeParse(e).success).toBe(false);
    const other = envelope(), practice = other.preparation.practice[0]!.evidence;
    practice.closedAtMs = practice.responses.at(-1)!.atMs;
    expect(envelopeSchema.safeParse(other).success).toBe(false);
  });
  it('accepts the full successful path through lengths 2–7', () => {
    const e = envelope(); e.events = []; let start = 6000;
    for (let length = 2; length <= 7; length++) {
      for (let index = 0; index < 2; index++) {
        const trial = { ...drumTrial(buildSequences().byLength[length]![index]!, start, true), trial: e.events.length + 1,
          sequenceIndex: index, attemptAtLength: index + 1 };
        e.events.push(trial); start = trial.closedAtMs + 3200;
      }
    }
    e.terminationReason = 'max_length_reached';
    e.timing.finishedAtMs = e.timing.lastCheckpointAtMs = e.timing.measurementFinishedAtMs = start;
    expect(envelopeSchema.safeParse(e).success).toBe(true);
    expect(calculate(envelopeSchema.parse(e), true).summary).toMatchObject({ included: 12, correctTrials: 12 });
  });
  it('accepts exhausting three invalid trials without inventing valid results', () => {
    const e = envelope(); e.events = []; let start = 6000;
    for (let index = 0; index < 3; index++) {
      const trial = { ...drumTrial(buildSequences().byLength[2]![index]!, start), trial: index + 1, sequenceIndex: index,
        attemptAtLength: 1, isReplacement: index === 2, valid: false, invalidReason: 'focus_lost' as const };
      e.events.push(trial); start = trial.closedAtMs + 1500;
    }
    e.terminationReason = 'invalid_trials'; e.timing.finishedAtMs = e.timing.lastCheckpointAtMs = e.timing.measurementFinishedAtMs = start;
    expect(envelopeSchema.safeParse(e).success).toBe(true);
    expect(calculate(envelopeSchema.parse(e), true).summary.included).toBe(0);
  });
  it('does not accept a valid trial started while focus was already lost', () => {
    const e = envelope(); e.incidents = [{ sequence: 1, type: 'loss_of_focus', phase: 'test', clockId: e.clock.id,
      atMs: 5900, recordedAtClient: null, durationMs: null, detail: null }];
    expect(envelopeSchema.safeParse(e).success).toBe(false);
    e.incidents.push({ ...e.incidents[0]!, sequence: 2, type: 'focus_regained', atMs: 5990 });
    expect(envelopeSchema.safeParse(e).success).toBe(true);
  });
});
