import { and, desc, eq, gte, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';
import { assignments, calculatedIndicators, calculationRuns, gameConfigurations, gameSessions, indicatorRules, rawEvents, recipients, sessionIncidents } from '../../../db/schema/game.js';
import { groups } from '../../../db/schema/academic.js';
import { taskPublishedVersions } from '../../../db/schema/tasks.js';
import type { AcademicTransaction } from '../../academico/shared/academic-auth.js';
import { INDICATOR_METRIC_CODES, INDICATOR_SCOPES, type IndicatorMetricCode, type IndicatorScope } from './definitions.js';
import type { IndicatorHistorySession, IndicatorValueDto } from './dto.js';
import { approvalAtCalculation, normalizeExecutionStatus } from './run-state.js';
import { mentalistaEvidence, kudDiceEvidence } from '../../../db/schema/game.js';
import { configSchema as mentalistaConfig } from '../../tareas/runtime/tg03/contract.js';
import { taskIdSchema } from '../../tareas/runtime/profiles.js';
import { MENTALISTA_METRICS, MENTALISTA_SCOPES } from './mentalista-definitions.js';
import { KUD_DICE_METRICS, KUD_DICE_SCOPES } from './kud-dice-definitions.js';

export type { IndicatorMetricCode, IndicatorScope } from './definitions.js';
export type SessionResultsScope = { kind: 'student-history' } | { kind: 'course'; groupId: string };
// `startedFrom` inclusivo y `startedBefore` exclusivo: instantes, nunca fechas de calendario (ver dates.ts).
export type SessionResultsFilter = { taskId?: 'TG-01' | 'TG-03' | 'TG-07'; startedFrom?: Date; startedBefore?: Date; metricCodes?: readonly IndicatorValueDto['metricCode'][]; scopes?: readonly IndicatorValueDto['scope'][] };
export type SessionResultsInput = { studentIds: readonly string[]; scope: SessionResultsScope; filter?: SessionResultsFilter;
  // Opcional (ampliación compatible de COORD-02 r2): sin él, `detailAccess` es siempre UNAVAILABLE. Solo la lectura HTTP lo usa.
  viewerAccountId?: string };

export const RESULT_SET_LIMIT = 10_000; // provisional, no aprobado: se contrasta en Verify (T-G04).
export class ResultSetTooLargeError extends Error { readonly code = 'RESULT_SET_TOO_LARGE'; constructor() { super('El conjunto de resultados excede el límite.'); this.name = 'ResultSetTooLargeError'; } }
const BATCH = 500;

type Position = { at: Date; id: string };
async function readSessions(tx: AcademicTransaction, input: SessionResultsInput, limit: number, after?: Position): Promise<IndicatorHistorySession[]> {
  if (!input.studentIds.length) return [];
  const f = input.filter ?? {};
  const conditions = [inArray(gameSessions.studentId, [...input.studentIds]), isNotNull(gameSessions.startedAtServer)];
  if (input.scope.kind === 'course') conditions.push(eq(assignments.groupId, input.scope.groupId));
  // Course consumers retain TG-01 even when a caller omits or supplies another task.
  conditions.push(eq(gameSessions.taskId, input.scope.kind === 'course' ? 'TG-01' : f.taskId ?? 'TG-01'));
  if (f.startedFrom) conditions.push(gte(gameSessions.startedAtServer, f.startedFrom));
  if (f.startedBefore) conditions.push(lt(gameSessions.startedAtServer, f.startedBefore));
  if (after) conditions.push(or(lt(gameSessions.startedAtServer, after.at), and(eq(gameSessions.startedAtServer, after.at), lt(gameSessions.id, after.id)))!);
  const rows = await tx.select({ s: gameSessions, configVersion: taskPublishedVersions.version, publishedVersionId: assignments.publishedVersionId,
    originTeacherId: groups.teacherId, rule: indicatorRules, run: calculationRuns, configuration: gameConfigurations })
    .from(gameSessions)
    .innerJoin(recipients, eq(recipients.id, gameSessions.recipientId))
    .innerJoin(assignments, eq(assignments.id, recipients.assignmentId))
    .innerJoin(groups, eq(groups.id, assignments.groupId))
    .innerJoin(taskPublishedVersions, eq(taskPublishedVersions.id, assignments.publishedVersionId))
    .innerJoin(gameConfigurations, eq(gameConfigurations.publishedVersionId, assignments.publishedVersionId))
    .innerJoin(indicatorRules, eq(indicatorRules.id, gameConfigurations.ruleVersionId))
    .leftJoin(calculationRuns, and(eq(calculationRuns.id, gameSessions.activeCalculationRunId), eq(calculationRuns.status, 'SUCCEEDED')))
    .where(and(...conditions)).orderBy(desc(gameSessions.startedAtServer), desc(gameSessions.id)).limit(limit);

  const counts = new Map<string, { trials: number; incidents: number }>();
  const byRun = new Map<string, IndicatorValueDto[]>();
  const mathematical = new Map<string, typeof mentalistaEvidence.$inferSelect>();
  const dice = new Map<string, typeof kudDiceEvidence.$inferSelect>();
  const wantedMetrics = f.metricCodes, wantedScopes = f.scopes;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH), sessionIds = batch.map(r => r.s.id), runIds = batch.flatMap(r => r.run ? [r.run.id] : []);
    const trials = await tx.select({ id: rawEvents.sessionId, n: sql<number>`count(*)::int` }).from(rawEvents).where(inArray(rawEvents.sessionId, sessionIds)).groupBy(rawEvents.sessionId);
    const mathIds = batch.filter(r => r.s.taskId === 'TG-03').map(r => r.s.id);
    if (mathIds.length) for (const evidence of await tx.select().from(mentalistaEvidence).where(inArray(mentalistaEvidence.sessionId, mathIds))) mathematical.set(evidence.sessionId, evidence);
    const diceIds = batch.filter(r => r.s.taskId === 'TG-07').map(r => r.s.id);
    if (diceIds.length) for (const evidence of await tx.select().from(kudDiceEvidence).where(inArray(kudDiceEvidence.sessionId, diceIds))) dice.set(evidence.sessionId, evidence);
    const incidents = await tx.select({ id: sessionIncidents.sessionId, n: sql<number>`count(*)::int` }).from(sessionIncidents).where(inArray(sessionIncidents.sessionId, sessionIds)).groupBy(sessionIncidents.sessionId);
    for (const id of sessionIds) counts.set(id, { trials: dice.get(id)?.envelope.events.length ?? mathematical.get(id)?.envelope.events.length ?? trials.find(t => t.id === id)?.n ?? 0, incidents: dice.get(id)?.envelope.incidents.length ?? incidents.find(t => t.id === id)?.n ?? 0 });
    if (runIds.length) {
      const values = await tx.select().from(calculatedIndicators).where(and(inArray(calculatedIndicators.runId, runIds),
        wantedMetrics ? inArray(calculatedIndicators.metricCode, [...wantedMetrics]) : undefined, wantedScopes ? inArray(calculatedIndicators.scope, [...wantedScopes]) : undefined));
      for (const v of values) {
        const list = byRun.get(v.runId) ?? []; byRun.set(v.runId, list);
        list.push({ metricCode: v.metricCode as IndicatorMetricCode, scope: v.scope as IndicatorScope, status: v.status, value: v.value === null ? null : Number(v.value), unit: v.unit as '%' | 'ms',
          numerator: v.numerator, denominator: v.denominator, sampleSize: v.sampleSize, unavailabilityReason: v.unavailabilityReason as IndicatorValueDto['unavailabilityReason'] });
      }
    }
  }
  // Mismo orden que el detalle de sesión: alcance (SESSION, SEGMENT_1…3) y luego métrica.
  const allScopes: readonly string[] = [...INDICATOR_SCOPES, ...MENTALISTA_SCOPES, ...KUD_DICE_SCOPES];
  const allMetrics: readonly string[] = [...INDICATOR_METRIC_CODES, ...MENTALISTA_METRICS, ...KUD_DICE_METRICS];
  const order = (v: IndicatorValueDto) => allScopes.indexOf(v.scope) * 100 + allMetrics.indexOf(v.metricCode);
  const now = new Date();
  return rows.map(r => {
    const c = counts.get(r.s.id)!;
    const evidence = mathematical.get(r.s.id)?.envelope;
    return { sessionId: r.s.id, taskId: taskIdSchema.parse(r.s.taskId), attemptNumber: r.s.attemptNumber, occurredAt: r.s.startedAtServer!.toISOString(),
      ...(r.s.taskId === 'TG-03' ? { mentalista: { configuration: mentalistaConfig.parse(r.configuration.configuration), configurationHash: r.configuration.configurationHash,
        gameBuildId: 'tg03-mentalista-1' as const, device: evidence?.device ?? null, preparation: evidence?.preparation ?? null } } : {}),
      executionStatus: normalizeExecutionStatus({ executionStatus: r.s.executionStatus, startAllowedUntil: r.s.startAllowedUntil, startedAtServer: r.s.startedAtServer }, now),
      processingStatus: r.s.processingStatus, configVersion: r.configVersion, publishedVersionId: r.publishedVersionId, incidentCount: c.incidents, recordedTrialCount: c.trials,
      rule: { code: r.rule.code, version: r.rule.version, approval: { current: r.rule.approvalStatus, approvedAt: r.rule.approvedAt?.toISOString() ?? null } },
      approvalAtCalculation: r.run ? approvalAtCalculation({ approvalStatus: r.rule.approvalStatus, approvedAt: r.rule.approvedAt }, r.run.finishedAt) : null,
      calculation: r.run ? { runId: r.run.id, calculatedAt: r.run.finishedAt?.toISOString() ?? null } : null,
      indicators: r.run ? (byRun.get(r.run.id) ?? []).sort((a, b) => order(a) - order(b)) : [],
      // Sin asignación ni curso de origen en la respuesta: solo si el docente actual podría abrir el detalle (misma condición que `ownAssignment`).
      detailAccess: input.viewerAccountId !== undefined && r.originTeacherId === input.viewerAccountId ? 'AVAILABLE' as const : 'UNAVAILABLE' as const };
  });
}

