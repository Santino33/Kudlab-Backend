import { createHash } from 'node:crypto';
import { and, asc, desc, eq, gt, gte, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { students, groups } from '../../../db/schema/academic.js';
import { userAccounts } from '../../../db/schema/accounts.js';
import { teacherObservations as observations, teacherObservationRevisions as revisions } from '../../../db/schema/observations.js';
import { withAcademicAccess, type AcademicActor, type AcademicTransaction } from '../../academico/shared/academic-auth.js';
import { notFound } from '../../academico/shared/academic.errors.js';
import { academicScopeProvider } from '../../academico/shared/scope-provider.js';
import { authorizeScope } from '../../usuarios/shared/scope-authorization.js';
import { readConsentDecision } from '../../academico/consents/consent-decision.js';
import { observationConflict, observationInvalid, observationUnavailable } from './observations.errors.js';
import { observationFingerprint, parseObservation, validateObservedOn, type CorrectionInput, type ObservationInput, type ObservationQuery } from './observations.validation.js';

type Revision = typeof revisions.$inferSelect;
type Identity = typeof observations.$inferSelect;
function uuid(value: string) { if (!z.uuid().safeParse(value).success) throw notFound(); return value.toLowerCase(); }
async function ownStudent(tx: AcademicTransaction, actor: AcademicActor, id: string, write = false, groupId?: string) {
  uuid(id);
  const [visible] = await tx.select({ groupId: students.groupId }).from(students).innerJoin(groups, eq(groups.id, students.groupId))
    .where(and(eq(students.id, id), eq(groups.teacherId, actor.accountId)));
  if (!visible || groupId !== undefined && visible.groupId !== groupId) throw notFound();
  const [group] = await tx.select().from(groups).where(and(eq(groups.id, visible.groupId), eq(groups.teacherId, actor.accountId))).for('share');
  if (!group) throw notFound();
  const query = tx.select().from(students).where(and(eq(students.id, id), eq(students.groupId, group.id)));
  const [student] = await (write ? query.for('update') : query.for('share'));
  if (!student) throw notFound();
  const decision = await authorizeScope({ id: actor.accountId, role: 'TEACHER', status: 'ACTIVA' },
    { operation: write ? 'write' : 'read', target: { kind: 'student', id } }, academicScopeProvider(tx));
  if (!decision.allowed) throw notFound();
  return student;
}
async function ownObservation(tx: AcademicTransaction, studentId: string, id: string, write = false) {
  uuid(id);
  const query = tx.select().from(observations).where(and(eq(observations.id, id), eq(observations.studentId, studentId)));
  const [row] = await (write ? query.for('update') : query.for('share'));
  if (!row) throw notFound();
  return row;
}
function revisionDto(row: Revision) {
  return { id: row.id, version: row.version, behavior: row.behavior, frequency: row.frequency, area: row.area,
    observedOn: row.observedOn, schoolYear: row.schoolYear, term: row.term, actorId: row.actorId, recordedAt: row.recordedAt.toISOString() };
}
function receipt(studentId: string, row: Revision) {
  return { requestId: row.requestId, studentId, observationId: row.observationId, fingerprint: row.fingerprint, revision: revisionDto(row) };
}
async function priorRevision(tx: AcademicTransaction, actor: AcademicActor, requestId: string) {
  const [row] = await tx.select().from(revisions).where(and(eq(revisions.actorId, actor.accountId), eq(revisions.requestId, requestId)));
  return row;
}
async function requireEligible(tx: AcademicTransaction, student: typeof students.$inferSelect, at: Date) {
  if (!student.isActive) throw observationConflict('STUDENT_INACTIVE');
  const decision = await readConsentDecision(tx, student.id, at);
  if (decision.kind !== 'available' || !Number.isInteger(decision.version) || decision.version < 0) throw observationUnavailable();
  if (decision.state === 'NONE') {
    if (decision.version !== 0) throw observationUnavailable();
    throw observationConflict('CONSENT_REQUIRED');
  }
  if (decision.state === 'REVOKED') {
    if (decision.version < 1) throw observationUnavailable();
    throw observationConflict('CONSENT_REQUIRED');
  }
  if (decision.state !== 'CURRENT' || decision.version < 1 || decision.validUntil !== null ||
    typeof decision.authorizationReference !== 'string' || !decision.authorizationReference) throw observationUnavailable();
}
export function createObservation(actor: AcademicActor, studentId: string, body: unknown) {
  return writeObservation(actor, studentId, parseObservation(body));
}
export function correctObservation(actor: AcademicActor, studentId: string, observationId: string, body: unknown) {
  return writeObservation(actor, studentId, parseObservation(body, true) as CorrectionInput, uuid(observationId));
}
async function writeObservation(actor: AcademicActor, studentId: string, input: ObservationInput | CorrectionInput, observationId?: string) {
  studentId = uuid(studentId);
  const fingerprint = observationFingerprint(studentId, input, observationId);
  return withAcademicAccess(actor, async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${actor.accountId}:${input.requestId}`}, 0))`);
    const student = await ownStudent(tx, actor, studentId, true, input.groupId);
    const original = observationId ? await ownObservation(tx, studentId, observationId, true) : undefined;
    const prior = await priorRevision(tx, actor, input.requestId);
    if (prior) {
      if (prior.fingerprint !== fingerprint) throw observationConflict('REQUEST_MISMATCH');
      return { receipt: receipt(studentId, prior), repeated: true };
    }
    // All permission/time decisions use fresh server time after locks, never transaction-start now().
    const acceptedAt = new Date();
    validateObservedOn(input.observedOn, acceptedAt);
    await requireEligible(tx, student, acceptedAt);
    if (original) {
      if (original.authorId !== actor.accountId) throw observationConflict('AUTHOR_REQUIRED');
      if (acceptedAt.getTime() >= original.createdAt.getTime() + 86400000) throw observationConflict('CORRECTION_CLOSED');
      if (!('expectedVersion' in input) || original.version !== input.expectedVersion) throw observationConflict('STALE_VERSION');
    }
    const identity = original ?? (await tx.insert(observations).values({ studentId, authorId: actor.accountId, createdAt: acceptedAt }).returning())[0]!;
    const version = original ? original.version + 1 : 1;
    const [revision] = await tx.insert(revisions).values({ observationId: identity.id, version, actorId: actor.accountId,
      recordedAt: acceptedAt, requestId: input.requestId, fingerprint, behavior: input.behavior, frequency: input.frequency,
      area: input.area, observedOn: input.observedOn, schoolYear: input.schoolYear, term: input.term }).returning();
    if (original) await tx.update(observations).set({ version }).where(eq(observations.id, identity.id));
    return { receipt: receipt(studentId, revision!), repeated: false };
  });
}
export function getObservationReceipt(actor: AcademicActor, studentId: string, requestId: string) {
  studentId = uuid(studentId); requestId = uuid(requestId);
  return withAcademicAccess(actor, async tx => {
    await ownStudent(tx, actor, studentId);
    const row = await priorRevision(tx, actor, requestId);
    if (!row) return { receipt: null };
    const [identity] = await tx.select().from(observations).where(and(eq(observations.id, row.observationId), eq(observations.studentId, studentId)));
    return { receipt: identity ? receipt(studentId, row) : null };
  });
}
function encodeCursor(value: unknown) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function decodeCursor<T extends z.ZodType>(value: string, schema: T): z.infer<T> {
  try {
    if (!/^[\w-]{1,2048}$/.test(value)) throw new Error();
    return schema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')));
  } catch { throw observationInvalid([{ field: 'cursor', reason: 'invalid_format' }]); }
}
const historyCursor = z.strictObject({ kind: z.literal('history'), studentId: z.uuid(), filters: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: z.iso.datetime(), id: z.uuid() });
const revisionCursor = z.strictObject({ kind: z.literal('revisions'), studentId: z.uuid(), observationId: z.uuid(),
  after: z.number().int().positive(), ceiling: z.number().int().positive() });
