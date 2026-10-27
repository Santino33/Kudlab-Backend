import { and, eq, sql, asc, desc, inArray, lt } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../../../db/client.js';
import { students, groups } from '../../../db/schema/academic.js';
import { userAccounts } from '../../../db/schema/accounts.js';
import { user } from '../../../db/schema/auth.js';
import { tasks, taskPublishedVersions } from '../../../db/schema/tasks.js';
import { assignments, recipients, operationReceipts, gameSessions, runtimeCapabilities, launchGrants, resultReceipts, rawEvents, sessionIncidents, gameConfigurations, indicatorRules, calculationRuns, calculatedIndicators } from '../../../db/schema/game.js';
import { withAcademicAccess, type AcademicActor, type AcademicTransaction as Tx } from '../../academico/shared/academic-auth.js';
import { participationProvider, requireParticipation, type GameDependencies } from '../../academico/shared/participation.js';
import { hasActiveIdentity } from '../../usuarios/shared/accounts.types.js';
import { notFound } from '../../academico/shared/academic.errors.js';
import { compatible, envelopeSchema, hash, secretDigest, uuid, uuidV4, secret, type Envelope } from './contract.js';
import { GameError, conflict } from './errors.js';
import { cursorFor, cursorPosition, decryptGrant, encryptGrant, runtimeSettings } from './security.js';
import { RULE } from '../../evolucion/tg01.js';
import { requestInput, createInput } from './dto.js';

type SessionRow = typeof gameSessions.$inferSelect;
type Capability = typeof runtimeCapabilities.$inferSelect;
function resourceId(id: string) { if (!uuid.safeParse(id).success) throw notFound(); }