// Función interna reutilizable (COORD-02 r2): completa o error; nunca una página parcial ni «datos insuficientes».
// Usa la transacción y el aislamiento del llamador; no abre otra, no escribe y no autoriza (el llamador comprueba curso y estudiantes).
export async function readStudentSessionResults(tx: AcademicTransaction, input: SessionResultsInput): Promise<{ items: IndicatorHistorySession[] }> {
  const items = await readSessions(tx, input, RESULT_SET_LIMIT + 1);
  if (items.length > RESULT_SET_LIMIT) throw new ResultSetTooLargeError();
  return { items };
}

// Variante paginada para la lectura HTTP de un estudiante (`limit` 1–100). Devuelve la posición de la última fila si hay más.
export async function readStudentHistoryPage(tx: AcademicTransaction, input: { studentId: string; filter?: SessionResultsFilter; viewerAccountId: string; limit: number; after?: Position }) {
  const rows = await readSessions(tx, { studentIds: [input.studentId], scope: { kind: 'student-history' }, ...(input.filter ? { filter: input.filter } : {}), viewerAccountId: input.viewerAccountId }, input.limit + 1, input.after);
  const items = rows.slice(0, input.limit), last = items.at(-1);
  return { items, next: rows.length > input.limit && last ? { at: new Date(last.occurredAt), id: last.sessionId } : null };
}
