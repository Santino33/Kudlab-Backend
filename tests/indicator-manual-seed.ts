// Siembra sintética para el recorrido de aceptación manual de indicadores (T-G02). Versión 1.
// Ejecución: copiar `tests/indicator-envelope.ts` y este archivo al contenedor del backend de la pila de la feature y correr
// `node --import tsx tests/indicator-manual-seed.ts` con el DATABASE_URL de esa pila. NO usa la BD de tests ni toca `reset()`.
// Límites declarados: (1) inserciones directas en tablas reales con `session_replication_role = replica` en una transacción (sin consentimiento:
// las lecturas de indicadores no lo consultan, D-5); (2) los valores salen de `calculate()` real sobre ensayos sintéticos deterministas;
// (3) no hay ensayos crudos ni acuses, así que no acredita ingesta ni detalle de sesión; (4) idempotente: omite al estudiante que ya tiene sesiones.
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db, pool } from '../src/db/client.js';
import { calculate } from '../src/modules/evolucion/tg01.js';
import { buildEnvelope, type SessionSpec, type TrialSpec } from './indicator-envelope.js';

export const MANUAL_SEED_VERSION = 1;
type Plan = { code: string; sessions: number; from: string; to: string; creatorName?: string };
// E1 (SINT-A-001): >100 sesiones en 9 meses (más que una página de 100). E2 (SINT-B-001): otro docente. SINT-C-001: estudiante adicional del docente A; E6 (SINT-D-001): curso D ya reasignado al docente B.
// E3 (SINT-A-003): sin sesiones (no figura aquí). Estados de ejecución, aprobación y fallo se alternan de forma determinista.
const PLANS: Plan[] = [
  { code: 'SINT-A-001', sessions: 130, from: '2026-02-02T13:00:00Z', to: '2026-11-06T13:00:00Z' },
  { code: 'SINT-B-001', sessions: 6, from: '2026-03-10T13:00:00Z', to: '2026-09-15T13:00:00Z' },
  { code: 'SINT-C-001', sessions: 5, from: '2026-04-06T13:00:00Z', to: '2026-10-05T13:00:00Z' },
  // E6 (cambio de responsable): el curso D pasó de A a B antes de sembrar (la API rechaza el cambio con asignaciones); las asignaciones las creó el docente A.
  { code: 'SINT-D-001', sessions: 5, from: '2026-04-20T13:00:00Z', to: '2026-10-19T13:00:00Z', creatorName: 'Docente A sintético' },
];

function trialsFor(i: number, n: number): TrialSpec[] {
  const progress = i / Math.max(1, n - 1), ats = [1000, 9000, 17000, 30000, 45000, 55000, 70000, 85000, 95000, 108000];
  return ats.map((at, t) => {
    const hashed = (i * 37 + t * 17) % 100;
    if (t % 5 === 4) return { result: hashed % 2 ? 'false_alarm' : 'correct_rejection', at, ...(hashed % 2 ? { rt: 420 } : {}) } as TrialSpec;
    return hashed < 45 + progress * 45 ? { result: 'hit', at, rt: Math.round(560 - progress * 160 + ((i * 7 + t * 13) % 70)) } : { result: 'miss', at };
  });
}
function specFor(i: number, n: number): { spec: SessionSpec; kind: 'ok' | 'unapproved' | 'failed' | 'pending' } {
  if (i === n - 1 && n > 20) return { spec: {}, kind: 'pending' };
  if (n > 20 && i % 29 === 11) return { spec: {}, kind: 'failed' };
  if (n > 20 && i % 23 === 7) return { spec: { trials: trialsFor(i, n) }, kind: 'unapproved' };
  if (i % 17 === 5) return { spec: { durationMs: 30000, state: 'interrupted', trials: trialsFor(i, n).filter((t) => t.at < 30000) }, kind: 'ok' };
  return { spec: { trials: trialsFor(i, n), ...(i % 11 === 3 ? { incidents: [{ type: 'focus_lost' as const, atMs: 20000, endedAtMs: 21500 }] } : {}) }, kind: 'ok' };
}

const dummy = { sessionId: randomUUID(), publishedVersionId: randomUUID(), configVersion: 1, configurationHash: 'a'.repeat(64), gameBuildId: 'tg01-viewport-rebuild-2' };
const iso = (d: Date) => d.toISOString();

