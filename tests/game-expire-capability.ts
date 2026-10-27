// Fault injection CLI for isolated fixtures. Never mounted in HTTP or imported by the application.
import './setup.js';
import { eq } from 'drizzle-orm';
import { assertTestDatabase } from '../src/modules/academico/shared/participation.js';
import { uuid } from '../src/modules/tareas/runtime/contract.js';
import { db, pool } from '../src/db/client.js';
import { gameSessions, runtimeCapabilities } from '../src/db/schema/game.js';
assertTestDatabase();
try {
  const id = uuid.parse(process.argv[2]);
  await db.transaction(async tx => {
    const [s] = await tx.select().from(gameSessions).where(eq(gameSessions.id, id)).for('share');
    if (!s || s.participationAuthorizationRef !== `SYNTHETIC-J02:${s.studentId}`) throw new Error('SYNTHETIC_STARTED_SESSION_REQUIRED');
    await tx.update(runtimeCapabilities).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(runtimeCapabilities.sessionId, id));
  });
} finally { await pool.end(); }
