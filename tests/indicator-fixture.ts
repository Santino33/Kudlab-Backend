// Generador determinista de escenarios de indicadores (T-C01, capa a: flujo real).
// Versión del generador: 1. Datos exclusivamente sintéticos. Requiere una BD de tests aislada (assertTestDatabase).
// No edita tests/game-fixture.ts; lo reutiliza. Flujo: asignación → lanzamiento → inicio → entrega → processOne.
import { randomBytes, randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../src/db/client.js';
import { calculationRuns, gameSessions } from '../src/db/schema/game.js';
import { processOne } from '../src/modules/evolucion/processor.js';
import { calculate } from '../src/modules/evolucion/tg01.js';
import { gameDependencies, gameFixture, testGameApp } from './game-fixture.js';
import { buildEnvelope, COMPLETE_TRIALS, type SessionSpec } from './indicator-envelope.js';

export const INDICATOR_FIXTURE_VERSION = 1;
process.env.GAME_RUNTIME_ORIGIN = 'http://127.0.0.1:4178';
process.env.GAME_GRANT_KEYS = JSON.stringify({ test1: 'ab'.repeat(32) });
process.env.GAME_ACTIVE_KEY_ID = 'test1'; process.env.GAME_CURSOR_KEY = 'cd'.repeat(32);

export { COMPLETE_TRIALS } from './indicator-envelope.js';
export type { Result, TrialSpec, IncidentSpec, Processing, SessionSpec } from './indicator-envelope.js';

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

// ───────────────────────── Capa b: volumen de curso/año (T-C02) ─────────────────────────
// Inserciones directas en las tablas reales (MSG-integrador-016, admitido técnicamente). Los valores salen de `calculate()` sobre ensayos
// sintéticos deterministas; no se copian fórmulas. Limitaciones declaradas: (1) no hay ensayos crudos (raw_events) ni acuses, por lo que
// `recordedTrialCount` NO es representativo y este conjunto no acredita evidencia, ingesta, detalle de sesión ni gameplay; (2) la siembra
// usa `session_replication_role = replica` en una sola transacción para saltar los triggers de historial, solo en la BD de tests.
export type VolumeRecord = { generatorVersion: number; schema: string; students: number; assignments: number; sessions: number; groupId: string; periodFrom: string; periodTo: string; studentIds: string[] };
const dummyContext = { sessionId: randomUUID(), publishedVersionId: randomUUID(), configVersion: 1, configurationHash: 'a'.repeat(64), gameBuildId: 'tg01-viewport-rebuild-2' };
const VARIANTS: SessionSpec[] = [{}, { durationMs: 30000, state: 'interrupted', trials: COMPLETE_TRIALS.filter(t => t.at < 30000) }];

export async function seedCourseYear(world: World, options: { sessions: number; students?: number }): Promise<VolumeRecord> {
  const students = options.students ?? 40, needed = Math.ceil(options.sessions / 10), assignmentsCount = Math.ceil(needed / students);
  const groupId = world.f.aGroups[0]!.id, teacherId = world.f.a.account.id as string, versionId = world.f.versionId;
  const template = VARIANTS.flatMap((spec, variant) => calculate(buildEnvelope(dummyContext, spec), true).indicators.map(i => ({ variant, metric_code: i.metricCode, scope: i.scope,
    status: i.status, value: i.value, unit: i.unit, numerator: i.numerator, denominator: i.denominator, sample_size: i.sampleSize, reason: i.unavailabilityReason })));
  const from = '2026-02-02T13:00:00Z';
  const studentIds = await db.transaction(async tx => {
    await tx.execute(sql`set local session_replication_role = replica`);
    await tx.execute(sql`create temp table volume_students on commit drop as select gen_random_uuid() id, n from generate_series(1, ${students}::int) n`);
    await tx.execute(sql`insert into students (id, group_id, student_code, first_name, last_name, is_active)
      select id, ${groupId}::uuid, 'VOL-' || n, 'Participante', 'Volumen ' || n, true from volume_students`);
    await tx.execute(sql`create temp table volume_assignments on commit drop as select gen_random_uuid() id, n from generate_series(1, ${assignmentsCount}::int) n`);
    await tx.execute(sql`insert into task_assignments (id, task_id, published_version_id, group_id, created_by_account_id, starts_at, ends_at, max_attempts, status, creation_request_id, request_hash)
      select id, 'TG-01', ${versionId}::uuid, ${groupId}::uuid, ${teacherId}::uuid, ${from}::timestamptz, ${from}::timestamptz + interval '400 days', 10, 'OPEN', gen_random_uuid(), 'volume-' || n from volume_assignments`);
    await tx.execute(sql`create temp table volume_recipients on commit drop as
      select gen_random_uuid() id, a.id assignment_id, s.id student_id from volume_assignments a cross join volume_students s`);
    await tx.execute(sql`insert into task_assignment_recipients (id, assignment_id, student_id) select id, assignment_id, student_id from volume_recipients`);
    // Una fila por sesión; `k` ordena el tiempo para que cada inicio sea distinto y estable.
    await tx.execute(sql`create temp table volume_sessions on commit drop as
      select gen_random_uuid() id, r.id recipient_id, r.student_id, n attempt, row_number() over (order by r.id, n) k
      from volume_recipients r cross join generate_series(1, 10) n order by r.id, n limit ${options.sessions}::int`);
    await tx.execute(sql`insert into task_sessions (id, recipient_id, student_id, task_id, group_id_at_start, launch_mode, attempt_number, execution_status, processing_status,
        prepared_at, start_allowed_until, started_at_server, start_request_id, upload_allowed_until, closed_received_at, participation_authorization_ref)
      select id, recipient_id, student_id, 'TG-01', ${groupId}::uuid, 'SUPERVISED', attempt, 'COMPLETED', 'COMPLETED',
        ${from}::timestamptz + k * interval '40 minutes' - interval '10 minutes', ${from}::timestamptz + k * interval '40 minutes' + interval '1 hour', ${from}::timestamptz + k * interval '40 minutes',
        gen_random_uuid(), ${from}::timestamptz + k * interval '40 minutes' + interval '1 hour', ${from}::timestamptz + k * interval '40 minutes' + interval '3 minutes', 'SYNTHETIC-VOLUME'
      from volume_sessions`);
    await tx.execute(sql`insert into indicator_calculation_runs (id, session_id, rule_version_id, run_number, evidence_hash, status, created_at, started_at, finished_at, attempt_count, evidence_decisions, summary)
      select gen_random_uuid(), s.id, c.rule_version_id, 1, encode(sha256(s.id::text::bytea), 'hex'), 'SUCCEEDED', ${from}::timestamptz + s.k * interval '40 minutes' + interval '4 minutes',
        ${from}::timestamptz + s.k * interval '40 minutes' + interval '4 minutes', ${from}::timestamptz + s.k * interval '40 minutes' + interval '5 minutes', 1, '[]'::jsonb, '{}'::jsonb
      from volume_sessions s cross join task_version_configurations c where c.published_version_id = ${versionId}::uuid`);
    await tx.execute(sql`insert into calculated_indicators (id, run_id, metric_code, scope, availability_status, value, unit, numerator, denominator, sample_size, unavailability_reason)
      select gen_random_uuid(), r.id, t.metric_code, t.scope, t.status, t.value, t.unit, t.numerator, t.denominator, t.sample_size, t.reason
      from indicator_calculation_runs r join volume_sessions s on s.id = r.session_id
      join jsonb_to_recordset(${JSON.stringify(template)}::jsonb) as t(variant int, metric_code text, scope text, status text, value numeric, unit text, numerator int, denominator int, sample_size int, reason text)
        on t.variant = (s.k % 2)`);
    await tx.execute(sql`update task_sessions s set active_calculation_run_id = r.id from indicator_calculation_runs r where r.session_id = s.id and s.participation_authorization_ref = 'SYNTHETIC-VOLUME'`);
    const rows = await tx.execute(sql`select id from volume_students order by n`);
    return rows.rows.map(r => r.id as string);
  });
  return { generatorVersion: INDICATOR_FIXTURE_VERSION, schema: 'migraciones existentes (sin migración nueva)', students, assignments: assignmentsCount, sessions: options.sessions, groupId,
    periodFrom: from, periodTo: new Date(Date.parse(from) + options.sessions * 40 * 60000).toISOString(), studentIds };
}
