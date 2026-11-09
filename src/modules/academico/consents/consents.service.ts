import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq, lt, lte } from 'drizzle-orm';
import { z } from 'zod';
import { students, groups } from '../../../db/schema/academic.js';
import { userAccounts } from '../../../db/schema/accounts.js';
import { consentRecords, consentEvents, consentOperations } from '../../../db/schema/consents.js';
import { withAcademicAccess, type AcademicActor, type AcademicTransaction } from '../shared/academic-auth.js';
import { notFound } from '../shared/academic.errors.js';
import { academicScopeProvider } from '../shared/scope-provider.js';
import { authorizeScope } from '../../usuarios/shared/scope-authorization.js';
import { presentStudent } from '../students/students.service.js';
import { ConsentInputError, readConsentForm } from './consents.validation.js';
import { createConsentStorage, describeConsentEvidence, type ConsentEvidence } from './consent-storage.js';
import { validateConsentFile } from './consent-validator.js';
import { ConsentError, consentConflict, consentUnavailable } from './consents.errors.js';

type Operation = typeof consentOperations.$inferSelect;
type RecordRow = typeof consentRecords.$inferSelect;
export type ConsentDependencies = {
  storage: Pick<ReturnType<typeof createConsentStorage>, 'putImmutable' | 'readVerified'>;
  validate: (file: File, signal?: AbortSignal) => ReturnType<typeof validateConsentFile>;
};
export function consentDependencies(): ConsentDependencies {
  return { storage: createConsentStorage(), validate: (file, signal) =>
    validateConsentFile(file, process.env.CONSENT_VALIDATOR_SOCKET ?? '/socket/validator.sock', signal) };
}
function uuid(value: string) { if (!z.uuid().safeParse(value).success) throw notFound(); return value; }
async function ownStudent(tx: AcademicTransaction, actor: AcademicActor, id: string, write = false) {
  uuid(id);
  const [visible] = await tx.select({ groupId: students.groupId }).from(students).innerJoin(groups, eq(groups.id, students.groupId))
    .where(and(eq(students.id, id), eq(groups.teacherId, actor.accountId)));
  if (!visible) throw notFound();
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
function recordDto(row: RecordRow) {
  return { id: row.id, signedOn: row.signedOn, receivedOn: row.receivedOn, mediaType: row.mediaType,
    byteSize: row.byteSize, sha256: row.sha256 };
}
async function latest(tx: AcademicTransaction, studentId: string) {
  const [event] = await tx.select().from(consentEvents).where(eq(consentEvents.studentId, studentId)).orderBy(desc(consentEvents.version)).limit(1);
  return event;
}
async function snapshot(tx: AcademicTransaction, student: typeof students.$inferSelect) {
  const event = await latest(tx, student.id);
  const [record] = event ? await tx.select().from(consentRecords)
    .where(and(eq(consentRecords.id, event.recordId), eq(consentRecords.studentId, student.id))) : [];
  if (event && !record) throw consentUnavailable();
  return { student: presentStudent(student), consent: { state: !event ? 'NONE' as const : event.type === 'REVOKE' ? 'REVOKED' as const : 'CURRENT' as const,
    version: event?.version ?? 0, currentRecord: record ? recordDto(record) : null }, evaluatedAt: new Date().toISOString() };
}
async function acknowledgement(tx: AcademicTransaction, operation: Operation, repeated: boolean) {
  const [event] = operation.eventId ? await tx.select().from(consentEvents)
    .where(and(eq(consentEvents.id, operation.eventId), eq(consentEvents.studentId, operation.studentId))) : [];
  if (!event || event.recordId !== operation.recordId || event.actorId !== operation.actorId) throw consentUnavailable();
  return { requestId: operation.requestId, eventId: event.id, recordId: event.recordId,
    version: event.version, confirmedAt: event.occurredAt.toISOString(), repeated };
}
function operationEvidence(operation: Operation): ConsentEvidence {
  if (!operation.objectKey || !operation.mediaType || !operation.byteSize || !operation.sha256 ||
    !['application/pdf', 'image/jpeg', 'image/png'].includes(operation.mediaType)) throw consentUnavailable();
  return { objectKey: operation.objectKey, mediaType: operation.mediaType as ConsentEvidence['mediaType'], byteSize: operation.byteSize, sha256: operation.sha256 };
}
export function getConsentSnapshot(actor: AcademicActor, studentId: string) {
  return withAcademicAccess(actor, async tx => snapshot(tx, await ownStudent(tx, actor, studentId)));
}
export async function registerConsent(actor: AcademicActor, studentId: string, request: Request, dependencies: ConsentDependencies) {
  // Authorize before receiving any document; no database locks are held during validation or storage.
  await withAcademicAccess(actor, tx => ownStudent(tx, actor, studentId, true));
  const { file, metadata } = await readConsentForm(request, new Date());
  const validation = await dependencies.validate(file, request.signal);
  if (validation.kind === 'unavailable') throw consentUnavailable();
  if (validation.kind !== 'valid') throw new ConsentInputError([{ field: 'file', reason: 'invalid_format' }]);
  const bytes = Buffer.from(await file.arrayBuffer());
  const recordId = randomUUID(), evidence = describeConsentEvidence(recordId, bytes, validation.mediaType);
  const fingerprint = createHash('sha256').update(JSON.stringify([studentId, 'REGISTER', metadata.expectedVersion,
    metadata.signedOn, metadata.receivedOn, evidence.mediaType, evidence.byteSize, evidence.sha256])).digest('hex');
  const operation = await withAcademicAccess(actor, async tx => {
    await ownStudent(tx, actor, studentId, true);
    const [prior] = await tx.select().from(consentOperations)
      .where(and(eq(consentOperations.actorId, actor.accountId), eq(consentOperations.requestId, metadata.requestId))).for('update');
    if (prior) {
      if (prior.studentId !== studentId || prior.fingerprint !== fingerprint || prior.action !== 'REGISTER') throw consentConflict('REQUEST_REUSED');
      return prior;
    }
    if (((await latest(tx, studentId))?.version ?? 0) !== metadata.expectedVersion) throw consentConflict('STALE_VERSION');
    const [created] = await tx.insert(consentOperations).values({ actorId: actor.accountId, studentId, requestId: metadata.requestId,
      action: 'REGISTER', expectedVersion: metadata.expectedVersion, fingerprint, recordId,
      signedOn: metadata.signedOn, receivedOn: metadata.receivedOn, ...evidence })
      .onConflictDoNothing({ target: [consentOperations.actorId, consentOperations.requestId] }).returning();
    if (created) return created;
    const [concurrent] = await tx.select().from(consentOperations)
      .where(and(eq(consentOperations.actorId, actor.accountId), eq(consentOperations.requestId, metadata.requestId))).for('update');
    if (!concurrent || concurrent.studentId !== studentId || concurrent.fingerprint !== fingerprint || concurrent.action !== 'REGISTER')
      throw consentConflict('REQUEST_REUSED');
    return concurrent;
  });
  if (operation.status === 'REJECTED') throw consentConflict('STALE_VERSION');
  if (operation.status === 'PENDING') await dependencies.storage.putImmutable(operationEvidence(operation), bytes, request.signal);
  const result = await withAcademicAccess(actor, async tx => {
    let student = await ownStudent(tx, actor, studentId, true);
    const [current] = await tx.select().from(consentOperations).where(eq(consentOperations.id, operation.id)).for('update');
    if (!current || current.fingerprint !== fingerprint) throw consentUnavailable();
    if (current.status === 'COMMITTED') return { acknowledgement: await acknowledgement(tx, current, true), snapshot: await snapshot(tx, student) };
    if (current.status !== 'PENDING') return null;
    const previous = await latest(tx, studentId);
    if ((previous?.version ?? 0) !== current.expectedVersion) {
      await tx.update(consentOperations).set({ status: 'REJECTED', rejectionCode: 'STALE_VERSION' }).where(eq(consentOperations.id, current.id));
      return null;
    }
    const [author] = await tx.select({ name: userAccounts.fullName }).from(userAccounts).where(eq(userAccounts.id, actor.accountId));
    if (!author || !current.signedOn || !current.receivedOn) throw consentUnavailable();
    await tx.insert(consentRecords).values({ id: current.recordId, studentId,
      signedOn: current.signedOn, receivedOn: current.receivedOn, ...operationEvidence(current) });
    const [event] = await tx.insert(consentEvents).values({ studentId, recordId: current.recordId, version: current.expectedVersion + 1,
      type: previous ? 'REPLACE' : 'REGISTER', previousRecordId: previous?.recordId ?? null, actorId: actor.accountId, actorName: author.name }).returning();
    [student] = await tx.update(students).set({ isActive: true }).where(eq(students.id, studentId)).returning() as [typeof students.$inferSelect];
    const [committed] = await tx.update(consentOperations).set({ status: 'COMMITTED', eventId: event!.id }).where(eq(consentOperations.id, current.id)).returning();
    return { acknowledgement: await acknowledgement(tx, committed!, false), snapshot: await snapshot(tx, student) };
  });
  if (!result) throw consentConflict('STALE_VERSION');
  return result;
}
export function getConsentOperation(actor: AcademicActor, studentId: string, requestId: string) {
  uuid(requestId);
  return withAcademicAccess(actor, async tx => {
    await ownStudent(tx, actor, studentId);
    const [operation] = await tx.select().from(consentOperations).where(and(eq(consentOperations.studentId, studentId),
      eq(consentOperations.actorId, actor.accountId), eq(consentOperations.requestId, requestId)));
    if (!operation) throw notFound();
    return { requestId, status: operation.status, acknowledgement: operation.status === 'COMMITTED' ? await acknowledgement(tx, operation, true) : null,
      attempt: { expectedVersion: operation.expectedVersion, signedOn: operation.signedOn, receivedOn: operation.receivedOn,
        mediaType: operation.mediaType, byteSize: operation.byteSize, sha256: operation.sha256 }, rejectionCode: operation.rejectionCode };
  });
}
const cursorSchema = z.strictObject({ studentId: z.uuid(), ceiling: z.number().int().positive(), before: z.number().int().positive() });
export function getConsentHistory(actor: AcademicActor, studentId: string, cursor?: string) {
  let page: z.infer<typeof cursorSchema> | undefined;
  if (cursor !== undefined) {
    try {
      if (!/^[\w-]{1,512}$/.test(cursor)) throw new Error();
      page = cursorSchema.parse(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')));
      if (page.studentId !== studentId || page.before > page.ceiling) throw new Error();
    } catch { throw new ConsentError(400, 'INVALID_INPUT'); }
  }
  return withAcademicAccess(actor, async tx => {
    await ownStudent(tx, actor, studentId);
    const version = (await latest(tx, studentId))?.version ?? 0;
    if (page && page.ceiling > version) throw new ConsentError(400, 'INVALID_INPUT');
    const ceiling = page?.ceiling ?? version;
    const rows = await tx.select({ event: consentEvents, record: consentRecords }).from(consentEvents)
      .innerJoin(consentRecords, and(eq(consentRecords.id, consentEvents.recordId), eq(consentRecords.studentId, consentEvents.studentId)))
      .where(and(eq(consentEvents.studentId, studentId), lte(consentEvents.version, ceiling), page ? lt(consentEvents.version, page.before) : undefined))
      .orderBy(desc(consentEvents.version)).limit(26);
    const items = rows.slice(0, 25).map(({ event, record }) => ({ id: event.id, type: event.type, version: event.version,
      record: recordDto(record), previousRecordId: event.previousRecordId, author: { id: event.actorId, name: event.actorName },
      occurredAt: event.occurredAt.toISOString(), reason: event.reason }));
    return { items, nextCursor: rows.length > 25 ? Buffer.from(JSON.stringify({ studentId, ceiling, before: items.at(-1)!.version })).toString('base64url') : null };
  });
}
export async function getConsentDocument(actor: AcademicActor, studentId: string, recordId: string, dependencies: ConsentDependencies, signal?: AbortSignal) {
  uuid(recordId);
  const record = await withAcademicAccess(actor, async tx => {
    await ownStudent(tx, actor, studentId);
    const [row] = await tx.select().from(consentRecords).where(and(eq(consentRecords.studentId, studentId), eq(consentRecords.id, recordId)));
    if (!row) throw notFound();
    return row;
  });
  let bytes: Buffer;
  try { bytes = await dependencies.storage.readVerified({ objectKey: record.objectKey, sha256: record.sha256,
    byteSize: record.byteSize, mediaType: record.mediaType as ConsentEvidence['mediaType'] }, signal); }
  catch { throw consentUnavailable(); }
  await withAcademicAccess(actor, tx => ownStudent(tx, actor, studentId));
  return { bytes, mediaType: record.mediaType, recordId };
}
