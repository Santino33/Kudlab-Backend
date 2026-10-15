import { and, eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { groups, students } from '../../db/schema/academic.js';
import type { AssignmentProvider } from '../usuarios/scope-authorization.js';

// Académico owns both group responsibility and student membership. A caller's
// groupId is never evidence that the requested student belongs to that group.
export const academicAssignments: AssignmentProvider & { ownedGroupIds(accountId: string): Promise<string[]> } = {
  async hasAssignment(accountId, _operation, target) {
    if (target.kind === 'group') {
      const [group] = await db.select({ id: groups.id }).from(groups)
        .where(and(eq(groups.id, target.id), eq(groups.teacherAccountId, accountId))).limit(1);
      return !!group;
    }
    const [student] = await db.select({ id: students.id }).from(students)
      .innerJoin(groups, eq(students.groupId, groups.id))
      .where(and(eq(students.id, target.id), eq(groups.teacherAccountId, accountId))).limit(1);
    return !!student;
  },
  async ownedGroupIds(accountId) {
    const owned = await db.select({ id: groups.id }).from(groups).where(eq(groups.teacherAccountId, accountId));
    return owned.map((group) => group.id);
  },
};
