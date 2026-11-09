// Generador determinista de escenarios de indicadores (T-C01, capa a: flujo real).
// Versión del generador: 1. Datos exclusivamente sintéticos. Requiere una BD de tests aislada (assertTestDatabase).
// No edita tests/game-fixture.ts; lo reutiliza. Flujo: asignación → lanzamiento → inicio → entrega → processOne.
import { randomBytes, randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { calculationRuns, gameSessions } from '../src/db/schema/game.js';
import { envelopeSchema, type Envelope } from '../src/modules/tareas/runtime/contract.js';
import { processOne } from '../src/modules/evolucion/processor.js';
import { gameDependencies, gameFixture, testGameApp } from './game-fixture.js';

export const INDICATOR_FIXTURE_VERSION = 1;
process.env.GAME_RUNTIME_ORIGIN = 'http://127.0.0.1:4178';
process.env.GAME_GRANT_KEYS = JSON.stringify({ test1: 'ab'.repeat(32) });
process.env.GAME_ACTIVE_KEY_ID = 'test1'; process.env.GAME_CURSOR_KEY = 'cd'.repeat(32);

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

export type World = Awaited<ReturnType<typeof indicatorWorld>>;
export async function indicatorWorld() {
  const f = await gameFixture();
  const app = testGameApp();
  const origin = process.env.SPA_ORIGIN ?? 'http://localhost:5173';
  async function request(path: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
    return app.request('/api/v1' + path, { method, headers: { origin: path.startsWith('/game-runtime') ? process.env.GAME_RUNTIME_ORIGIN! : origin,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  const assignments = new Map<string, { id: string; recipientId: string }>();
  async function assignmentFor(studentId: string, groupId: string, teacher: Record<string, string>) {
    const known = assignments.get(studentId);
    if (known) return known;
    const created = await request('/task-assignments', 'POST', { requestId: randomUUID(), taskId: 'TG-01', publishedVersionId: f.versionId, groupId, studentIds: [studentId],
      startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 365 * 86400000).toISOString(), maxAttempts: 10 }, teacher);
    if (created.status !== 201) throw new Error(`ASSIGNMENT_${created.status} ${await created.text()}`);
    const body = await created.json();
    const value = { id: body.id as string, recipientId: body.recipients[0].id as string };
    assignments.set(studentId, value); return value;
  }
  return { f, app, request, assignmentFor };
}

function buildEnvelope(context: { sessionId: string; publishedVersionId: string; configVersion: number; configurationHash: string; gameBuildId: string }, spec: SessionSpec): Envelope {
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

// Crea una sesión completa por el flujo real y la procesa según `processing`. Devuelve ids lógicos.
export async function runSession(world: World, spec: SessionSpec = {}, student = world.f.student, teacher = world.f.a.teacher) {
  const { request, assignmentFor, f } = world, a = await assignmentFor(student.id, student.groupId, teacher);
  const launch = await request(`/task-assignment-recipients/${a.recipientId}/launch-grants`, 'POST', { requestId: randomUUID() }, teacher);
  if (launch.status !== 201) throw new Error(`LAUNCH_${launch.status} ${await launch.text()}`);
  const grant = await launch.json(), secret = randomBytes(32).toString('base64url');
  const claimed = await request('/game-runtime/launches/claim', 'POST', { claimId: randomUUID(), runtimeSecret: secret }, { authorization: `Bearer ${grant.launchGrant}` });
  if (claimed.status !== 200) throw new Error(`CLAIM_${claimed.status} ${await claimed.text()}`);
  const context = await claimed.json(), runtime = { authorization: `Bearer ${secret}` };
  const started = await request(`/game-runtime/sessions/${context.sessionId}/start`, 'POST', { startId: randomUUID() }, runtime);
  if (started.status !== 200) throw new Error(`START_${started.status} ${await started.text()}`);
  const e = buildEnvelope(context, spec);
  const sent = await request(`/game-runtime/sessions/${context.sessionId}/results`, 'POST', e, runtime);
  if (![200, 201].includes(sent.status)) throw new Error(`RESULTS_${sent.status} ${await sent.text()}`);
  // Límite declarado: la BD protege `started_at_server` tras confirmar el intento; para controlar fechas de la historia se ajusta
  // en una transacción con triggers desactivados, solo en la BD de tests (assertTestDatabase lo garantiza al crear el mundo).
  if (spec.startedAt) await db.transaction(async tx => {
    await tx.execute(sql`set local session_replication_role = replica`);
    await tx.update(gameSessions).set({ startedAtServer: spec.startedAt! }).where(eq(gameSessions.id, context.sessionId));
  });
  const processing = spec.processing ?? 'real';
  if (processing === 'real') await processOne(gameDependencies);
  // Sin dependencias de prueba la regla propuesta no está aprobada: METHOD_NOT_APPROVED por el cálculo real.
  else if (processing === 'unapproved') await processOne({});
  // Límite declarado: FAILED se fuerza en BD (agotar los reintentos reales requiere esperas de 5–60 s).
  else if (processing === 'failed') {
    await db.update(calculationRuns).set({ status: 'FAILED', failureCode: 'CALCULATION_FAILED', finishedAt: new Date() }).where(eq(calculationRuns.sessionId, context.sessionId));
    await db.update(gameSessions).set({ processingStatus: 'FAILED' }).where(eq(gameSessions.id, context.sessionId));
  }
  return { sessionId: context.sessionId as string, studentId: student.id, assignmentId: a.id, versionId: f.versionId };
}

// Límite del generador: `processOne` toma siempre la ejecución PENDING más antigua. Una sesión creada con `processing: 'none'`
// la consume cualquier `processOne` posterior; para conservarla pendiente créela la última.
// Avanza una sesión con cálculo pendiente con el procesador real (auxiliar para el ensayo de instantánea del resumen).
export const advancePending = () => processOne(gameDependencies);