export async function seedManual() {
  const cfg = (await db.execute(sql`select published_version_id, rule_version_id from task_version_configurations limit 1`)).rows[0] as { published_version_id: string; rule_version_id: string } | undefined;
  if (!cfg) throw new Error('TG-01 no está publicado (npm run game:publish).');
  const report: Record<string, { sessions: number; skipped?: boolean }> = {};
  for (const plan of PLANS) {
    const stu = (await db.execute(sql`select s.id, s.group_id, g.teacher_id from students s join groups g on g.id = s.group_id where s.student_code = ${plan.code}`)).rows[0] as
      { id: string; group_id: string; teacher_id: string } | undefined;
    if (!stu) throw new Error(`Falta el estudiante ${plan.code}`);
    const creator = plan.creatorName ? ((await db.execute(sql`select id from user_accounts where full_name = ${plan.creatorName}`)).rows[0] as { id: string } | undefined)?.id ?? stu.teacher_id : stu.teacher_id;
    const has = (await db.execute(sql`select count(*)::int c from task_sessions where student_id = ${stu.id}::uuid`)).rows[0] as { c: number };
    if (has.c > 0) { report[plan.code] = { sessions: has.c, skipped: true }; continue; }
    const t0 = Date.parse(plan.from), step = (Date.parse(plan.to) - t0) / Math.max(1, plan.sessions - 1);
    const rows = Array.from({ length: plan.sessions }, (_, i) => {
      const { spec, kind } = specFor(i, plan.sessions), at = new Date(t0 + i * step);
      const result = kind === 'ok' || kind === 'unapproved' ? calculate(buildEnvelope(dummy, spec), kind === 'ok').indicators : [];
      return { id: randomUUID(), runId: randomUUID(), i, kind, at, assignment: Math.floor(i / 10), attempt: (i % 10) + 1, interrupted: spec.state === 'interrupted',
        indicators: result.map((x) => ({ metric_code: x.metricCode, scope: x.scope, status: x.status, value: x.value, unit: x.unit, numerator: x.numerator,
          denominator: x.denominator, sample_size: x.sampleSize, reason: x.unavailabilityReason })) };
    });
    const assignmentIds = Array.from({ length: Math.ceil(plan.sessions / 10) }, () => ({ id: randomUUID(), recipient: randomUUID() }));
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local session_replication_role = replica`);
      for (const a of assignmentIds) {
        await tx.execute(sql`insert into task_assignments (id, task_id, published_version_id, group_id, created_by_account_id, starts_at, ends_at, max_attempts, status, creation_request_id, request_hash)
          values (${a.id}::uuid, 'TG-01', ${cfg.published_version_id}::uuid, ${stu.group_id}::uuid, ${creator}::uuid, ${plan.from}::timestamptz, ${plan.from}::timestamptz + interval '400 days', 10, 'OPEN', gen_random_uuid(), ${'manual-seed-' + a.id})`);
        await tx.execute(sql`insert into task_assignment_recipients (id, assignment_id, student_id) values (${a.recipient}::uuid, ${a.id}::uuid, ${stu.id}::uuid)`);
      }
      for (const r of rows) {
        const recipient = assignmentIds[r.assignment]!.recipient, start = iso(r.at), processing = r.kind === 'pending' ? 'PENDING' : r.kind === 'failed' ? 'FAILED' : 'COMPLETED';
        await tx.execute(sql`insert into task_sessions (id, recipient_id, student_id, task_id, group_id_at_start, launch_mode, attempt_number, execution_status, processing_status,
            prepared_at, start_allowed_until, started_at_server, start_request_id, upload_allowed_until, closed_received_at, participation_authorization_ref)
          values (${r.id}::uuid, ${recipient}::uuid, ${stu.id}::uuid, 'TG-01', ${stu.group_id}::uuid, 'SUPERVISED', ${r.attempt}, ${r.interrupted ? 'INTERRUPTED' : 'COMPLETED'}, ${processing},
            ${start}::timestamptz - interval '10 minutes', ${start}::timestamptz + interval '1 hour', ${start}::timestamptz, gen_random_uuid(), ${start}::timestamptz + interval '1 hour',
            ${start}::timestamptz + interval '3 minutes', 'SYNTHETIC-MANUAL-SEED')`);
        const status = r.kind === 'pending' ? 'PENDING' : r.kind === 'failed' ? 'FAILED' : 'SUCCEEDED';
        await tx.execute(sql`insert into indicator_calculation_runs (id, session_id, rule_version_id, run_number, evidence_hash, status, created_at, started_at, finished_at, attempt_count, failure_code, evidence_decisions, summary)
          values (${r.runId}::uuid, ${r.id}::uuid, ${cfg.rule_version_id}::uuid, 1, encode(sha256(${r.id}::bytea), 'hex'), ${status}, ${start}::timestamptz + interval '4 minutes',
            ${status === 'PENDING' ? null : sql`${start}::timestamptz + interval '4 minutes'`}, ${status === 'PENDING' ? null : sql`${start}::timestamptz + interval '5 minutes'`},
            ${status === 'PENDING' ? 0 : 1}, ${status === 'FAILED' ? 'CALCULATION_FAILED' : null}, '[]'::jsonb, '{}'::jsonb)`);
        if (r.indicators.length) {
          await tx.execute(sql`insert into calculated_indicators (id, run_id, metric_code, scope, availability_status, value, unit, numerator, denominator, sample_size, unavailability_reason)
            select gen_random_uuid(), ${r.runId}::uuid, t.metric_code, t.scope, t.status, t.value, t.unit, t.numerator, t.denominator, t.sample_size, t.reason
            from jsonb_to_recordset(${JSON.stringify(r.indicators)}::jsonb) as t(metric_code text, scope text, status text, value numeric, unit text, numerator int, denominator int, sample_size int, reason text)`);
          await tx.execute(sql`update task_sessions set active_calculation_run_id = ${r.runId}::uuid where id = ${r.id}::uuid`);
        }
      }
    });
    report[plan.code] = { sessions: rows.length };
  }
  return { version: MANUAL_SEED_VERSION, report };
}

if (process.argv[1]?.endsWith('indicator-manual-seed.ts')) {
  try { console.log(JSON.stringify(await seedManual())); } finally { await pool.end(); }
}
