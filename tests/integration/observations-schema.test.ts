import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { teacherObservations as observations, teacherObservationRevisions as revisions } from '../../src/db/schema/observations.js';
import { reset } from '../helpers.js';
import { assertObservationTestDatabase, observationFixture } from '../observations-fixture.js';

beforeEach(async () => { assertObservationTestDatabase(); await reset(); });
it('T-03/CA-01/04/07: esquema aditivo, originales íntegros, índices, FK y catálogos sin unicidad por valores', async () => {
  const f = await observationFixture(), at = new Date();
  const [identity] = await db.insert(observations).values({ studentId: f.student.id, authorId: f.a.account.id, createdAt: at }).returning();
  const value = { observationId: identity!.id, actorId: f.a.account.id, version: 1, recordedAt: at, requestId: randomUUID(),
    fingerprint: 'a'.repeat(64), behavior: 'ATTENTION', frequency: 'NEVER', observedOn: '2024-02-29', schoolYear: 2025, term: 4 };
  await db.insert(revisions).values(value);
  for (const patch of [{ requestId: randomUUID() }, { version: 2 }, { observationId: randomUUID(), version: 2, requestId: randomUUID() },
    { version: 2, requestId: randomUUID(), actorId: randomUUID() }, { version: 2, requestId: randomUUID(), behavior: 'OTHER' },
    { version: 2, requestId: randomUUID(), frequency: 'NO_OPPORTUNITY' }, { version: 2, requestId: randomUUID(), area: 'OTHER' },
    { version: 2, requestId: randomUUID(), term: 5 }, { version: 2, requestId: randomUUID(), fingerprint: 'bad' }])
    await expect(db.insert(revisions).values({ ...value, ...patch })).rejects.toThrow();
  await expect(db.update(revisions).set({ frequency: 'ALWAYS' }).where(eq(revisions.observationId, identity!.id))).rejects.toThrow();
  await expect(db.delete(revisions).where(eq(revisions.observationId, identity!.id))).rejects.toThrow();
  await expect(db.update(observations).set({ createdAt: new Date(0), version: 2 }).where(eq(observations.id, identity!.id))).rejects.toThrow();
  await expect(db.delete(observations).where(eq(observations.id, identity!.id))).rejects.toThrow();
  const [second] = await db.insert(observations).values({ studentId: f.student.id, authorId: f.a.account.id, createdAt: at }).returning();
  await db.insert(revisions).values({ ...value, observationId: second!.id, requestId: randomUUID() });
  expect(await db.select().from(revisions)).toHaveLength(2);
  const applied = await db.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`);
  expect(applied.rows[0]!.n).toBe(15);
});
it('T-03/CA-07: identidad y revisión se confirman o revierten juntas', async () => {
  const f = await observationFixture();
  await expect(db.transaction(async tx => {
    const [o] = await tx.insert(observations).values({ studentId: f.student.id, authorId: f.a.account.id, createdAt: new Date() }).returning();
    await tx.insert(revisions).values({ observationId: o!.id, actorId: f.a.account.id, version: 1, requestId: randomUUID(),
      recordedAt: new Date(), fingerprint: 'a'.repeat(64), behavior: 'ATTENTION', frequency: 'BAD', observedOn: '2026-01-01', schoolYear: 2026, term: 1 });
  })).rejects.toThrow();
  expect(await db.select().from(observations)).toHaveLength(0);
});
