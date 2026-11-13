import { hash } from '../src/modules/tareas/runtime/contract.js';
import { BUILD_ID, CONTRACT_VERSION, profile, envelopeSchema } from '../src/modules/tareas/runtime/tg02/contract.js';
import { buildSequence, type ArrangedItem } from '../src/modules/tareas/runtime/tg02/sequence.js';

export function envelope() {
  const sequence = buildSequence();
  const trial = (item: ArrangedItem, index: number, at: number, segment: number | null) => ({
    trial: index + 1, itemId: item.item.id, category: item.item.category, level: item.item.level, segment,
    words: item.words, targetIdx: item.targetIdx, selectedIdx: item.targetIdx,
    presentedAtMs: at, respondedAtMs: at + 500, closedAtMs: at + 500, rtMs: 500,
    result: 'correct' as const, valid: true, invalidReason: null, anticipatory: false,
    closureReason: 'response' as const, pointerType: 'mouse' as const, responseX: 400, responseY: 300,
  });
  const practice = sequence.practice.map((item, i) => trial(item, i, 2000 + i * 3400, null));
  const measurementStart = practice.at(-1)!.closedAtMs + 2900 + 4200;
  const events = sequence.seq.map((item, i) => trial(item, i, measurementStart + i * 1250, item.plannedSegment));
  const end = events.at(-1)!.closedAtMs;
  return envelopeSchema.parse({
    taskId: 'TG-02', sessionId: '10000000-0000-4000-8000-000000000002', publishedVersionId: '20000000-0000-4000-8000-000000000002',
    submissionId: '30000000-0000-4000-8000-000000000002', configVersion: 1, configurationHash: hash(profile()),
    gameBuildId: BUILD_ID, contractVersion: CONTRACT_VERSION, state: 'completed', terminationReason: 'completed', phaseReached: 'done',
    clock: { id: '40000000-0000-4000-8000-000000000002', timeOriginUnixMs: 1794528000000 },
    timing: { startedAtMs: 0, finishedAtMs: end, lastCheckpointAtMs: end, measurementStartedAtMs: measurementStart, measurementFinishedAtMs: end, pausedMs: 0 },
    device: { viewportWidth: 1920, viewportHeight: 1080, stageWidthCss: 1920, stageHeightCss: 1080, devicePixelRatio: 1, touchCapable: false, pointerTypes: ['mouse'] },
    preparation: { instruction: { shownAtMs: 10, acceptedAtMs: 20, repeats: 0 }, practiceCompleted: true,
      practice: [{ round: 1, items: practice, errors: 0 }] }, events, incidents: [], pauses: [], emptyResponses: [],
  });
}
