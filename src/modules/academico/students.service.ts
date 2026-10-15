import { and, asc, count, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { groups, students } from '../../db/schema/academic.js';
import { userAccounts } from '../../db/schema/accounts.js';
import { user } from '../../db/schema/auth.js';
import { hasActiveIdentity } from '../usuarios/accounts.types.js';
import { AccountError } from '../usuarios/accounts.errors.js';

const forbidden = () => new AccountError(403, 'FORBIDDEN', 'Acceso denegado');
const projection = { id: students.id, groupId: students.groupId,
  firstName: students.firstName, lastName: students.lastName };

export async function readStudent(accountId: string, id: string) {
  // The join also constrains the read itself, not only the prior authorization
  // check. A group reassignment cannot turn an unscoped select into disclosure.
  const [result] = await db.select(projection).from(students)
    .innerJoin(groups, eq(students.groupId, groups.id))
    .where(and(eq(students.id, id), eq(groups.teacherAccountId, accountId))).limit(1);
  if (!result) throw forbidden();
  return result;
}

export async function renameStudent(accountId: string, id: string, names: { firstName?: string; lastName?: string }) {
  return db.transaction(async (tx) => {
    // A role change locks user_accounts; a group reassignment locks groups;
    // changing student.group_id locks students. Keep the checks and write in
    // one transaction so none of those changes can slip between them.
    const [actor] = await tx.select({ account: userAccounts, identity: user }).from(userAccounts)
      .innerJoin(user, eq(userAccounts.authUserId, user.id))
      .where(eq(userAccounts.id, accountId)).for('share');
    if (!actor || !hasActiveIdentity(actor.account, actor.identity) || actor.account.role !== 'TEACHER' ||
      actor.account.emailNormalized !== actor.identity.email.toLowerCase()) throw forbidden();

    const [student] = await tx.select().from(students).where(eq(students.id, id)).for('update');
    if (!student) throw forbidden();
    const [group] = await tx.select().from(groups).where(eq(groups.id, student.groupId)).for('share');
    if (!group || group.teacherAccountId !== accountId) throw forbidden();

    const [changed] = await tx.update(students).set(names).where(eq(students.id, id)).returning(projection);
    if (!changed) throw forbidden();
    return changed;
  });
}

export async function listStudents(accountId: string, groupIds: string[], filters: {
  groupId?: string; ids?: string[]; limit: number; offset: number;
}) {
  if (groupIds.length === 0 || filters.ids?.length === 0) return { items: [], total: 0, limit: filters.limit, offset: filters.offset };
  const conditions = [eq(groups.teacherAccountId, accountId), inArray(groups.id, groupIds)];
  if (filters.groupId) conditions.push(eq(groups.id, filters.groupId));
  if (filters.ids) conditions.push(inArray(students.id, filters.ids));
  const scope = and(...conditions);
  return db.transaction(async (tx) => {
    const [total] = await tx.select({ value: count() }).from(students)
      .innerJoin(groups, eq(students.groupId, groups.id)).where(scope);
    const items = await tx.select(projection).from(students)
      .innerJoin(groups, eq(students.groupId, groups.id)).where(scope)
      .orderBy(asc(students.id)).limit(filters.limit).offset(filters.offset);
    return { items, total: total?.value ?? 0, limit: filters.limit, offset: filters.offset };
  }, { isolationLevel: 'repeatable read' });
}

export async function listGroupOptions(accountId: string, groupIds: string[]) {
  if (groupIds.length === 0) return { items: [] };
  const items = await db.select({ id: groups.id, name: groups.name, studentCount: count(students.id) })
    .from(groups).leftJoin(students, eq(students.groupId, groups.id))
    .where(and(eq(groups.teacherAccountId, accountId), inArray(groups.id, groupIds)))
    .groupBy(groups.id, groups.name).orderBy(asc(groups.name), asc(groups.id));
  return { items };
}
