import { describe, expect, it } from 'vitest';
import { envelope } from '../tg02-envelope.js';
import { envelopeSchema, contextSchema, profile, BUILD_ID, CONTRACT_VERSION } from '../../src/modules/tareas/runtime/tg02/contract.js';
import { hash } from '../../src/modules/tareas/runtime/contract.js';
import { calculate } from '../../src/modules/evolucion/tg02.js';

describe('TG02 contract — CA-03/05/06/07/08/09/10', () => {
  it('accepts full evidence, derives 49 indicators and accepts interruption before practice', () => {
    const e = envelope();
    expect(calculate(e, true).summary.overall).toMatchObject({ nValid: 18, precisionPct: 100, rtMeanMs: 500 });
    expect(envelopeSchema.safeParse({ ...e, state: 'interrupted', terminationReason: 'user_exit', phaseReached: 'intro',
      timing: { startedAtMs: 0, finishedAtMs: 100, lastCheckpointAtMs: 100, measurementStartedAtMs: null, measurementFinishedAtMs: null, pausedMs: 0 },
      preparation: { instruction: { shownAtMs: 10, acceptedAtMs: null, repeats: 0 }, practice: [], practiceCompleted: false }, events: [] }).success).toBe(true);
  });
  it('validates a fixed context and refuses changed hashes, seed and capabilities', () => {
    const e = envelope();
    const c = { taskId: e.taskId, sessionId: e.sessionId, publishedVersionId: e.publishedVersionId, configVersion: 1,
      configurationHash: hash(profile()), config: profile(), gameBuildId: BUILD_ID, contractVersion: CONTRACT_VERSION,
      executionStatus: 'READY', attemptNumber: null, startAllowedUntil: '2026-11-14T00:00:00Z', uploadAllowedUntil: null,
      serverTime: '2026-11-13T00:00:00Z', capabilities: { canStart: true, canSubmit: false, canReadReceipt: false } };
    expect(contextSchema.safeParse(c).success).toBe(true);
    for (const invalid of [{ ...c, config: { ...c.config, seed: 1 } }, { ...c, configurationHash: '0'.repeat(64) },
      { ...c, capabilities: { ...c.capabilities, canSubmit: true } }]) expect(contextSchema.safeParse(invalid).success).toBe(false);
  });
  const mutations: [string, (e: ReturnType<typeof envelope>) => void][] = [
    ['bank word', e => { e.events[0]!.words[0] = 'altered'; }],
    ['target position', e => { e.events[0]!.targetIdx = (e.events[0]!.targetIdx + 1) % 4; }],
    ['level', e => { e.events[0]!.level = e.events[0]!.level % 3 + 1; }],
    ['sequence', e => { e.events.reverse(); }],
    ['false correctness', e => { e.events[0]!.result = 'incorrect'; }],
    ['false anticipatory', e => { e.events[0]!.anticipatory = true; }],
    ['reaction time', e => { e.events[0]!.rtMs = 1000; }],
    ['missing event', e => { e.events.pop(); }],
    ['missing practice', e => { e.preparation.practice = []; }],
    ['practice success', e => { e.preparation.practiceCompleted = false; }],
    ['unknown fields', e => { Object.assign(e, { score: 100 }); }],
    ['invented pause', e => { e.timing.pausedMs = 1000; }],
    ['wrong profile', e => { e.configurationHash = '0'.repeat(64); }],
    ['unexplained invalidity', e => { e.events[0]!.valid = false; e.events[0]!.invalidReason = 'tab_hidden'; }],
    ['practice errors', e => { e.preparation.practice[0]!.errors = 1; }],
    ['unsealed measurement', e => { e.timing.measurementFinishedAtMs = null; }],
    ['measurement after final answer', e => { e.timing.measurementFinishedAtMs!++; e.timing.finishedAtMs++; e.timing.lastCheckpointAtMs++; }],
    ['complete run declared interrupted', e => { e.state = 'interrupted'; e.terminationReason = 'user_exit'; e.phaseReached = 'test'; }],
    ['technical invalidity on answered trial', e => { e.events[0]!.valid = false; e.events[0]!.invalidReason = 'storage_failure'; }],
  ];
  for (const [name, mutate] of mutations) it(`rejects ${name}`, () => {
    const e = envelope(); mutate(e); expect(envelopeSchema.safeParse(e).success).toBe(false);
  });
  it('requires real active time for an omission and excludes a blur-invalidated answered item', () => {
    const e = envelope(), t = e.events[0]!;
    e.state = 'interrupted'; e.terminationReason = 'user_exit'; e.phaseReached = 'test'; e.events = [t];
    Object.assign(t, { result: 'omission', closureReason: 'timeout', selectedIdx: null, respondedAtMs: null, rtMs: null,
      pointerType: null, responseX: null, responseY: null, closedAtMs: t.presentedAtMs + 20000 });
    Object.assign(e.timing, { finishedAtMs: t.closedAtMs, lastCheckpointAtMs: t.closedAtMs, measurementFinishedAtMs: t.closedAtMs });
    expect(envelopeSchema.safeParse(e).success).toBe(true);
    t.closedAtMs--; expect(envelopeSchema.safeParse(e).success).toBe(false);
    const blurred = envelope(), first = blurred.events[0]!;
    first.valid = false; first.invalidReason = 'focus_lost';
    blurred.incidents = [
      { sequence: 1, type: 'loss_of_focus', phase: 'test', clockId: blurred.clock.id, atMs: first.presentedAtMs + 100, recordedAtClient: null, durationMs: null, detail: null },
      { sequence: 2, type: 'focus_regained', phase: 'test', clockId: blurred.clock.id, atMs: first.closedAtMs + 100, recordedAtClient: null, durationMs: 500, detail: null },
    ];
    expect(envelopeSchema.safeParse(blurred).success).toBe(true);
    expect(calculate(blurred, true).summary.overall.nValid).toBe(17);
    first.valid = true; first.invalidReason = null;
    expect(envelopeSchema.safeParse(blurred).success).toBe(false);
  });
});
