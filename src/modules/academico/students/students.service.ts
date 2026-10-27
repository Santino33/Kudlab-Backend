import { and, eq, asc } from 'drizzle-orm';
import { groups, students } from '../../../db/schema/academic.js';
import { withAcademicAccess, type AcademicActor, type AcademicTransaction } from '../shared/academic-auth.js';
import { notFound, invalidInput } from '../shared/academic.errors.js';
import { academicScopeProvider } from '../shared/scope-provider.js';
import { authorizeScope } from '../../usuarios/shared/scope-authorization.js';
import { createGroupId, parseStudentCreate, parseStudentPatch, studentId } from './students.validation.js';

export function presentStudent(row: typeof students.$inferSelect) {
  return { id: row.id, groupId: row.groupId, studentCode: row.studentCode,
    firstName: row.firstName, lastName: row.lastName, isActive: row.isActive };
}
async function ownGroup(tx: AcademicTransaction, actor: AcademicActor, id: string, operation: 'read' | 'write' = 'write') {
  const [group] = await tx.select().from(groups).where(and(eq(groups.id, id), eq(groups.teacherId, actor.accountId))).for('share');
  if (!group) throw notFound();
  const decision = await authorizeScope({ id: actor.accountId, role: 'TEACHER', status: 'ACTIVA' },
    { operation, target: { kind: 'group', id } }, academicScopeProvider(tx));
  if (!decision.allowed) throw notFound();
  return group;
}
export async function createStudent(actor: AcademicActor, payload: unknown) {
  return withAcademicAccess(actor, async (tx) => {
    await ownGroup(tx, actor, createGroupId(payload));
    const input = parseStudentCreate(payload);
    const [created] = await tx.insert(students).values({ ...input, isActive: false }).returning();
    return presentStudent(created!);
  });
}

async function ownStudent(tx: AcademicTransaction, actor: AcademicActor, id: string, write = false) {
  studentId(id);
  const [visible] = await tx.select({ groupId: students.groupId }).from(students)
    .innerJoin(groups, eq(groups.id, students.groupId))
    .where(and(eq(students.id, id), eq(groups.teacherId, actor.accountId)));
  if (!visible) throw notFound();
  await ownGroup(tx, actor, visible.groupId, write ? 'write' : 'read');
  const query = tx.select().from(students).where(and(eq(students.id, id), eq(students.groupId, visible.groupId)));
  const [row] = await (write ? query.for('update') : query.for('share'));
  if (!row) throw notFound();
  const decision = await authorizeScope({ id: actor.accountId, role: 'TEACHER', status: 'ACTIVA' },
    { operation: write ? 'write' : 'read', target: { kind: 'student', id } }, academicScopeProvider(tx));
  if (!decision.allowed) throw notFound();
  return row;
}

export async function listStudents(actor: AcademicActor, groupId?: string) {
  return withAcademicAccess(actor, async (tx) => {
    if (groupId !== undefined) { studentId(groupId); await ownGroup(tx, actor, groupId, 'read'); }
    // Protect current responsibility until this read and its session acceptance complete.
    await tx.select({ id: groups.id }).from(groups).where(eq(groups.teacherId, actor.accountId)).for('share');
    const rows = await tx.select({ student: students }).from(students).innerJoin(groups, eq(students.groupId, groups.id))
      .where(and(eq(groups.teacherId, actor.accountId), groupId !== undefined ? eq(groups.id, groupId) : undefined)).orderBy(asc(students.id));
    return { items: rows.map(({ student }) => presentStudent(student)) };
  });
}

export async function getStudent(actor: AcademicActor, id: string) {
  return withAcademicAccess(actor, async (tx) => presentStudent(await ownStudent(tx, actor, id)));
}

export async function updateStudent(actor: AcademicActor, id: string, payload: () => Promise<unknown>) {
  return withAcademicAccess(actor, async (tx) => {
    const row = await ownStudent(tx, actor, id, true);
    const input = parseStudentPatch(await payload());
    const [updated] = await tx.update(students).set(input).where(eq(students.id, row.id)).returning();
    return presentStudent(updated!);
  });
}

export async function deactivateStudent(actor: AcademicActor, id: string, body: () => Promise<string>) {
  return withAcademicAccess(actor, async (tx) => {
    const row = await ownStudent(tx, actor, id, true);
    if ((await body()).length) throw invalidInput();
    const [updated] = await tx.update(students).set({ isActive: false }).where(eq(students.id, row.id)).returning();
    return presentStudent(updated!);
  });
}
