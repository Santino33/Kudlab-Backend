import { and, asc, eq } from 'drizzle-orm';
import { groups, students } from '../../../db/schema/academic.js';
import { userAccounts } from '../../../db/schema/accounts.js';
import { user } from '../../../db/schema/auth.js';
import { hasActiveIdentity } from '../../usuarios/shared/accounts.types.js';
import { withAcademicAccess, type AcademicActor, type AcademicTransaction } from '../shared/academic-auth.js';
import { AcademicError, invalidInput, notFound } from '../shared/academic.errors.js';
import { groupId, parseGroup } from './groups.validation.js';

type Role = 'ADMIN' | 'TEACHER';
const conflict = () => new AcademicError(409, 'CONFLICT', 'No se puede completar la operación del curso');
const fields = { id: groups.id, name: groups.name, grade: groups.grade, schoolYear: groups.schoolYear, teacherId: groups.teacherId, teacherName: userAccounts.fullName };

async function read(tx: AcademicTransaction, id: string) {
  const [row] = await tx.select(fields).from(groups).innerJoin(userAccounts, eq(groups.teacherId, userAccounts.id)).where(eq(groups.id, id));
  if (!row) throw notFound();
  return row;
}
async function lock(tx: AcademicTransaction, id: string, role: Role, actor: AcademicActor, write = false) {
  groupId(id);
  const query = tx.select().from(groups).where(role === 'ADMIN' ? eq(groups.id, id) : and(eq(groups.id, id), eq(groups.teacherId, actor.accountId)));
  const [row] = await (write ? query.for('update') : query.for('share'));
  if (!row) throw notFound();
  return row;
}
async function eligibleTeacher(tx: AcademicTransaction, id: string) {
  const [account] = await tx.select().from(userAccounts).where(eq(userAccounts.id, id)).for('share');
  const [identity] = account?.authUserId ? await tx.select().from(user).where(eq(user.id, account.authUserId)).for('share', { noWait: true }) : [];
  if (!account || account.role !== 'TEACHER' || !hasActiveIdentity(account, identity) || account.emailNormalized !== identity?.email.toLowerCase()) throw conflict();
}
export function listGroups(actor: AcademicActor, role: Role) {
  return withAcademicAccess(actor, async tx => {
    await tx.select({ id: groups.id }).from(groups).where(role === 'TEACHER' ? eq(groups.teacherId, actor.accountId) : undefined).for('share');
    return { items: await tx.select(fields).from(groups).innerJoin(userAccounts, eq(groups.teacherId, userAccounts.id))
      .where(role === 'TEACHER' ? eq(groups.teacherId, actor.accountId) : undefined).orderBy(asc(groups.id)) };
  }, role);
}
export function getGroup(actor: AcademicActor, role: Role, id: string) {
  return withAcademicAccess(actor, async tx => { await lock(tx, id, role, actor); return read(tx, id); }, role);
}
export function listTeachers(actor: AcademicActor) {
  return withAcademicAccess(actor, async tx => {
    const rows = await tx.select({ account: userAccounts, identity: user }).from(userAccounts).innerJoin(user, eq(userAccounts.authUserId, user.id))
      .where(and(eq(userAccounts.role, 'TEACHER'), eq(userAccounts.status, 'ACTIVA'))).orderBy(asc(userAccounts.fullName), asc(userAccounts.id));
    return { items: rows.filter(({ account, identity }) => hasActiveIdentity(account, identity) && account.emailNormalized === identity.email.toLowerCase())
      .map(({ account }) => ({ id: account.id, name: account.fullName })) };
  }, 'ADMIN');
}
export function createGroup(actor: AcademicActor, payload: unknown) {
  return withAcademicAccess(actor, async tx => {
    const input = parseGroup(payload);
    await eligibleTeacher(tx, input.teacherId!);
    const [created] = await tx.insert(groups).values({ name: input.name!, grade: input.grade!, schoolYear: input.schoolYear!, teacherId: input.teacherId! }).returning();
    return read(tx, created!.id);
  }, 'ADMIN');
}
export function updateGroup(actor: AcademicActor, id: string, payload: () => Promise<unknown>) {
  return withAcademicAccess(actor, async tx => {
    const before = await lock(tx, id, 'ADMIN', actor, true);
    const { confirmTransfer, ...input } = parseGroup(await payload(), true);
    if (input.teacherId && input.teacherId !== before.teacherId) {
      if (!confirmTransfer) throw conflict();
      await eligibleTeacher(tx, input.teacherId);
    }
    await tx.update(groups).set(input).where(eq(groups.id, id));
    return read(tx, id);
  }, 'ADMIN');
}
export function deleteGroup(actor: AcademicActor, id: string, body: () => Promise<string>) {
  return withAcademicAccess(actor, async tx => {
    await lock(tx, id, 'ADMIN', actor, true);
    if ((await body()).length) throw invalidInput();
    if ((await tx.select({ id: students.id }).from(students).where(eq(students.groupId, id)).limit(1)).length) throw conflict();
    await tx.delete(groups).where(eq(groups.id, id));
    return { id, deleted: true as const };
  }, 'ADMIN');
}
