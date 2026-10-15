import { expect, it } from 'vitest';
import { db } from '../../src/db/client.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { inviteTeacher, login, request, reset } from '../helpers.js';

it('informa p95 de 30 sesiones sobre consulta propia, ajena y listado autorizado', async () => {
  await reset();
  const own = await inviteTeacher('own@pilot.edu.co');
  const other = await inviteTeacher('other@pilot.edu.co');
  const [ownGroup, otherGroup] = await db.insert(groups).values([
    { teacherAccountId: own.account.id, name: '3A', grade: '3', schoolYear: 2026 },
    { teacherAccountId: other.account.id, name: '3B', grade: '3', schoolYear: 2026 },
  ]).returning();
  const [ownStudent, otherStudent] = await db.insert(students).values([
    { groupId: ownGroup!.id, studentCode: 'load-a', firstName: 'Ana', lastName: 'Prueba' },
    { groupId: otherGroup!.id, studentCode: 'load-b', firstName: 'Beto', lastName: 'Prueba' },
  ]).returning();
  const sessions = await Promise.all(Array.from({ length: 30 }, () => login('own@pilot.edu.co', 'TeacherPass1')));
  for (const [label, path, expected] of [
    ['propio', `/api/v1/students/${ownStudent!.id}`, 200],
    ['ajeno', `/api/v1/students/${otherStudent!.id}`, 403],
    ['lista', '/api/v1/students', 200],
  ] as const) {
    const durations = await Promise.all(sessions.map(async (headers) => {
      const start = performance.now();
      const response = await request(path, 'GET', undefined, headers);
      expect(response.status).toBe(expected);
      return performance.now() - start;
    }));
    durations.sort((a, b) => a - b);
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1]!;
    console.info(`${label}: 30 sesiones, p95=${p95.toFixed(1)}ms; referencia propuesta <2000ms, no aprobada`);
  }
});