export function createGameService(deps: GameDependencies = {}) {
  const participation = participationProvider(deps), synthetic = Boolean(deps.testParticipation);
  const methodAllowed = (rule: typeof indicatorRules.$inferSelect) => hash(rule.definition) === rule.definitionHash &&
    hash(rule.definition) === hash(RULE) && (rule.approvalStatus === 'APPROVED' || synthetic);
  async function ownGroup(tx: Tx, actor: AcademicActor, id: string) {
    resourceId(id);
    const [group] = await tx.select().from(groups).where(and(eq(groups.id, id), eq(groups.teacherId, actor.accountId))).for('share');
    if (!group) throw notFound();
    return group;
  }
  async function ownAssignment(tx: Tx, actor: AcademicActor, id: string) {
    resourceId(id);
    const [a] = await tx.select({ a: assignments }).from(assignments).innerJoin(groups, eq(groups.id, assignments.groupId))
      .where(and(eq(assignments.id, id), eq(groups.teacherId, actor.accountId)));
    if (!a) throw notFound();
    await ownGroup(tx, actor, a.a.groupId);
    return a.a;
  }
  async function ownStudent(tx: Tx, actor: AcademicActor, id: string) {
    resourceId(id);
    const [s] = await tx.select().from(students).where(eq(students.id, id));
    if (!s) throw notFound();
    await ownGroup(tx, actor, s.groupId);
    return s;
  }
  async function ownSession(tx: Tx, actor: AcademicActor, id: string) {
    resourceId(id);
    const [s] = await tx.select().from(gameSessions).where(eq(gameSessions.id, id));
    if (!s) throw notFound();
    const a = await ownAssignment(tx, actor, (await recipient(tx, s.recipientId)).assignmentId);
    await ownStudent(tx, actor, s.studentId);
    return { s, a };
  }
  async function recipient(tx: Tx, id: string) {
    resourceId(id);
    const [r] = await tx.select().from(recipients).where(eq(recipients.id, id));
    if (!r) throw notFound();
    return r;
  }
  async function lockStudent(tx: Tx, id: string) { await tx.select().from(students).where(eq(students.id, id)).for('update'); }
  async function expire(tx: Tx, studentId: string, now = new Date()) {
    await tx.update(gameSessions).set({ executionStatus: 'EXPIRED' }).where(and(eq(gameSessions.studentId, studentId), eq(gameSessions.executionStatus, 'READY'), lt(gameSessions.startAllowedUntil, now)));
    await tx.update(gameSessions).set({ executionStatus: 'UNCONFIRMED' }).where(and(eq(gameSessions.studentId, studentId), eq(gameSessions.executionStatus, 'RUNNING'), sql`${gameSessions.startedAtServer} + interval '32 minutes' <= ${now}`));
  }
  async function configuration(tx: Tx, id: string) {
    const [c] = await tx.select({ config: gameConfigurations, version: taskPublishedVersions, task: tasks, rule: indicatorRules }).from(gameConfigurations)
      .innerJoin(taskPublishedVersions, eq(taskPublishedVersions.id, gameConfigurations.publishedVersionId))
      .innerJoin(tasks, eq(tasks.id, taskPublishedVersions.taskId)).innerJoin(indicatorRules, eq(indicatorRules.id, gameConfigurations.ruleVersionId))
      .where(eq(gameConfigurations.publishedVersionId, id)).for('share');
    if (!c || c.rule.taskId !== c.task.id || !compatible(c.config.contractVersion, c.config.gameBuildId, c.config.configuration) || hash(c.config.configuration) !== c.config.configurationHash)
      throw conflict('CONFIGURATION_UNSUPPORTED');
    return c;
  }
  async function ready(tx: Tx, a: typeof assignments.$inferSelect, now: Date) {
    const [current] = await tx.select().from(assignments).where(eq(assignments.id, a.id)).for('share');
    if (!current) throw notFound();
    a = current;
    if (a.status !== 'OPEN') throw conflict('ASSIGNMENT_CANCELLED');
    if (now < a.startsAt || now >= a.endsAt) throw conflict('OUTSIDE_WINDOW');
    const c = await configuration(tx, a.publishedVersionId);
    if (!c.task.isEnabled || !methodAllowed(c.rule)) throw conflict('TASK_UNAVAILABLE');
    return c;
  }
  async function operation(tx: Tx, actor: AcademicActor, input: { requestId: string }, name: string, target: string, payload: unknown, run: () => Promise<string>) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${actor.accountId + ':' + input.requestId}, 0))`);
    const fingerprint = hash({ operation: name, target, payload });
    const [old] = await tx.select().from(operationReceipts).where(and(eq(operationReceipts.actorId, actor.accountId), eq(operationReceipts.requestId, input.requestId)));
    if (old) { if (old.requestHash !== fingerprint) throw conflict('REQUEST_CONFLICT'); return { id: old.references.id, repeated: true }; }
    const id = await run();
    await tx.insert(operationReceipts).values({ actorId: actor.accountId, requestId: input.requestId, operation: name, requestHash: fingerprint, references: { id } });
    return { id, repeated: false };
  }
  async function assignmentDetail(tx: Tx, a: typeof assignments.$inferSelect) {
    const [version] = await tx.select().from(taskPublishedVersions).where(eq(taskPublishedVersions.id, a.publishedVersionId));
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, a.taskId));
    const rows = await tx.select({ r: recipients, s: students }).from(recipients).innerJoin(students, eq(students.id, recipients.studentId)).where(eq(recipients.assignmentId, a.id)).orderBy(asc(recipients.id));
    const now = new Date();
    const detail = [];
    for (const { r, s } of rows) {
      const sessions = await tx.select().from(gameSessions).where(eq(gameSessions.studentId, s.id));
      const active = sessions.find(v => v.taskId === a.taskId && (v.executionStatus === 'READY' && v.startAllowedUntil > now || v.executionStatus === 'RUNNING' && v.startedAtServer!.getTime() + 1920000 > now.getTime()));
      const attemptsStarted = sessions.filter(v => v.recipientId === r.id && v.attemptNumber !== null).length;
      const reasons: string[] = [];
      try { await ready(tx, a, now); } catch (error) { reasons.push(error instanceof GameError ? error.reason ?? 'TASK_UNAVAILABLE' : 'TASK_UNAVAILABLE'); }
      if (s.groupId !== a.groupId) reasons.push('PARTICIPATION_BLOCKED');
      try { await requireParticipation(participation, tx, s.id, now); } catch { reasons.push('PARTICIPATION_BLOCKED'); }
      if (attemptsStarted >= a.maxAttempts) reasons.push('ATTEMPT_LIMIT');
      if (active?.executionStatus === 'RUNNING') reasons.push('ACTIVE_SESSION');
      detail.push({ id: r.id, studentId: s.id, studentDisplayName: `${s.firstName} ${s.lastName}`, studentCode: s.studentCode,
        attemptsStarted, activeSessionId: active?.id ?? null, canLaunch: reasons.length === 0, unavailableReasons: [...new Set(reasons)] });
    }
    return { id: a.id, taskId: a.taskId, title: task!.title, publishedVersionId: a.publishedVersionId, configVersion: version!.version, groupId: a.groupId,
      startsAt: a.startsAt.toISOString(), endsAt: a.endsAt.toISOString(), maxAttempts: a.maxAttempts, status: a.status,
      availability: a.status === 'CANCELLED' ? 'CANCELLED' : now < a.startsAt ? 'FUTURE' : now >= a.endsAt ? 'EXPIRED' : 'CURRENT', recipientCount: rows.length, createdAt: a.createdAt.toISOString(), recipients: detail };
  }
  const receiptDto = (r: typeof resultReceipts.$inferSelect) => ({ receiptId: r.id, sessionId: r.sessionId, submissionId: r.submissionId, receivedAt: r.receivedAt.toISOString(), evidenceHash: r.evidenceHash, processingStatusAtReceipt: 'PENDING' as const });
  async function sessionConfig(tx: Tx, s: SessionRow) {
    const r = await recipient(tx, s.recipientId);
    const [a] = await tx.select().from(assignments).where(eq(assignments.id, r.assignmentId));
    return { a: a!, r, c: await configuration(tx, a!.publishedVersionId) };
  }
  async function sessionSummary(tx: Tx, s: SessionRow) {
    const { a, c } = await sessionConfig(tx, s);
    const [counts] = await tx.select({ n: sql<number>`count(*)::int` }).from(rawEvents).where(eq(rawEvents.sessionId, s.id));
    const [incidents] = await tx.select({ n: sql<number>`count(*)::int` }).from(sessionIncidents).where(eq(sessionIncidents.sessionId, s.id));
    const now = Date.now();
    const executionStatus = s.executionStatus === 'READY' && s.startAllowedUntil.getTime() <= now ? 'EXPIRED' : s.executionStatus === 'RUNNING' && s.startedAtServer!.getTime() + 1920000 <= now ? 'UNCONFIRMED' : s.executionStatus;
    return { id: s.id, studentId: s.studentId, taskId: s.taskId, assignmentId: a.id, attemptNumber: s.attemptNumber, launchMode: s.launchMode,
      configVersion: c.version.version, gameBuildId: c.config.gameBuildId, executionStatus, processingStatus: s.processingStatus,
      preparedAt: s.preparedAt.toISOString(), startedAtServer: s.startedAtServer?.toISOString() ?? null, receivedAt: s.closedReceivedAt?.toISOString() ?? null,
      incidentCount: incidents!.n, recordedTrialCount: counts!.n };
  }
  async function currentIssuer(tx: Tx, accountId: string, groupId: string) {
    const [g] = await tx.select().from(groups).where(eq(groups.id, groupId)).for('share');
    const [account] = await tx.select().from(userAccounts).where(eq(userAccounts.id, accountId)).for('share');
    const [identity] = account?.authUserId ? await tx.select().from(user).where(eq(user.id, account.authUserId)).for('share', { noWait: true }) : [];
    if (!g || g.teacherId !== accountId || !account || account.role !== 'TEACHER' || !hasActiveIdentity(account, identity) || identity?.email.toLowerCase() !== account.emailNormalized)
      throw new GameError(403, 'PARTICIPATION_BLOCKED');
  }
  async function context(tx: Tx, s: SessionRow, cap: Capability) {
    const { c } = await sessionConfig(tx, s), now = new Date();
    return { sessionId: s.id, taskId: s.taskId, publishedVersionId: c.version.id, configVersion: c.version.version,
      configurationHash: c.config.configurationHash, gameBuildId: c.config.gameBuildId, contractVersion: c.config.contractVersion, config: c.config.configuration,
      executionStatus: s.executionStatus, attemptNumber: s.attemptNumber, startAllowedUntil: cap.startAllowedUntil.toISOString(),
      uploadAllowedUntil: s.startedAtServer ? cap.expiresAt.toISOString() : null, serverTime: now.toISOString(),
      capabilities: { canStart: cap.canStart && s.executionStatus === 'READY' && cap.startAllowedUntil > now,
        canSubmit: cap.canSubmit && s.attemptNumber !== null, canReadReceipt: cap.canReadReceipt } };
  }
  async function authenticated<T>(sessionId: string, token: string, work: (tx: Tx, s: SessionRow, cap: Capability) => Promise<T>) {
    resourceId(sessionId); const digest = secretDigest(token);
    return db.transaction(async tx => {
      const [initial] = await tx.select().from(runtimeCapabilities).where(eq(runtimeCapabilities.secretDigest, digest));
      if (!initial || initial.revokedAt || initial.expiresAt <= new Date()) throw new GameError(401, 'RUNTIME_UNAUTHENTICATED');
      if (initial.sessionId !== sessionId) throw notFound();
      const [before] = await tx.select().from(gameSessions).where(eq(gameSessions.id, sessionId));
      await lockStudent(tx, before!.studentId); await expire(tx, before!.studentId);
      const [s] = await tx.select().from(gameSessions).where(eq(gameSessions.id, sessionId)).for('update');
      const [cap] = await tx.select().from(runtimeCapabilities).where(eq(runtimeCapabilities.id, initial.id)).for('update');
      if (!cap || cap.revokedAt || cap.expiresAt <= new Date()) throw new GameError(401, 'RUNTIME_UNAUTHENTICATED');
      return work(tx, s!, cap);
    });
  }
  return {
    async createAssignment(actor: AcademicActor, payload: unknown) {
      const input = createInput.parse(payload), { requestId, ...content } = input;
      return withAcademicAccess(actor, async tx => {
        await ownGroup(tx, actor, input.groupId);
        const op = await operation(tx, actor, input, 'CREATE_ASSIGNMENT', input.groupId, content, async () => {
          const c = await configuration(tx, input.publishedVersionId);
          if (c.config.contractVersion !== '1.1') throw conflict('CONFIGURATION_UNSUPPORTED');
          if (c.task.id !== input.taskId || !c.task.isEnabled || !methodAllowed(c.rule)) throw conflict('TASK_UNAVAILABLE');
          for (const id of [...input.studentIds].sort()) { await lockStudent(tx, id); const s = await ownStudent(tx, actor, id); if (s.groupId !== input.groupId) throw notFound(); await requireParticipation(participation, tx, id, new Date()); }
          const [a] = await tx.insert(assignments).values({ ...content, studentIds: undefined, createdBy: actor.accountId, startsAt: new Date(input.startsAt), endsAt: new Date(input.endsAt), requestId, requestHash: hash(content) } as typeof assignments.$inferInsert).returning();
          await tx.insert(recipients).values(input.studentIds.map(studentId => ({ assignmentId: a!.id, studentId })));
          return a!.id;
        });
        return { repeated: op.repeated, detail: await assignmentDetail(tx, await ownAssignment(tx, actor, op.id)) };
      });
    },
    async assignment(actor: AcademicActor, id: string) { return withAcademicAccess(actor, async tx => assignmentDetail(tx, await ownAssignment(tx, actor, id))); },
    async listAssignments(actor: AcademicActor, groupId: string, paging: Paging) {
      return withAcademicAccess(actor, async tx => {
        await ownGroup(tx, actor, groupId); const filter = `assignments:${groupId}`, position = datePosition(paging.cursor, filter);
        const rows = await tx.select().from(assignments).where(and(eq(assignments.groupId, groupId), position ? sql`(${assignments.createdAt}, ${assignments.id}) < (${position.at}::timestamptz, ${position.id}::uuid)` : undefined)).orderBy(desc(assignments.createdAt), desc(assignments.id)).limit(paging.limit + 1);
        const page = rows.slice(0, paging.limit), items = [];
        for (const a of page) { const { recipients: _, ...summary } = await assignmentDetail(tx, a); items.push(summary); }
        const last = page.at(-1);
        return { items, nextCursor: rows.length > paging.limit ? cursorFor(filter, { at: last!.createdAt.toISOString(), id: last!.id }) : null };
      });
    },
    async cancel(actor: AcademicActor, id: string, payload: unknown) {
      const input = requestInput.parse(payload);
      return withAcademicAccess(actor, async tx => {
        await ownAssignment(tx, actor, id);
        await operation(tx, actor, input, 'CANCEL', id, {}, async () => {
          await tx.update(assignments).set({ status: 'CANCELLED', cancelledAt: new Date(), cancelledBy: actor.accountId }).where(and(eq(assignments.id, id), eq(assignments.status, 'OPEN'))); return id;
        });
        return assignmentDetail(tx, await ownAssignment(tx, actor, id));
      });
    },
    async grant(actor: AcademicActor, target: string, payload: unknown, recovery = false) {
      const input: { requestId: string; submissionId?: string } = recovery ? requestInput.extend({ submissionId: uuidV4 }).parse(payload) : requestInput.parse(payload);
      return withAcademicAccess(actor, async tx => {
        const owned = recovery ? await ownSession(tx, actor, target) : null;
        const r = owned ? await recipient(tx, owned.s.recipientId) : await recipient(tx, target);
        const a = await ownAssignment(tx, actor, r.assignmentId);
        const s0 = await ownStudent(tx, actor, r.studentId);
        if (s0.groupId !== a.groupId) throw notFound();
        const { requestId, ...content } = input;
        const op = await operation(tx, actor, input, recovery ? 'RECOVER' : 'LAUNCH', target, content, async () => {
          await lockStudent(tx, r.studentId); await expire(tx, r.studentId);
          const now = new Date(), eligibility = await requireParticipation(participation, tx, r.studentId, now);
          let s: SessionRow;
          if (owned) {
            const [latest] = await tx.select().from(gameSessions).where(eq(gameSessions.id, owned.s.id)).for('update'); s = latest!;
            if (s.attemptNumber === null) throw conflict('SESSION_NOT_STARTED');
            const [receipt] = await tx.select().from(resultReceipts).where(eq(resultReceipts.sessionId, s.id));
            if (receipt && receipt.submissionId !== input.submissionId) throw conflict('RESULT_CONFLICT');
          } else {
            const configured = await ready(tx, a, now);
            const existing = await tx.select().from(gameSessions).where(and(eq(gameSessions.studentId, r.studentId), eq(gameSessions.taskId, a.taskId), inArray(gameSessions.executionStatus, ['READY', 'RUNNING'])));
            if (existing[0]?.executionStatus === 'RUNNING') throw conflict('ACTIVE_SESSION');
            if (existing[0] && existing[0].recipientId !== r.id) throw conflict('ACTIVE_SESSION');
            if (!existing[0] && configured.config.contractVersion !== '1.1') throw conflict('CONFIGURATION_UNSUPPORTED');
            const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(gameSessions).where(and(eq(gameSessions.recipientId, r.id), sql`${gameSessions.attemptNumber} is not null`));
            if (count!.n >= a.maxAttempts) throw conflict('ATTEMPT_LIMIT');
            const until = new Date(Math.min((existing[0]?.preparedAt ?? now).getTime() + 900000, a.endsAt.getTime(), eligibility.validUntil.getTime()));
            if (existing[0]) {
              s = existing[0];
              await tx.update(runtimeCapabilities).set({ revokedAt: now }).where(eq(runtimeCapabilities.sessionId, s.id));
              await tx.update(launchGrants).set({ invalidatedAt: now }).where(eq(launchGrants.sessionId, s.id));
              [s] = await tx.update(gameSessions).set({ startAllowedUntil: until }).where(eq(gameSessions.id, s.id)).returning() as [SessionRow];
            } else {
              [s] = await tx.insert(gameSessions).values({ recipientId: r.id, studentId: r.studentId, taskId: a.taskId, startAllowedUntil: until }).returning() as [SessionRow];
            }
          }
          const id = randomUUID(), token = randomBytes(32).toString('base64url'), sealed = encryptGrant(token, `${s.id}:${id}`);
          await tx.insert(launchGrants).values({ id, sessionId: s.id, scope: recovery ? 'RECOVER_SUBMISSION' : 'START_SESSION',
            submissionId: recovery ? input.submissionId! : null, secretDigest: secretDigest(token),
            secretCiphertext: sealed.ciphertext, encryptionKeyId: sealed.keyId, expiresAt: new Date(now.getTime() + 300000), issuedBy: actor.accountId, requestId, requestHash: hash(content) });
          return id;
        });
        const [g] = await tx.select().from(launchGrants).where(eq(launchGrants.id, op.id));
        if (!g || g.invalidatedAt || g.expiresAt <= new Date()) throw conflict('GRANT_NOT_USABLE');
        return { repeated: op.repeated, detail: { sessionId: g.sessionId, grantId: g.id, launchGrant: decryptGrant(g.secretCiphertext, g.encryptionKeyId, `${g.sessionId}:${g.id}`), expiresAt: g.expiresAt.toISOString(), runtimeOrigin: runtimeSettings().origin } };
      });
    },
    async claim(token: string, payload: unknown) {
      const input = z.strictObject({ claimId: uuidV4, runtimeSecret: secret }).parse(payload), digest = secretDigest(token);
      return db.transaction(async tx => {
        const [initial] = await tx.select().from(launchGrants).where(eq(launchGrants.secretDigest, digest));
        if (!initial || initial.invalidatedAt) throw new GameError(401, 'RUNTIME_UNAUTHENTICATED');
        const [before] = await tx.select().from(gameSessions).where(eq(gameSessions.id, initial.sessionId));
        await lockStudent(tx, before!.studentId); await expire(tx, before!.studentId);
        const [g] = await tx.select().from(launchGrants).where(eq(launchGrants.id, initial.id)).for('update');
        const [s] = await tx.select().from(gameSessions).where(eq(gameSessions.id, initial.sessionId)).for('update');
        if (g!.invalidatedAt) throw new GameError(401, 'RUNTIME_UNAUTHENTICATED');
        const { a } = await sessionConfig(tx, s!);
        if (g!.claimedAt) {
          const [cap] = await tx.select().from(runtimeCapabilities).where(eq(runtimeCapabilities.id, g!.boundCapabilityId!));
          if (g!.claimId !== input.claimId || cap!.secretDigest !== secretDigest(input.runtimeSecret)) throw new GameError(409, 'CLAIM_CONFLICT');
          if (cap!.revokedAt || cap!.expiresAt <= new Date()) throw new GameError(401, 'RUNTIME_UNAUTHENTICATED');
          if (s!.executionStatus === 'READY') { await currentIssuer(tx, g!.issuedBy, a.groupId); await requireParticipation(participation, tx, s!.studentId, new Date()); await ready(tx, a, new Date()); }
          return context(tx, s!, cap!);
        }
        const now = new Date();
        if (g!.expiresAt <= now) throw new GameError(401, 'RUNTIME_UNAUTHENTICATED');
        await currentIssuer(tx, g!.issuedBy, a.groupId);
        await requireParticipation(participation, tx, s!.studentId, now);
        const recovery = g!.scope === 'RECOVER_SUBMISSION';
        if (!recovery) { await ready(tx, a, now); if (s!.executionStatus !== 'READY' || s!.startAllowedUntil <= now) throw new GameError(409, 'SESSION_NOT_STARTABLE'); }
        const expires = recovery ? new Date(now.getTime() + 86400000) : s!.startAllowedUntil;
        const [cap] = await tx.insert(runtimeCapabilities).values({ sessionId: s!.id, claimId: input.claimId, secretDigest: secretDigest(input.runtimeSecret),
          canStart: !recovery, canSubmit: recovery, canReadReceipt: true, startAllowedUntil: s!.startAllowedUntil, expiresAt: expires, submissionId: g!.submissionId }).returning();
        await tx.update(launchGrants).set({ claimId: input.claimId, claimedAt: now, boundCapabilityId: cap!.id }).where(eq(launchGrants.id, g!.id));
        return context(tx, s!, cap!);
      });
    },
    async context(id: string, token: string) {
      return authenticated(id, token, async (tx, s, cap) => {
        if (s.executionStatus === 'READY') {
          const { a } = await sessionConfig(tx, s), [g] = await tx.select().from(launchGrants).where(eq(launchGrants.boundCapabilityId, cap.id));
          if (!g) throw new GameError(401, 'RUNTIME_UNAUTHENTICATED');
          await currentIssuer(tx, g.issuedBy, a.groupId); await ready(tx, a, new Date()); await requireParticipation(participation, tx, s.studentId, new Date());
        }
        return context(tx, s, cap);
      });
    },
    async start(id: string, token: string, payload: unknown) {
      const { startId } = z.strictObject({ startId: uuidV4 }).parse(payload);
      return authenticated(id, token, async (tx, s, cap) => {
        const now = new Date();
        if (!cap.canStart || !['READY', 'RUNNING'].includes(s.executionStatus)) throw new GameError(409, 'SESSION_NOT_STARTABLE');
        const { a } = await sessionConfig(tx, s);
        const [grant] = await tx.select().from(launchGrants).where(eq(launchGrants.boundCapabilityId, cap.id));
        if (!grant) throw new GameError(401, 'RUNTIME_UNAUTHENTICATED');
        await currentIssuer(tx, grant.issuedBy, a.groupId);
        const eligibility = await requireParticipation(participation, tx, s.studentId, now);
        await ready(tx, a, now);
        if (s.executionStatus === 'RUNNING') {
          if (s.startRequestId !== startId) throw new GameError(409, 'SESSION_ALREADY_STARTED');
        } else {
          if (cap.startAllowedUntil <= now) throw new GameError(409, 'SESSION_NOT_STARTABLE');
          const [student] = await tx.select().from(students).where(eq(students.id, s.studentId));
          if (student!.groupId !== a.groupId) throw new GameError(403, 'PARTICIPATION_BLOCKED');
          const [count] = await tx.select({ n: sql<number>`count(*)::int` }).from(gameSessions).where(and(eq(gameSessions.recipientId, s.recipientId), sql`${gameSessions.attemptNumber} is not null`));
          if (count!.n >= a.maxAttempts) throw new GameError(409, 'ATTEMPT_LIMIT');
          const [started] = await tx.update(gameSessions).set({ executionStatus: 'RUNNING', attemptNumber: count!.n + 1, startedAtServer: now, startRequestId: startId,
            uploadAllowedUntil: new Date(now.getTime() + 604800000), groupIdAtStart: a.groupId, participationAuthorizationRef: eligibility.authorizationReference }).where(eq(gameSessions.id, id)).returning();
          s = started!;
          await tx.update(runtimeCapabilities).set({ canSubmit: true, expiresAt: s.uploadAllowedUntil! }).where(eq(runtimeCapabilities.id, cap.id));
        }
        return { sessionId: id, attemptNumber: s.attemptNumber!, executionStatus: 'RUNNING' as const, startedAtServer: s.startedAtServer!.toISOString(), uploadAllowedUntil: s.uploadAllowedUntil!.toISOString() };
      });
    },
    async submit(id: string, token: string, payload: unknown) {
      const e = envelopeSchema.parse(payload);
      return authenticated(id, token, async (tx, s, cap) => {
        const fingerprint = hash(e);
        if (e.sessionId !== id) throw new GameError(409, 'VERSION_UNSUPPORTED');
        if (cap.submissionId && cap.submissionId !== e.submissionId) throw new GameError(409, 'RESULT_CONFLICT');
        const [old] = await tx.select().from(resultReceipts).where(eq(resultReceipts.sessionId, id));
        if (old) {
          if (old.submissionId !== e.submissionId) throw new GameError(409, 'SESSION_ALREADY_SUBMITTED');
          if (old.evidenceHash !== fingerprint) throw new GameError(409, 'RESULT_CONFLICT');
          return { repeated: true, receipt: receiptDto(old) };
        }
        if (!s.startedAtServer || !s.attemptNumber) throw new GameError(409, 'SESSION_NOT_STARTED');
        if (!cap.canSubmit) throw new GameError(401, 'RUNTIME_UNAUTHENTICATED');
        await requireParticipation(participation, tx, s.studentId, new Date());
        const { c } = await sessionConfig(tx, s);
        if (e.publishedVersionId !== c.version.id || e.configVersion !== c.version.version || e.contractVersion !== c.config.contractVersion || e.gameBuildId !== c.config.gameBuildId || e.configurationHash !== c.config.configurationHash || e.taskId !== s.taskId) throw new GameError(409, 'VERSION_UNSUPPORTED');
        const [global] = await tx.select().from(resultReceipts).where(eq(resultReceipts.submissionId, e.submissionId));
        if (global) throw new GameError(409, 'RESULT_CONFLICT');
        const [receipt] = await tx.insert(resultReceipts).values({ sessionId: id, submissionId: e.submissionId, contractVersion: e.contractVersion, evidenceHash: fingerprint,
          producerState: e.state, terminationReason: e.terminationReason, clockId: e.clock.id, timeOriginUnixMs: e.clock.timeOriginUnixMs, ...e.timing, device: e.device }).returning();
        if (e.events.length) await tx.insert(rawEvents).values(e.events.map(t => ({ sessionId: id, ...t })));
        if (e.incidents.length) await tx.insert(sessionIncidents).values(e.incidents.map(i => ({ sessionId: id, ...i })));
        await tx.insert(calculationRuns).values({ sessionId: id, ruleVersionId: c.rule.id, runNumber: 1, evidenceHash: fingerprint });
        await tx.update(gameSessions).set({ executionStatus: e.state === 'completed' ? 'COMPLETED' : 'INTERRUPTED', processingStatus: 'PENDING', closedReceivedAt: receipt!.receivedAt }).where(eq(gameSessions.id, id));
        return { repeated: false, receipt: receiptDto(receipt!) };
      });
    },
    async receipt(id: string, token: string, submissionId: string) {
      uuidV4.parse(submissionId);
      return authenticated(id, token, async (tx, _s, cap) => {
        if (!cap.canReadReceipt || cap.submissionId && cap.submissionId !== submissionId) throw notFound();
        const [r] = await tx.select().from(resultReceipts).where(and(eq(resultReceipts.sessionId, id), eq(resultReceipts.submissionId, submissionId)));
        return { receipt: r ? receiptDto(r) : null };
      });
    },
    async listSessions(actor: AcademicActor, studentId: string, taskId: string | undefined, paging: Paging) {
      return withAcademicAccess(actor, async tx => {
        await ownStudent(tx, actor, studentId); const filter = `sessions:${studentId}:${taskId ?? ''}`, position = datePosition(paging.cursor, filter);
        const rows = await tx.select().from(gameSessions).where(and(eq(gameSessions.studentId, studentId), taskId ? eq(gameSessions.taskId, taskId) : undefined,
          position ? sql`(${gameSessions.preparedAt}, ${gameSessions.id}) < (${position.at}::timestamptz, ${position.id}::uuid)` : undefined)).orderBy(desc(gameSessions.preparedAt), desc(gameSessions.id)).limit(paging.limit + 1);
        const page = rows.slice(0, paging.limit), items = [];
        for (const s of page) { await ownSession(tx, actor, s.id); items.push(await sessionSummary(tx, s)); }
        return { items, nextCursor: rows.length > paging.limit ? cursorFor(filter, { at: page.at(-1)!.preparedAt.toISOString(), id: page.at(-1)!.id }) : null };
      });
    },
    async session(actor: AcademicActor, id: string) {
      return withAcademicAccess(actor, async tx => {
        const { s } = await ownSession(tx, actor, id), { c } = await sessionConfig(tx, s);
        const [receipt] = await tx.select().from(resultReceipts).where(eq(resultReceipts.sessionId, id));
        const [run] = await tx.select().from(calculationRuns).where(s.activeCalculationRunId ? eq(calculationRuns.id, s.activeCalculationRunId) : eq(calculationRuns.sessionId, id)).orderBy(desc(calculationRuns.runNumber)).limit(1);
        const values = run?.status === 'SUCCEEDED' ? await tx.select().from(calculatedIndicators).where(eq(calculatedIndicators.runId, run.id)).orderBy(
          sql`case ${calculatedIndicators.scope} when 'SESSION' then 0 when 'SEGMENT_1' then 1 when 'SEGMENT_2' then 2 else 3 end`,
          sql`case ${calculatedIndicators.metricCode} when 'accuracy_pct' then 0 when 'omission_rate_pct' then 1 when 'commission_rate_pct' then 2 when 'median_reaction_time_ms' then 3 when 'rt_sd_ms' then 4 else 5 end`) : [];
        return { ...await sessionSummary(tx, s), publishedVersionId: c.version.id, configurationHash: c.config.configurationHash, configuration: c.config.configuration,
          declaredState: receipt?.producerState ?? null, terminationReason: receipt?.terminationReason ?? null,
          measuredDurationMs: receipt ? receipt.finishedAtMs - receipt.startedAtMs : null, device: receipt?.device ?? null, receipt: receipt ? receiptDto(receipt) : null,
          calculation: run ? { runId: run.id, ruleCode: c.rule.code, ruleVersion: c.rule.version, status: run.status, calculatedAt: run.finishedAt?.toISOString() ?? null, summary: run.summary,
            indicators: values.map(({ id: _, runId: __, value, ...v }) => ({ ...v, value: value === null ? null : Number(value) })) } : null };
      });
    },
    async evidence(actor: AcademicActor, id: string, kind: 'trials' | 'incidents', paging: Paging) {
      return withAcademicAccess(actor, async tx => {
        const { s } = await ownSession(tx, actor, id), filter = `evidence:${id}:${kind}`;
        const position = z.number().int().nonnegative().nullable().parse(cursorPosition(paging.cursor, filter)) ?? 0;
        const [run] = s.activeCalculationRunId ? await tx.select().from(calculationRuns).where(eq(calculationRuns.id, s.activeCalculationRunId)) : [];
        const decisions = (run?.evidenceDecisions ?? []) as { trial: number; included: boolean; rtIncluded: boolean; reason: string | null }[];
        if (kind === 'trials') {
          const rows = await tx.select().from(rawEvents).where(and(eq(rawEvents.sessionId, id), sql`${rawEvents.trial} > ${position}`)).orderBy(asc(rawEvents.trial)).limit(paging.limit + 1), page = rows.slice(0, paging.limit);
          return { items: page.map(({ id: _, sessionId: __, ...t }) => ({ ...t, calculationDecision: decisions.find(d => d.trial === t.trial) ?? null })), nextCursor: rows.length > paging.limit ? cursorFor(filter, page.at(-1)!.trial) : null };
        }
        const rows = await tx.select().from(sessionIncidents).where(and(eq(sessionIncidents.sessionId, id), sql`${sessionIncidents.sequence} > ${position}`)).orderBy(asc(sessionIncidents.sequence)).limit(paging.limit + 1), page = rows.slice(0, paging.limit);
        return { items: page.map(({ id: _, sessionId: __, ...i }) => i), nextCursor: rows.length > paging.limit ? cursorFor(filter, page.at(-1)!.sequence) : null };
      });
    },
    async retry(actor: AcademicActor, id: string, payload: unknown) {
      const input = requestInput.parse(payload);
      return withAcademicAccess(actor, async tx => {
        await ownSession(tx, actor, id);
        const op = await operation(tx, actor, input, 'PROCESSING_RETRY', id, {}, async () => {
          await tx.select().from(gameSessions).where(eq(gameSessions.id, id)).for('update');
          const [last] = await tx.select().from(calculationRuns).where(eq(calculationRuns.sessionId, id)).orderBy(desc(calculationRuns.runNumber)).limit(1);
          if (last?.status !== 'FAILED') throw conflict('PROCESSING_NOT_FAILED');
          const [run] = await tx.insert(calculationRuns).values({ sessionId: id, ruleVersionId: last.ruleVersionId, runNumber: last.runNumber + 1, evidenceHash: last.evidenceHash }).returning();
          await tx.update(gameSessions).set({ processingStatus: 'PENDING' }).where(eq(gameSessions.id, id)); return run!.id;
        });
        return { sessionId: id, runId: op.id, processingStatus: 'PENDING' as const };
      });
    },
  };
}
export type Paging = { limit: number; cursor?: string };
function datePosition(cursor: string | undefined, filter: string) {
  return z.strictObject({ at: z.iso.datetime(), id: uuid }).nullable().parse(cursorPosition(cursor, filter));
}
