import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { inviteTeacher, request, reset } from '../helpers.js';

describe('ámbito docente con asignaciones persistidas', () => {
  beforeEach(reset);

  async function fixture() {
    const first = await inviteTeacher('first@pilot.edu.co');
    const second = await inviteTeacher('second@pilot.edu.co');
    const [groupA, groupB] = await db.insert(groups).values([
      { teacherAccountId: first.account.id, name: '3A', grade: '3', schoolYear: 2026 },
      { teacherAccountId: second.account.id, name: '3B', grade: '3', schoolYear: 2026 },
    ]).returning();
    const [studentA, studentB] = await db.insert(students).values([
      { groupId: groupA!.id, studentCode: 'fake-a', firstName: 'Ana', lastName: 'Prueba' },
      { groupId: groupB!.id, studentCode: 'fake-b', firstName: 'Beto', lastName: 'Prueba' },
    ]).returning();
    return { first, second, groupA: groupA!, groupB: groupB!, studentA: studentA!, studentB: studentB! };
  }

  it('permite leer y modificar únicamente nombre/apellidos de su estudiante real', async () => {
    const { first, studentA } = await fixture();
    const url = `/api/v1/students/${studentA.id}`;
    expect(await (await request(url, 'GET', undefined, first.teacher)).json()).toEqual({
      id: studentA.id, groupId: studentA.groupId, firstName: 'Ana', lastName: 'Prueba',
    });
    const changed = await request(url, 'PATCH', { firstName: 'Ana María', lastName: 'Piloto' }, first.teacher);
    expect(changed.status).toBe(200);
    expect(await changed.json()).toMatchObject({ firstName: 'Ana María', lastName: 'Piloto' });
    const [saved] = await db.select().from(students).where(eq(students.id, studentA.id));
    expect(saved).toMatchObject({ firstName: 'Ana María', lastName: 'Piloto', groupId: studentA.groupId,
      studentCode: 'fake-a', isActive: false });
  });

  it('deniega objetivos ajenos y una combinación de groupId propio con estudiante ajeno sin filtrar existencia', async () => {
    const { first, second, groupA, studentA, studentB } = await fixture();
    const url = `/api/v1/students/${studentB.id}`;
    for (const [method, body, path] of [
      ['GET', undefined, url],
      ['PATCH', { firstName: 'Intruso' }, url],
      ['GET', undefined, `${url}?groupId=${groupA.id}`],
    ] as const) {
      const denied = await request(path, method, body, first.teacher);
      expect(denied.status).toBe(403);
      expect(await denied.json()).toEqual({ code: 'FORBIDDEN', message: 'Acceso denegado' });
    }
    expect((await request(`/api/v1/students/${studentA.id}`, 'GET', undefined, second.teacher)).status).toBe(403);
    const [still] = await db.select().from(students).where(eq(students.id, studentB.id));
    expect(still?.firstName).toBe('Beto');
  });

  it('usa la responsabilidad y pertenencia actuales después de cambiar docente o grupo sin recrear sesión', async () => {
    const { first, second, groupA, groupB, studentA } = await fixture();
    const url = `/api/v1/students/${studentA.id}`;
    expect((await request(url, 'GET', undefined, first.teacher)).status).toBe(200);
    await db.update(groups).set({ teacherAccountId: second.account.id }).where(eq(groups.id, groupA.id));
    expect((await request(url, 'GET', undefined, first.teacher)).status).toBe(403);
    expect((await request(url, 'GET', undefined, second.teacher)).status).toBe(200);
    await db.update(students).set({ groupId: groupB.id }).where(eq(students.id, studentA.id));
    expect((await request(url, 'PATCH', { firstName: 'Reasignada' }, first.teacher)).status).toBe(403);
    expect((await request(url, 'GET', undefined, second.teacher)).status).toBe(200);
  });

  it('no guarda un nombre si el grupo se reasigna antes de confirmar la escritura', async () => {
    const { first, second, groupA, studentA } = await fixture();
    let pending: ReturnType<typeof request> | undefined;
    await db.transaction(async (tx) => {
      await tx.update(groups).set({ teacherAccountId: second.account.id }).where(eq(groups.id, groupA.id));
      pending = request(`/api/v1/students/${studentA.id}`, 'PATCH', { firstName: 'Fuera de ámbito' }, first.teacher);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect((await pending!).status).toBe(403);
    expect((await db.select().from(students).where(eq(students.id, studentA.id)))[0]?.firstName).toBe('Ana');
  });
});
