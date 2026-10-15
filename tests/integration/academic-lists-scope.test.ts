import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { inviteTeacher, request, reset } from '../helpers.js';

describe('listas académicas con ámbito persistido', () => {
  beforeEach(reset);

  async function fixture() {
    const first = await inviteTeacher('first@pilot.edu.co');
    const second = await inviteTeacher('second@pilot.edu.co');
    const [a, b] = await db.insert(groups).values([
      { teacherAccountId: first.account.id, name: '3A', grade: '3', schoolYear: 2026 },
      { teacherAccountId: second.account.id, name: '3B', grade: '3', schoolYear: 2026 },
    ]).returning();
    const [a1, a2, b1] = await db.insert(students).values([
      { groupId: a!.id, studentCode: 'ficticio-a1', firstName: 'Ana', lastName: 'Uno' },
      { groupId: a!.id, studentCode: 'ficticio-a2', firstName: 'Alba', lastName: 'Dos' },
      { groupId: b!.id, studentCode: 'ficticio-b1', firstName: 'Beto', lastName: 'Tres' },
    ]).returning();
    return { first, second, a: a!, b: b!, a1: a1!, a2: a2!, b1: b1! };
  }

  it('filtra antes de contar y paginar, y las opciones de grupo no incluyen el grupo ajeno', async () => {
    const { first, a, b, a1, a2, b1 } = await fixture();
    const own = await (await request('/api/v1/students', 'GET', undefined, first.teacher)).json();
    expect(own.total).toBe(2);
    expect(own.items.map((x: { id: string }) => x.id).sort()).toEqual([a1.id, a2.id].sort());
    const page = await (await request('/api/v1/students?limit=1&offset=1', 'GET', undefined, first.teacher)).json();
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    expect((await (await request(`/api/v1/students?groupId=${b.id}`, 'GET', undefined, first.teacher)).json()))
      .toMatchObject({ items: [], total: 0 });
    const mixed = await (await request(`/api/v1/students?ids=${a1.id},${b1.id}`, 'GET', undefined, first.teacher)).json();
    expect(mixed).toMatchObject({ total: 1, items: [{ id: a1.id }] });
    const options = await (await request('/api/v1/groups', 'GET', undefined, first.teacher)).json();
    expect(options).toEqual({ items: [{ id: a.id, name: '3A', studentCount: 2 }] });
    expect(JSON.stringify(options)).not.toContain(b.id);
  });

  it('la primera lista tras perder el grupo queda vacía, no reutiliza el ámbito previo', async () => {
    const { first, second, a } = await fixture();
    expect((await (await request('/api/v1/students', 'GET', undefined, first.teacher)).json()).total).toBe(2);
    await db.update(groups).set({ teacherAccountId: second.account.id }).where(eq(groups.id, a.id));
    expect((await (await request('/api/v1/students', 'GET', undefined, first.teacher)).json()))
      .toMatchObject({ items: [], total: 0 });
    expect((await (await request('/api/v1/groups', 'GET', undefined, first.teacher)).json()).items).toEqual([]);
    expect((await (await request('/api/v1/students', 'GET', undefined, second.teacher)).json()).total).toBe(3);
  });
});
