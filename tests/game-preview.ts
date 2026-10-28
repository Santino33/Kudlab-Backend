// shortcut: every active record in this isolated synthetic preview may play; replace with consent when that feature exists.
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { students } from '../src/db/schema/academic.js';
import { assertTestDatabase, type GameDependencies } from '../src/modules/academico/shared/participation.js';

export const previewGameDependencies: GameDependencies = {
  testActiveStudents: true,
  testParticipation: async (tx, id, at) => {
    assertTestDatabase();
    const [student] = await tx.select().from(students).where(eq(students.id, id));
    return student?.isActive ? { status: 'ALLOWED', authorizationReference: `SYNTHETIC-PREVIEW:${id}`,
      validUntil: new Date(at.getTime() + 86400000) } : { status: 'DENIED' };
  },
};
export function previewGameApp() { assertTestDatabase(); return createApp(previewGameDependencies); }
