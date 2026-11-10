// Construcción pura de envoltorios de resultados sintéticos de TG-01 (sin base de datos ni efectos); compartida por el generador de pruebas
// y la siembra manual. Datos exclusivamente sintéticos.
import { randomUUID } from 'node:crypto';
import { envelopeSchema, type Envelope } from '../src/modules/tareas/runtime/contract.js';

export type Result = 'hit' | 'miss' | 'false_alarm' | 'correct_rejection' | 'not_evaluated';
// `at`: milisegundos desde el inicio hasta la presentación (define el segmento: <40 000, <80 000, resto); `rt`: tiempo de respuesta en hits/falsas alarmas.
export type TrialSpec = { result: Result; at: number; rt?: number };
export type IncidentSpec = { type: 'focus_lost' | 'visibility_lost'; atMs: number; endedAtMs: number };
export type Processing = 'real' | 'none' | 'unapproved' | 'failed';
export type SessionSpec = { trials?: TrialSpec[]; state?: 'completed' | 'interrupted'; durationMs?: number; incidents?: IncidentSpec[]; processing?: Processing; startedAt?: Date };

export const COMPLETE_TRIALS: TrialSpec[] = [
  { result: 'hit', at: 1000, rt: 300 }, { result: 'hit', at: 3000, rt: 500 }, { result: 'miss', at: 5000 }, { result: 'false_alarm', at: 7000, rt: 400 },
  { result: 'correct_rejection', at: 9000 }, { result: 'hit', at: 45000, rt: 700 }, { result: 'miss', at: 50000 }, { result: 'hit', at: 85000, rt: 600 },
];

export function buildEnvelope(context: { sessionId: string; publishedVersionId: string; configVersion: number; configurationHash: string; gameBuildId: string }, spec: SessionSpec): Envelope {
  const clock = { id: randomUUID(), timeOriginUnixMs: Date.now() };
  const trials = spec.trials ?? COMPLETE_TRIALS, state = spec.state ?? 'completed', duration = spec.durationMs ?? 120000;
  const start = 0.25;
  const events = trials.map((t, n) => {
    const presented = start + t.at, responded = t.result === 'hit' || t.result === 'false_alarm', end = responded ? presented + (t.rt ?? 400) : presented + 800;
    const elapsed = presented - start;
    return { trial: n + 1, stimulus: t.result === 'false_alarm' || t.result === 'correct_rejection' ? 'moon' : 'star', spawnedAtMs: presented - 50, presentedAtMs: presented,
      respondedAtMs: responded ? end : null, closedAtMs: end, result: t.result, segment: elapsed < 40000 ? 1 : elapsed < 80000 ? 2 : 3,
      closureReason: responded ? 'response' : t.result === 'not_evaluated' ? 'interruption' : 'window_elapsed', responseWindowCompleted: !responded && t.result !== 'not_evaluated',
      responseDevice: responded ? 'touch' : null, geometry: { lane: 2, x: 180, size: 90 } };
  });
  const incidents = (spec.incidents ?? []).map((i, n) => ({ sequence: n + 1, type: i.type, clockId: clock.id, atMs: start + i.atMs, endedAtMs: start + i.endedAtMs,
    recordedAtClient: null, category: 'MEASUREMENT_AFFECTED' as const }));
  return envelopeSchema.parse({ contractVersion: '1.1', sessionId: context.sessionId, submissionId: randomUUID(), taskId: 'TG-01', publishedVersionId: context.publishedVersionId,
    configVersion: context.configVersion, configurationHash: context.configurationHash, gameBuildId: context.gameBuildId, state,
    terminationReason: state === 'completed' ? 'time_limit' : 'user_exit', clock,
    timing: { startedAtMs: start, finishedAtMs: start + duration, lastCheckpointAtMs: start + duration },
    device: { viewportWidth: 390, viewportHeight: 844, stageWidthCss: 390, stageHeightCss: 772, stageScale: .8125, touchCapable: true }, events, incidents });
}