function identityDto(row: Identity, name: string) {
  return { id: row.id, studentId: row.studentId, author: { id: row.authorId, name }, createdAt: row.createdAt.toISOString(), version: row.version };
}
export function getObservationHistory(actor: AcademicActor, studentId: string, query: ObservationQuery) {
  studentId = uuid(studentId);
  const { schoolYear, term, behavior, area, observedFrom, observedTo } = query;
  const filters = createHash('sha256').update(JSON.stringify([schoolYear ?? null, term ?? null, behavior ?? null, area ?? null,
    observedFrom ?? null, observedTo ?? null])).digest('hex');
  const page = query.cursor ? decodeCursor(query.cursor, historyCursor) : undefined;
  if (page && (page.studentId !== studentId || page.filters !== filters)) throw observationInvalid([{ field: 'cursor', reason: 'invalid_format' }]);
  return withAcademicAccess(actor, async tx => {
    await ownStudent(tx, actor, studentId);
    const limit = query.limit ?? 25;
    const rows = await tx.select({ identity: observations, revision: revisions, authorName: userAccounts.fullName }).from(observations)
      .innerJoin(revisions, and(eq(revisions.observationId, observations.id), eq(revisions.version, observations.version)))
      .innerJoin(userAccounts, eq(userAccounts.id, observations.authorId))
      .where(and(eq(observations.studentId, studentId),
        schoolYear !== undefined ? eq(revisions.schoolYear, schoolYear) : undefined,
        term !== undefined ? eq(revisions.term, term) : undefined, behavior ? eq(revisions.behavior, behavior) : undefined,
        area === 'UNSPECIFIED' ? isNull(revisions.area) : area ? eq(revisions.area, area) : undefined,
        observedFrom ? gte(revisions.observedOn, observedFrom) : undefined, observedTo ? lte(revisions.observedOn, observedTo) : undefined,
        page ? or(lt(observations.createdAt, new Date(page.createdAt)), and(eq(observations.createdAt, new Date(page.createdAt)), lt(observations.id, page.id))) : undefined))
      .orderBy(desc(observations.createdAt), desc(observations.id)).limit(limit + 1);
    const items = rows.slice(0, limit).map(row => ({ ...identityDto(row.identity, row.authorName), revision: revisionDto(row.revision) }));
    const last = items.at(-1);
    return { items, nextCursor: rows.length > limit && last ? encodeCursor({ kind: 'history', studentId, filters, createdAt: last.createdAt, id: last.id }) : null };
  });
}
export function getObservationRevisions(actor: AcademicActor, studentId: string, observationId: string, query: ObservationQuery) {
  studentId = uuid(studentId); observationId = uuid(observationId);
  const page = query.cursor ? decodeCursor(query.cursor, revisionCursor) : undefined;
  if (page && (page.studentId !== studentId || page.observationId !== observationId || page.after > page.ceiling))
    throw observationInvalid([{ field: 'cursor', reason: 'invalid_format' }]);
  return withAcademicAccess(actor, async tx => {
    await ownStudent(tx, actor, studentId);
    const identity = await ownObservation(tx, studentId, observationId);
    if (page && page.ceiling > identity.version) throw observationInvalid([{ field: 'cursor', reason: 'invalid_format' }]);
    const [author] = await tx.select({ name: userAccounts.fullName }).from(userAccounts).where(eq(userAccounts.id, identity.authorId));
    if (!author) throw observationUnavailable();
    const limit = query.limit ?? 25, ceiling = page?.ceiling ?? identity.version;
    const rows = await tx.select().from(revisions).where(and(eq(revisions.observationId, identity.id),
      lte(revisions.version, ceiling), page ? gt(revisions.version, page.after) : undefined)).orderBy(asc(revisions.version)).limit(limit + 1);
    const items = rows.slice(0, limit).map(revisionDto);
    return { observation: identityDto(identity, author.name), items, nextCursor: rows.length > limit ?
      encodeCursor({ kind: 'revisions', studentId, observationId, after: items.at(-1)!.version, ceiling }) : null };
  });
}
