import { hash } from '../src/modules/tareas/runtime/contract.js';
import { BANK, buildSequence, type Item } from '../src/modules/tareas/runtime/tg03/bank.js';
import { BUILD_ID, CONTRACT_VERSION, profile, type Envelope, type Trial } from '../src/modules/tareas/runtime/tg03/contract.js';

export const ids = { session: '10000000-0000-4000-8000-000000000001', version: '20000000-0000-4000-8000-000000000001',
  submission: '30000000-0000-4000-8000-000000000001', clock: '40000000-0000-4000-8000-000000000001' };
export function trial(item: Item, index: number, startedAtMs = index * 50000, rt = 500): Trial {
  const instructions = Array.from({ length: item.load + 1 }, (_, index) => startedAtMs + 1000 + index * 3000);
  const options = instructions.at(-1)! + 3000;
  return { trial: index + 1, itemId: item.id, load: item.load, plannedBlock: Math.floor(index / 4) + 1,
    start: item.start, ops: item.ops.map(op => ({ ...op })), intermediates: [...item.intermediates], optionValues: [...item.options],
    startedAtMs, instructionShownAtMs: instructions, optionsShownAtMs: options,
    selectedIdx: item.correctIdx, selectedAtMs: options + rt, closedAtMs: options + rt, responseDevice: 'touch', closureReason: 'response' };
}
export function envelope(): Envelope {
  let at = 0;
  const events = buildSequence().map(({ item }, index) => { const event = trial(item, index, at); at = event.closedAtMs + 300; return event; });
  return { sessionId: ids.session, publishedVersionId: ids.version, submissionId: ids.submission, configVersion: 1,
    taskId: 'TG-03', configurationHash: hash(profile()), contractVersion: CONTRACT_VERSION, gameBuildId: BUILD_ID,
    state: 'completed', terminationReason: 'items_completed', clock: { id: ids.clock, timeOriginUnixMs: 1794528000000 },
    timing: { startedAtMs: 0, finishedAtMs: at, lastCheckpointAtMs: at },
    device: { viewportWidth: 390, viewportHeight: 844, stageWidthCss: 390, stageHeightCss: 772, touchCapable: true, layoutPreset: 'portrait' },
    preparation: { instructionRepeats: 0, practice: [{ round: 1, items: BANK.practice.map(item => ({ itemId: item.id, selectedIdx: item.correctIdx, result: 'correct', rtMs: 1000 })) as Envelope['preparation']['practice'][number]['items'] }], resourceIncidents: [] },
    events, incidents: [], extraResponses: [] };
}
