import { and, asc, eq, inArray } from 'drizzle-orm';
import { groups, students } from '../../../db/schema/academic.js';
import { academicNotes, academicNoteRevisions } from '../../../db/schema/academic-notes.js';
import { userAccounts } from '../../../db/schema/accounts.js';
import { withAcademicAccess, type AcademicActor, type AcademicTransaction } from '../shared/academic-auth.js';
import { notFound } from '../shared/academic.errors.js';
import { academicScopeProvider } from '../shared/scope-provider.js';
import { authorizeScope } from '../../usuarios/shared/scope-authorization.js';
import { noteConflict } from './notes.errors.js';
import { noteUuid, parseNoteCreate, parseNoteUpdate } from './notes.validation.js';

// Gancho de sincronización solo para el arnés de pruebas: nunca lo construye una ruta ni la composición normal.
export type NotesTestHooks = { afterGroupRead?: () => Promise<void>; afterAccess?: () => Promise<void> };

class GroupChanged extends Error {}
const MAX_ATTEMPTS = 2;

type Access = { student: typeof students.$inferSelect; group: typeof groups.$inferSelect };

// Protocolo PLAN-07: lectura sin bloqueo del curso del actor → curso FOR SHARE → estudiante FOR SHARE,
// con relectura de pertenencia. Los bloqueos se mantienen hasta el commit de la transacción.
async function lockedAccess(tx: AcademicTransaction, actor: AcademicActor, id: string, hooks?: NotesTestHooks): Promise<Access> {
  const [visible] = await tx.select({ groupId: students.groupId }).from(students)
    .innerJoin(groups, eq(groups.id, students.groupId))
    .where(and(eq(students.id, id), eq(groups.teacherId, actor.accountId)));
  if (!visible) throw notFound();
  await hooks?.afterGroupRead?.();
  const [group] = await tx.select().from(groups)
    .where(and(eq(groups.id, visible.groupId), eq(groups.teacherId, actor.accountId))).for('share');
  if (!group) throw new GroupChanged();
  const [student] = await tx.select().from(students).where(eq(students.id, id)).for('share');
  if (!student) throw notFound();
  if (student.groupId !== group.id) throw new GroupChanged();
  const decision = await authorizeScope({ id: actor.accountId, role: 'TEACHER', status: 'ACTIVA' },
    { operation: 'read', target: { kind: 'student', id } }, academicScopeProvider(tx));
  if (!decision.allowed) throw notFound();
  return { student, group };
}

// Dos intentos como máximo si el curso cambió entre la lectura y el bloqueo; si persiste, 404 neutro.
// Los errores de bloqueo (55P03) no se reintentan: academicFail los responde 503.
async function withNotesAccess<T>(actor: AcademicActor, id: string, hooks: NotesTestHooks | undefined,
  operation: (tx: AcademicTransaction, access: Access) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await withAcademicAccess(actor, async (tx) => {
        const access = await lockedAccess(tx, actor, id, hooks);
        await hooks?.afterAccess?.();
        return operation(tx, access);
      });
    } catch (error) {
      if (error instanceof GroupChanged) { if (attempt >= MAX_ATTEMPTS) throw notFound(); continue; }
      throw error;
    }
  }
}

type NoteRow = typeof academicNotes.$inferSelect;

async function present(tx: AcademicTransaction, rows: NoteRow[]) {
  if (!rows.length) return [];
  const revisions = await tx.select().from(academicNoteRevisions)
    .where(inArray(academicNoteRevisions.noteId, rows.map((row) => row.id))).orderBy(asc(academicNoteRevisions.version));
  const authorIds = [...new Set([...rows.map((row) => row.authorId), ...revisions.map((rev) => rev.authorId)])];
  const names = new Map((await tx.select({ id: userAccounts.id, name: userAccounts.fullName }).from(userAccounts)
    .where(inArray(userAccounts.id, authorIds))).map((row) => [row.id, row.name]));
  return rows.map((row) => ({
    id: row.id, subject: row.subject, term: row.term, score: row.score, version: row.version,
    authorName: names.get(row.authorId) ?? '', updatedAt: row.updatedAt.toISOString(),
    revisions: revisions.filter((rev) => rev.noteId === row.id).map((rev) => ({
      version: rev.version, score: rev.score, authorName: names.get(rev.authorId) ?? '', recordedAt: rev.recordedAt.toISOString() })),
  }));
}

