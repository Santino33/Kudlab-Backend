import { eq } from 'drizzle-orm';
import { students } from '../src/db/schema/academic.js';
import { db } from '../src/db/client.js';
import { assertTestDatabase, type Participation } from '../src/modules/academico/shared/participation.js';
import { createApp } from '../src/app.js';
import { publishTg01 } from '../src/modules/tareas/catalog/publish.js';
import { tasks } from '../src/db/schema/tasks.js';
import { academicFixture } from './helpers.js';

export const authorizations = new Map<string, Date>();
export const syntheticParticipation: Participation = async (tx, id, at) => {
  assertTestDatabase();
  const [s] = await tx.select().from(students).where(eq(students.id, id));
  const until = authorizations.get(id);
  return s?.isActive && until && until > at ? { status: 'ALLOWED', authorizationReference: `SYNTHETIC-J02:${id}`, validUntil: until } : { status: 'DENIED' };
};
export const gameDependencies = { testParticipation: syntheticParticipation };
export function testGameApp() { assertTestDatabase(); return createApp(gameDependencies); }
export async function gameFixture() {
  assertTestDatabase(); authorizations.clear();
  const academic = await academicFixture();
  const [student] = await db.insert(students).values({ groupId: academic.aGroups[0]!.id, studentCode: 'J02-FICTICIO-A', firstName: 'Participante', lastName: 'Sintético A', isActive: true }).returning();
  authorizations.set(student!.id, new Date(Date.now() + 86400000));
  const [secondStudent] = await db.insert(students).values({ groupId: academic.aGroups[0]!.id, studentCode: 'J03-FICTICIO-B', firstName: 'Participante', lastName: 'Sintético B', isActive: true }).returning();
  authorizations.set(secondStudent!.id, new Date(Date.now() + 86400000));
  const versionId = await publishTg01();
  await db.update(tasks).set({ isEnabled: true }).where(eq(tasks.id, 'TG-01'));
  return { ...academic, student: student!, secondStudent: secondStudent!, versionId };
}
