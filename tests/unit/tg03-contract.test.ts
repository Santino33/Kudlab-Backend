import { describe, expect, it } from 'vitest';
import { hash } from '../../src/modules/tareas/runtime/contract.js';
import { envelope, ids } from '../tg03-envelope.js';
import { configSchema, contextSchema, envelopeSchema, profile, trialSchema } from '../../src/modules/tareas/runtime/tg03/contract.js';

describe('TG-03 contract / CA-02,04,05,07,08,13', () => {
  it('accepts deterministic profile, authorized context and a full measurement longer than TG-01', () => {
    const config = profile();
    expect(configSchema.safeParse(config).success).toBe(true);
    const e = envelope();
    expect(e.timing.finishedAtMs).toBeGreaterThan(120000);
    expect(envelopeSchema.parse(e)).toEqual(e);
    expect(contextSchema.safeParse({ sessionId: ids.session, publishedVersionId: ids.version, taskId: 'TG-03', configVersion: 1,
      configurationHash: hash(config), gameBuildId: e.gameBuildId, contractVersion: '2.0', config, executionStatus: 'READY', attemptNumber: null,
      startAllowedUntil: '2026-11-13T12:15:00Z', uploadAllowedUntil: null, serverTime: '2026-11-13T12:00:00Z',
      capabilities: { canStart: true, canSubmit: false, canReadReceipt: true } }).success).toBe(true);
  });
  it('rejects changed bank content even after a client recomputes its hashes', () => {
    const config = structuredClone(profile());
    const modified = { ...config, bank: { ...config.bank, generatorSeed: 3032 } };
    expect(configSchema.safeParse({ ...modified, bankHash: hash(modified.bank) }).success).toBe(false);
    expect(configSchema.safeParse({ ...config, instructionMs: 100, sequenceHash: '0'.repeat(64) }).success).toBe(false);
  });
  it('accepts zero-measurement recovery without fabricating an item or measured time', () => {
    const e = envelope();
    e.state = 'interrupted'; e.terminationReason = 'recovered_after_reload'; e.events = [];
    e.timing = { startedAtMs: 0, finishedAtMs: 0, lastCheckpointAtMs: 0 };
    e.incidents = [{ sequence: 1, type: 'recovered_after_reload', clockId: null, atMs: null, endedAtMs: null,
      recordedAtClient: '2026-11-13T12:00:00Z', category: 'EXECUTION_INTERRUPTED' }];
    expect(envelopeSchema.safeParse(e).success).toBe(true);
  });
  it('accepts a measured prefix and incomplete last instruction, never continuation after it', () => {
    const e = envelope(); e.state = 'interrupted'; e.terminationReason = 'focus_lost'; e.events = e.events.slice(0, 2);
    const last = e.events[1]!;
    Object.assign(last, { instructionShownAtMs: [last.startedAtMs + 1000], optionsShownAtMs: null, selectedIdx: null,
      selectedAtMs: null, responseDevice: null, closureReason: 'interruption', closedAtMs: last.startedAtMs + 1500 });
    e.timing.finishedAtMs = e.timing.lastCheckpointAtMs = last.closedAtMs;
    e.incidents = [{ sequence: 1, type: 'focus_lost', clockId: e.clock.id, atMs: last.closedAtMs, endedAtMs: null,
      recordedAtClient: null, category: 'EXECUTION_INTERRUPTED' }];
    expect(envelopeSchema.safeParse(e).success).toBe(true);
    e.events.push(envelope().events[2]!);
    expect(envelopeSchema.safeParse(e).success).toBe(false);
  });
  it('retains completed measurement with a closing video failure, without moving its timing', () => {
    const e = envelope(); const timing = { ...e.timing };
    e.preparation.resourceIncidents.push({ phase: 'closing', type: 'transition_skipped', reason: 'timeout' });
    expect(envelopeSchema.parse(e).timing).toEqual(timing);
  });
  it.each(['taskId', 'gameBuildId', 'contractVersion', 'configurationHash'] as const)('rejects incompatible %s', key => {
    expect(envelopeSchema.safeParse({ ...envelope(), [key]: 'incompatible' }).success).toBe(false);
  });
  it('rejects wrong sequence, duplicate trial, client metrics, response rewrites and malformed clocks', () => {
    const e = envelope();
    expect(envelopeSchema.safeParse({ ...e, summary: { accuracy: 100 } }).success).toBe(false);
    const reversed = { ...e, events: [...e.events].reverse() };
    expect(envelopeSchema.safeParse(reversed).success).toBe(false);
    const first = e.events[0]!;
    expect(trialSchema.safeParse({ ...first, selectedIdx: 4 }).success).toBe(false);
    expect(trialSchema.safeParse({ ...first, selectedAtMs: first.optionsShownAtMs! - 1 }).success).toBe(false);
    expect(trialSchema.safeParse({ ...first, instructionShownAtMs: [0] }).success).toBe(false);
    expect(envelopeSchema.safeParse({ ...e, clock: { ...e.clock, timeOriginUnixMs: NaN } }).success).toBe(false);
  });
  it('accepts valid timeout, rejects timeout before its full response window', () => {
    const first = envelope().events[0]!;
    const omission = { ...first, selectedIdx: null, selectedAtMs: null, responseDevice: null, closureReason: 'timeout', closedAtMs: first.optionsShownAtMs! + 30000 };
    expect(trialSchema.safeParse(omission).success).toBe(true);
    expect(trialSchema.safeParse({ ...omission, closedAtMs: omission.closedAtMs - 1 }).success).toBe(false);
    expect(trialSchema.safeParse({ ...first, selectedAtMs: omission.closedAtMs, closedAtMs: omission.closedAtMs }).success).toBe(false);
  });
  it('keeps keyboard extras coordinate-free and refuses unknown, foreign and excessive extras', () => {
    const e = envelope();
    e.extraResponses = [{ sequence: 1, trial: 1, atMs: e.events[0]!.closedAtMs, region: 'locked', device: 'keyboard', x: null, y: null }];
    expect(envelopeSchema.safeParse(e).success).toBe(true);
    expect(envelopeSchema.safeParse({ ...e, extraResponses: [{ ...e.extraResponses[0], x: 1 }] }).success).toBe(false);
    expect(envelopeSchema.safeParse({ ...e, extraResponses: Array(1001).fill(e.extraResponses[0]) }).success).toBe(false);
  });
  it('refuses inconsistent practice and retries after a successful first round', () => {
    const e = envelope();
    e.preparation.practice.push({ ...e.preparation.practice[0]!, round: 2 });
    expect(envelopeSchema.safeParse(e).success).toBe(false);
    const b = envelope(); b.preparation.practice[0]!.items[0].result = 'incorrect';
    expect(envelopeSchema.safeParse(b).success).toBe(false);
  });
});
