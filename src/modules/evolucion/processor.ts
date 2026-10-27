import { and, eq, sql, asc } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db } from '../../db/client.js';
import { calculationRuns, gameSessions, resultReceipts, rawEvents, sessionIncidents, recipients, assignments, gameConfigurations, indicatorRules, calculatedIndicators } from '../../db/schema/game.js';
import { taskPublishedVersions } from '../../db/schema/tasks.js';
import { envelopeSchema, hash } from '../tareas/runtime/contract.js';
import { assertTestDatabase, type GameDependencies } from '../academico/shared/participation.js';
import { calculate, RULE } from './tg01.js';

export async function processOne(deps: GameDependencies = {}) {
  if (deps.testParticipation) assertTestDatabase();
  const claimed = await db.transaction(async tx => {
    const [run] = await tx.select().from(calculationRuns).where(sql`(
      (${calculationRuns.status} = 'PENDING' and (${calculationRuns.nextAttemptAt} is null or ${calculationRuns.nextAttemptAt} <= now())) or
      (${calculationRuns.status} = 'PROCESSING' and ${calculationRuns.leaseUntil} <= now()))`)
      .orderBy(asc(calculationRuns.createdAt), asc(calculationRuns.id)).limit(1).for('update', { skipLocked: true });
    if (!run) return null;
    const token = randomUUID();
    await tx.update(calculationRuns).set({ status: 'PROCESSING', startedAt: sql`now()`, leaseToken: token,
      leaseUntil: sql`now() + interval '30 seconds'`, attemptCount: run.attemptCount + 1 }).where(eq(calculationRuns.id, run.id));
    await tx.update(gameSessions).set({ processingStatus: 'PROCESSING' }).where(eq(gameSessions.id, run.sessionId));
    return { ...run, leaseToken: token, attemptCount: run.attemptCount + 1 };
  });
  if (!claimed) return false;
  try {
    const [row] = await db.select({ s: gameSessions, receipt: resultReceipts, config: gameConfigurations, rule: indicatorRules, version: taskPublishedVersions })
      .from(gameSessions).innerJoin(resultReceipts, eq(resultReceipts.sessionId, gameSessions.id))
      .innerJoin(recipients, eq(recipients.id, gameSessions.recipientId)).innerJoin(assignments, eq(assignments.id, recipients.assignmentId))
      .innerJoin(gameConfigurations, eq(gameConfigurations.publishedVersionId, assignments.publishedVersionId))
      .innerJoin(taskPublishedVersions, eq(taskPublishedVersions.id, assignments.publishedVersionId))
      .innerJoin(indicatorRules, eq(indicatorRules.id, claimed.ruleVersionId)).where(eq(gameSessions.id, claimed.sessionId));
    if (!row || row.config.ruleVersionId !== claimed.ruleVersionId || row.rule.definitionHash !== hash(RULE) || hash(row.rule.definition) !== row.rule.definitionHash) throw new Error('RULE_UNSUPPORTED');
    const trials = await db.select().from(rawEvents).where(eq(rawEvents.sessionId, claimed.sessionId)).orderBy(asc(rawEvents.trial));
    const incidents = await db.select().from(sessionIncidents).where(eq(sessionIncidents.sessionId, claimed.sessionId)).orderBy(asc(sessionIncidents.sequence));
    const r = row.receipt;
    const e = envelopeSchema.parse({ contractVersion: r.contractVersion, sessionId: row.s.id, submissionId: r.submissionId, taskId: row.s.taskId,
      publishedVersionId: row.version.id, configVersion: row.version.version, configurationHash: row.config.configurationHash, gameBuildId: row.config.gameBuildId,
      state: r.producerState, terminationReason: r.terminationReason, clock: { id: r.clockId, timeOriginUnixMs: r.timeOriginUnixMs },
      timing: { startedAtMs: r.startedAtMs, finishedAtMs: r.finishedAtMs, lastCheckpointAtMs: r.lastCheckpointAtMs }, device: r.device,
      events: trials.map(({ id: _, sessionId: __, ...t }) => t), incidents: incidents.map(({ id: _, sessionId: __, ...i }) => i) });
    if (hash(e) !== claimed.evidenceHash) throw new Error('EVIDENCE_HASH_MISMATCH');
    const allowed = row.rule.approvalStatus === 'APPROVED' || Boolean(deps.testParticipation);
    const result = calculate(e, allowed);
    await db.transaction(async tx => {
      const [current] = await tx.select().from(calculationRuns).where(and(eq(calculationRuns.id, claimed.id), eq(calculationRuns.leaseToken, claimed.leaseToken), eq(calculationRuns.status, 'PROCESSING'), sql`${calculationRuns.leaseUntil} > now()`)).for('update');
      if (!current) return;
      await tx.insert(calculatedIndicators).values(result.indicators.map(i => ({ ...i, value: i.value === null ? null : i.value.toFixed(6), runId: claimed.id })));
      await tx.update(calculationRuns).set({ status: 'SUCCEEDED', finishedAt: sql`now()`, leaseUntil: null, failureCode: null, evidenceDecisions: result.decisions, summary: result.summary }).where(eq(calculationRuns.id, claimed.id));
      await tx.update(gameSessions).set({ activeCalculationRunId: claimed.id, processingStatus: 'COMPLETED' }).where(eq(gameSessions.id, claimed.sessionId));
    });
  } catch {
    await db.transaction(async tx => {
      const [current] = await tx.select().from(calculationRuns).where(and(eq(calculationRuns.id, claimed.id), eq(calculationRuns.leaseToken, claimed.leaseToken), eq(calculationRuns.status, 'PROCESSING'), sql`${calculationRuns.leaseUntil} > now()`)).for('update');
      if (!current) return;
      const retry = claimed.attemptCount < 4;
      await tx.update(calculationRuns).set({ status: retry ? 'PENDING' : 'FAILED', failureCode: 'CALCULATION_FAILED', leaseUntil: null,
        finishedAt: retry ? null : sql`now()`, nextAttemptAt: retry ? sql`now() + ${[5, 15, 60][claimed.attemptCount - 1]!} * interval '1 second'` : null }).where(eq(calculationRuns.id, claimed.id));
      await tx.update(gameSessions).set({ processingStatus: retry ? 'PENDING' : 'FAILED' }).where(eq(gameSessions.id, claimed.sessionId));
    });
  }
  return true;
}
export function startProcessor(deps: GameDependencies = {}) {
  let busy = false, stopped = false;
  const tick = async () => {
    if (busy || stopped) return;
    busy = true;
    try { for (let n = 0; n < 100 && !stopped && await processOne(deps); n++); }
    catch { console.warn(JSON.stringify({ event: 'game_processor_unavailable', code: 'UNAVAILABLE' })); }
    finally { busy = false; }
  };
  const timer = setInterval(() => void tick(), 5000); timer.unref(); void tick();
  return () => { stopped = true; clearInterval(timer); };
}
