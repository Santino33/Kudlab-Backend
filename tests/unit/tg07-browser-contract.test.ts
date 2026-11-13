import { describe, expect, it } from 'vitest';
import { contextSchema, envelopeSchema, profile } from '../../src/modules/tareas/runtime/tg07/contract.js';
import { contextSchema as browserContext, envelopeSchema as browserEnvelope } from '../../contract/runtime-1.4.0/kud-dice-validation.js';
import { envelope } from '../tg07-envelope.js';

describe('TG-07 browser contract parity', () => {
  it('accepts the same fixed context and rejects altered config/hash/capabilities', () => {
    const e = envelope();
    const context = { sessionId: e.sessionId, taskId: e.taskId, publishedVersionId: e.publishedVersionId,
      configVersion: e.configVersion, configurationHash: e.configurationHash, gameBuildId: e.gameBuildId,
      contractVersion: e.contractVersion, config: profile(), executionStatus: 'READY', attemptNumber: null,
      startAllowedUntil: '2026-11-14T00:00:00.000Z', uploadAllowedUntil: null, serverTime: '2026-11-13T00:00:00.000Z',
      capabilities: { canStart: true, canSubmit: false, canReadReceipt: false } };
    expect(browserContext.parse(context)).toEqual(contextSchema.parse(context));
    for (const invalid of [{ ...context, configurationHash: '0'.repeat(64) },
      { ...context, config: { ...context.config, seed: 1 } },
      { ...context, config: { ...context.config, sequenceHash: '0'.repeat(64) } },
      { ...context, capabilities: { ...context.capabilities, canSubmit: true } }]) {
      expect(browserContext.safeParse(invalid).success).toBe(false);
      expect(contextSchema.safeParse(invalid).success).toBe(false);
    }
  });
  it('preserves timing, sequence, completion and hash refinements', () => {
    const good = envelope();
    expect(browserEnvelope.parse(good)).toEqual(envelopeSchema.parse(good));
    const mutations = [
      (e: ReturnType<typeof envelope>) => { e.configurationHash = '0'.repeat(64); },
      (e: ReturnType<typeof envelope>) => { e.events[0]!.sequence[0] = (e.events[0]!.sequence[0]! + 1) % 4; },
      (e: ReturnType<typeof envelope>) => { e.events[0]!.responseOpenedAtMs = 1; },
      (e: ReturnType<typeof envelope>) => { e.terminationReason = 'max_length_reached'; },
      (e: ReturnType<typeof envelope>) => { e.preparation.practiceCompleted = false; },
    ];
    for (const mutate of mutations) {
      const invalid = structuredClone(good); mutate(invalid);
      expect(browserEnvelope.safeParse(invalid).success).toBe(false);
      expect(envelopeSchema.safeParse(invalid).success).toBe(false);
    }
  });
});
