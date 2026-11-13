import { hash } from '../src/modules/tareas/runtime/contract.js';
import { BUILD_ID, profile, type Envelope, type Trial } from '../src/modules/tareas/runtime/tg07/contract.js';
import { buildSequences } from '../src/modules/tareas/runtime/tg07/sequence.js';

export function drumTrial(sequence: number[], start: number, correct = false): Trial {
  const opened = start + 900 + sequence.length * 900;
  return { trial: 1, length: sequence.length, sequence, sequenceIndex: 0, attemptAtLength: 1, isReplacement: false,
    startedAtMs: start, presentationStartMs: start + 900, responseOpenedAtMs: opened,
    closedAtMs: correct ? opened + sequence.length * 500 + 250 : opened + 8000,
    responses: correct ? sequence.map((drum, i) => ({ drum, atMs: opened + (i + 1) * 500, pointerType: 'mouse' })) : [],
    earlyTaps: [], valid: true, invalidReason: null, closureReason: correct ? 'response' : 'timeout' };
}
export function envelope(): Envelope {
  const sequences = buildSequences();
  const first = drumTrial(sequences.byLength[2]![0]!, 6000);
  const second = { ...drumTrial(sequences.byLength[2]![1]!, first.closedAtMs + 1500), trial: 2, sequenceIndex: 1, attemptAtLength: 2 };
  return { taskId: 'TG-07', sessionId: '00000000-0000-4000-8000-000000000007',
    submissionId: '00000000-0000-4000-8000-000000000017', publishedVersionId: '00000000-0000-4000-8000-000000000027',
    configurationHash: hash(profile()), configVersion: 1, gameBuildId: BUILD_ID, contractVersion: '2.0',
    state: 'completed', terminationReason: 'all_trials_incorrect_at_length', phaseReached: 'done',
    clock: { id: '00000000-0000-4000-8000-000000000037', timeOriginUnixMs: 1800000000000 },
    timing: { startedAtMs: 0, finishedAtMs: second.closedAtMs + 1500, lastCheckpointAtMs: second.closedAtMs + 1500,
      measurementStartedAtMs: 6000, measurementFinishedAtMs: second.closedAtMs + 1500 },
    device: { viewportWidth: 1920, viewportHeight: 1080, stageWidthCss: 1920, stageHeightCss: 1080, devicePixelRatio: 1, touchCapable: false, pointerTypes: ['mouse'] },
    audio: { source: 'files', missingFiles: [] },
    preparation: { instruction: { shownAtMs: 10, acceptedAtMs: 20, repeats: 0 }, demoShown: true, practiceCompleted: true,
      practice: [{ round: 1, evidence: drumTrial(sequences.practice[1]!, 100, true) }] },
    events: [first, second], incidents: [] };
}
