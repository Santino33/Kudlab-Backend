import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { groups, students } from '../../../db/schema/academic.js';
import type { AssignmentProvider } from '../../usuarios/shared/scope-authorization.js';
import type { AcademicTransaction } from './academic-auth.js';

export function academicScopeProvider(query: AcademicTransaction | typeof db): AssignmentProvider {
  return { async hasAssignment(accountId, _operation, target) {
    if (target.kind === 'group') {
      return (await query.select({ id: groups.id }).from(groups)
        .where(and(eq(groups.id, target.id), eq(groups.teacherId, accountId))).limit(1)).length === 1;
    }
    return (await query.select({ id: students.id }).from(students).innerJoin(groups, eq(students.groupId, groups.id))
      .where(and(eq(students.id, target.id), eq(groups.teacherId, accountId))).limit(1)).length === 1;
  } };
}
