import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { groups, students } from '../../../db/schema/academic.js';
import { teacherAnnotations } from '../../../db/schema/annotations.js';
import { userAccounts } from '../../../db/schema/accounts.js';
import { withAcademicAccess, type AcademicActor, type AcademicTransaction } from '../../academico/shared/academic-auth.js';
import { notFound } from '../../academico/shared/academic.errors.js';
import { academicScopeProvider } from '../../academico/shared/scope-provider.js';
import { authorizeScope } from '../../usuarios/shared/scope-authorization.js';
import { annotationConflict } from './annotations.errors.js';
import { annotationUuid, encodeAnnotationCursor, parseAnnotationCreate, parseAnnotationQuery, parseAnnotationUpdate } from './annotations.validation.js';

// Internal test barriers only; never supplied by HTTP routes.
export type AnnotationTestHooks = { afterGroupRead?: () => Promise<void>; afterAccess?: () => Promise<void> };

async function lockedStudent(tx: AcademicTransaction, actor: AcademicActor, id: string, write: boolean, hooks?: AnnotationTestHooks) {
  const [visible] = await tx.select({ groupId: students.groupId }).from(students)
    .innerJoin(groups, eq(groups.id, students.groupId))
    .where(and(eq(students.id, id), eq(groups.teacherId, actor.accountId)));
  if (!visible) throw notFound();
  await hooks?.afterGroupRead?.();
  const [group] = await tx.select().from(groups)
    .where(and(eq(groups.id, visible.groupId), eq(groups.teacherId, actor.accountId))).for('share');
  if (!group) throw notFound();
  const [student] = await tx.select().from(students).where(eq(students.id, id)).for(write ? 'update' : 'share');
  if (!student || student.groupId !== group.id) throw notFound();
  const decision = await authorizeScope({ id: actor.accountId, role: 'TEACHER', status: 'ACTIVA' },
    { operation: 'read', target: { kind: 'student', id } }, academicScopeProvider(tx));
  if (!decision.allowed) throw notFound();
  await hooks?.afterAccess?.();
  return student;
}

type Row = typeof teacherAnnotations.$inferSelect;
async function present(tx: AcademicTransaction, row: Row, actor: AcademicActor, active: boolean) {
  const [author] = await tx.select({ id: userAccounts.id, name: userAccounts.fullName }).from(userAccounts)
    .where(eq(userAccounts.id, row.authorAccountId));
  if (!author) throw notFound();
  return { id: row.id, studentId: row.studentId, text: row.text, author,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt?.toISOString() ?? null,
    canEdit: active && row.authorAccountId === actor.accountId, canDelete: active && row.authorAccountId === actor.accountId };
}

export async function listStudentAnnotations(actor: AcademicActor, url: string, hooks?: AnnotationTestHooks) {
  const { studentId, limit, cursor } = parseAnnotationQuery(url);
  return withAcademicAccess(actor, async tx => {
    const student = await lockedStudent(tx, actor, studentId, false, hooks);
    // Preserve PostgreSQL microseconds in the opaque cursor; Date/DTO milliseconds would skip tied rows.
    const rows = await tx.select({ row: teacherAnnotations,
      cursorAt: sql<string>`to_char(${teacherAnnotations.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    }).from(teacherAnnotations).where(and(eq(teacherAnnotations.studentId, studentId),
      cursor ? or(sql`${teacherAnnotations.createdAt} < ${cursor.createdAt}::timestamptz`,
        and(sql`${teacherAnnotations.createdAt} = ${cursor.createdAt}::timestamptz`, lt(teacherAnnotations.id, cursor.id))) : undefined))
      .orderBy(desc(teacherAnnotations.createdAt), desc(teacherAnnotations.id)).limit(limit + 1);
    const page = rows.slice(0, limit), last = page.at(-1);
    return { studentId, isActive: student.isActive, canCreate: student.isActive,
      items: await Promise.all(page.map(({ row }) => present(tx, row, actor, student.isActive))),
      nextCursor: rows.length > limit && last ? encodeAnnotationCursor({ studentId, id: last.row.id, createdAt: last.cursorAt }) : null };
  });
}

export async function createStudentAnnotation(actor: AcademicActor, payload: unknown, hooks?: AnnotationTestHooks) {
  const input = parseAnnotationCreate(payload);
  return withAcademicAccess(actor, async tx => {
    const student = await lockedStudent(tx, actor, input.studentId, true, hooks);
    if (!student.isActive) throw annotationConflict('STUDENT_INACTIVE');
    const [created] = await tx.insert(teacherAnnotations).values({ ...input, authorAccountId: actor.accountId }).returning();
    return present(tx, created!, actor, true);
  });
}

async function changeAnnotation(actor: AcademicActor, id: string, text: string | undefined, hooks?: AnnotationTestHooks) {
  annotationUuid(id);
  return withAcademicAccess(actor, async tx => {
    const [visible] = await tx.select({ studentId: teacherAnnotations.studentId }).from(teacherAnnotations).where(eq(teacherAnnotations.id, id));
    if (!visible) throw notFound();
    const student = await lockedStudent(tx, actor, visible.studentId, true, hooks);
    const [row] = await tx.select().from(teacherAnnotations)
      .where(and(eq(teacherAnnotations.id, id), eq(teacherAnnotations.studentId, student.id))).for('update');
    if (!row) throw notFound();
    if (!student.isActive) throw annotationConflict('STUDENT_INACTIVE');
    if (row.authorAccountId !== actor.accountId) throw annotationConflict('NOT_AUTHOR');
    if (text === undefined) {
      await tx.delete(teacherAnnotations).where(eq(teacherAnnotations.id, id));
      return { id, studentId: student.id, deleted: true as const };
    }
    const [updated] = await tx.update(teacherAnnotations).set({ text, updatedAt: new Date() }).where(eq(teacherAnnotations.id, id)).returning();
    return present(tx, updated!, actor, true);
  });
}

export function updateStudentAnnotation(actor: AcademicActor, id: string, payload: unknown, hooks?: AnnotationTestHooks) {
  return changeAnnotation(actor, id, parseAnnotationUpdate(payload).text, hooks);
}
export function deleteStudentAnnotation(actor: AcademicActor, id: string, hooks?: AnnotationTestHooks) {
  return changeAnnotation(actor, id, undefined, hooks);
}
