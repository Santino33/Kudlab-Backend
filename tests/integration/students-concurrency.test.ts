import { beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { students } from '../../src/db/schema/academic.js';
import { academicFixture, request, reset } from '../helpers.js';
beforeEach(reset);
it.each(['create-update', 'update-update'])('unicidad y rollback en carrera %s', async (kind) => {
  const { a, b, aGroups, bGroups } = await academicFixture();
  const [one, two] = await db.insert(students).values([
    { groupId: aGroups[0]!.id, studentCode: 'before-a', firstName: 'Original', lastName: 'Pérez' },
    { groupId: bGroups[0]!.id, studentCode: 'before-b', firstName: 'Original', lastName: 'Pérez' },
  ]).returning();
  const operations = [request(`/api/v1/students/${one!.id}`, 'PATCH', { studentCode: 'target', firstName: 'Changed' }, a.teacher),
    kind === 'create-update'
      ? request('/api/v1/students', 'POST', { groupId: bGroups[0]!.id, studentCode: 'target', firstName: 'New', lastName: 'Pérez' }, b.teacher)
      : request(`/api/v1/students/${two!.id}`, 'PATCH', { studentCode: 'target', firstName: 'Changed' }, b.teacher)];
  const responses = await Promise.all(operations);
  expect(responses.filter((r) => r.ok)).toHaveLength(1);
  expect(responses.filter((r) => r.status === 409)).toHaveLength(1);
  expect(await db.select().from(students).where(eq(students.studentCode, 'target'))).toHaveLength(1);
  const [storedOne] = await db.select().from(students).where(eq(students.id, one!.id));
  expect(storedOne!.firstName).toBe(responses[0]!.ok ? 'Changed' : 'Original');
  const [storedTwo] = await db.select().from(students).where(eq(students.id, two!.id));
  expect(storedTwo!.firstName).toBe(kind === 'update-update' && responses[1]!.ok ? 'Changed' : 'Original');
});
it('dos docentes compiten por código global; un ganador y un conflicto', async () => {
  const { a, b, aGroups, bGroups } = await academicFixture();
  const responses = await Promise.all([[a, aGroups[0]!], [b, bGroups[0]!]].map(async ([teacher, group]) => {
    const t = teacher as typeof a; const g = group as typeof aGroups[number];
    return request('/api/v1/students', 'POST', { groupId: g.id, studentCode: 'race', firstName: 'Ana', lastName: 'Pérez' }, t.teacher);
  }));
  expect(responses.map((r) => r.status).sort()).toEqual([201,409]);
  expect(await db.select().from(students).where(eq(students.studentCode, 'race'))).toHaveLength(1);
  for (const code of ['Case', 'case']) expect((await request('/api/v1/students', 'POST', {
    groupId: aGroups[0]!.id, studentCode: code, firstName: 'Ana', lastName: 'Pérez',
  }, a.teacher)).status).toBe(201);
});