async function currentYearNotes(tx: AcademicTransaction, studentId: string, schoolYear: number) {
  return tx.select().from(academicNotes)
    .where(and(eq(academicNotes.studentId, studentId), eq(academicNotes.schoolYear, schoolYear)))
    .orderBy(asc(academicNotes.subject), asc(academicNotes.term));
}

function isSlotViolation(error: unknown) {
  const cause = error instanceof Error && 'cause' in error ? error.cause : error;
  return !!cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505' &&
    'constraint' in cause && cause.constraint === 'academic_notes_slot_unique';
}

export async function listNotes(actor: AcademicActor, studentId: string, hooks?: NotesTestHooks) {
  noteUuid(studentId);
  return withNotesAccess(actor, studentId, hooks, async (tx, { group }) =>
    ({ schoolYear: group.schoolYear, items: await present(tx, await currentYearNotes(tx, studentId, group.schoolYear)) }));
}

export async function createNote(actor: AcademicActor, studentId: string, payload: () => Promise<unknown>, hooks?: NotesTestHooks) {
  noteUuid(studentId);
  try {
    return await withNotesAccess(actor, studentId, hooks, async (tx, { student, group }) => {
      const input = parseNoteCreate(await payload());
      if (!student.isActive) throw noteConflict('student', 'inactive');
      const [existing] = await tx.select({ id: academicNotes.id }).from(academicNotes).where(and(
        eq(academicNotes.studentId, studentId), eq(academicNotes.subject, input.subject),
        eq(academicNotes.schoolYear, group.schoolYear), eq(academicNotes.term, input.term)));
      if (existing) throw noteConflict('note', 'already_exists');
      const [created] = await tx.insert(academicNotes).values({
        studentId, subject: input.subject, schoolYear: group.schoolYear, term: input.term,
        score: input.score, authorId: actor.accountId }).returning();
      await tx.insert(academicNoteRevisions).values({
        noteId: created!.id, version: 1, score: input.score, authorId: actor.accountId });
      return (await present(tx, [created!]))[0]!;
    });
  } catch (error) {
    // Doble envío simultáneo: la segunda inserción espera al commit y falla por la unicidad (D-04).
    if (isSlotViolation(error)) throw noteConflict('note', 'already_exists');
    throw error;
  }
}

export async function updateNote(actor: AcademicActor, studentId: string, noteId: string,
  payload: () => Promise<unknown>, hooks?: NotesTestHooks) {
  noteUuid(studentId); noteUuid(noteId);
  return withNotesAccess(actor, studentId, hooks, async (tx, { student, group }) => {
    // Solo una nota de este estudiante y del año del curso actual; otra cosa responde 404 neutro.
    const [note] = await tx.select().from(academicNotes).where(and(
      eq(academicNotes.id, noteId), eq(academicNotes.studentId, studentId), eq(academicNotes.schoolYear, group.schoolYear))).for('update');
    if (!note) throw notFound();
    const input = parseNoteUpdate(await payload());
    if (!student.isActive) throw noteConflict('student', 'inactive');
    // Mismo valor: respuesta idempotente sin nueva revisión (reintento tras respuesta perdida).
    if (note.score === input.score) return (await present(tx, [note]))[0]!;
    if (note.version !== input.expectedVersion) throw noteConflict('version', 'stale');
    const version = note.version + 1;
    const [updated] = await tx.update(academicNotes)
      .set({ score: input.score, version, authorId: actor.accountId, updatedAt: new Date() })
      .where(eq(academicNotes.id, note.id)).returning();
    await tx.insert(academicNoteRevisions).values({ noteId: note.id, version, score: input.score, authorId: actor.accountId });
    return (await present(tx, [updated!]))[0]!;
  });
}
