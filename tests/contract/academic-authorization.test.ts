import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { inviteTeacher, request, reset } from '../helpers.js';
import { academicAssignments } from '../../src/modules/academico/assignment-provider.js';

const contract = parse(readFileSync('specs/004-autorizar-rol-ambito/contracts/academic-students.openapi.yaml', 'utf8'));

describe('contrato HTTP académico de permiso individual', () => {
  beforeEach(reset);

  it('mantiene 401/403 y la lista blanca de campos para docente y administrador', async () => {
    expect(contract.paths['/api/v1/students/{id}'].patch.responses['403']).toBeDefined();
    const first = await inviteTeacher('first@pilot.edu.co');
    const second = await inviteTeacher('second@pilot.edu.co');
    const [group] = await db.insert(groups).values({ teacherAccountId: first.account.id,
      name: '3A', grade: '3', schoolYear: 2026 }).returning();
    const [student] = await db.insert(students).values({ groupId: group!.id, studentCode: 'ficticio',
      firstName: 'Niña', lastName: 'Ficticia' }).returning();
    const url = `/api/v1/students/${student!.id}`;

    for (const headers of [{}, second.teacher, first.admin]) {
      const denied = await request(url, 'PATCH', { firstName: 'No debe cambiar' }, headers);
      expect(denied.status).toBe(headers === first.admin || headers === second.teacher ? 403 : 401);
      expect(JSON.stringify(await denied.json())).not.toContain('Ficticia');
    }
    for (const body of [
      { groupId: group!.id }, { isActive: true }, { studentCode: 'otro' }, { firstName: ' ' },
      { firstName: 'Valido', lastName: '' }, { firstName: 'Valido', groupId: group!.id },
    ]) expect((await request(url, 'PATCH', body, first.teacher)).status).toBe(400);
    const [saved] = await db.select().from(students).where(eq(students.id, student!.id));
    expect(saved).toMatchObject({ firstName: 'Niña', lastName: 'Ficticia', studentCode: 'ficticio', isActive: false });
  });

  it('escritura mixta y objetivo inexistente no producen efectos parciales', async () => {
    const first = await inviteTeacher('first@pilot.edu.co');
    const second = await inviteTeacher('second@pilot.edu.co');
    const [a, b] = await db.insert(groups).values([
      { teacherAccountId: first.account.id, name: '3A', grade: '3', schoolYear: 2026 },
      { teacherAccountId: second.account.id, name: '3B', grade: '3', schoolYear: 2026 },
    ]).returning();
    const [own, other] = await db.insert(students).values([
      { groupId: a!.id, studentCode: 'a', firstName: 'Uno', lastName: 'Ficticio' },
      { groupId: b!.id, studentCode: 'b', firstName: 'Dos', lastName: 'Ficticio' },
    ]).returning();
    const denied = await request(`/api/v1/students/${own!.id}`, 'PATCH',
      { firstName: 'Cambio parcial', ids: [own!.id, other!.id] }, first.teacher);
    expect(denied.status).toBe(400);
    const [saved] = await db.select().from(students).where(eq(students.id, own!.id));
    expect(saved?.firstName).toBe('Uno');
    const unknown = await request('/api/v1/students/00000000-0000-0000-0000-000000000000', 'GET', undefined, first.teacher);
    expect(unknown.status).toBe(403);
    expect(JSON.stringify(await unknown.json())).not.toContain('Uno');
  });

  it('caída del proveedor de asignación impide leer o escribir y no afecta al otro ámbito', async () => {
    const { account, admin, teacher } = await inviteTeacher('first@pilot.edu.co');
    const [group] = await db.insert(groups).values({ teacherAccountId: account.id,
      name: '3A', grade: '3', schoolYear: 2026 }).returning();
    const [student] = await db.insert(students).values({ groupId: group!.id, studentCode: 'scope-a',
      firstName: 'Sin', lastName: 'Filtración' }).returning();
    const spy = vi.spyOn(academicAssignments, 'hasAssignment').mockRejectedValue(new Error('DB fuera'));
    try {
      for (const [method, body] of [['GET', undefined], ['PATCH', { firstName: 'Prohibido' }]] as const) {
        const denied = await request(`/api/v1/students/${student!.id}`, method, body, teacher);
        expect(denied.status).toBe(403);
        expect(await denied.json()).toEqual({ code: 'FORBIDDEN', message: 'Acceso denegado' });
      }
    } finally { spy.mockRestore(); }
    expect((await db.select().from(students).where(eq(students.id, student!.id)))[0]?.firstName).toBe('Sin');
    expect((await request(`/api/v1/students/${student!.id}`, 'GET', undefined, admin)).status).toBe(403);
  });
});
