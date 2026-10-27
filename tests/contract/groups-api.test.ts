import { beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { academicFixture, request, reset } from '../helpers.js';
import { db } from '../../src/db/client.js';
import { students } from '../../src/db/schema/academic.js';
const base = '/api/v1/groups';
beforeEach(reset);

it('ADMIN gestiona cursos y TEACHER solo consulta los propios sin datos estudiantiles', async () => {
  const { a, b, aGroups, bGroups } = await academicFixture();
  const all = await request(base, 'GET', undefined, a.admin);
  expect(all.headers.get('cache-control')).toBe('no-store');
  expect((await all.json()).items).toHaveLength(4);
  const own = await (await request(base, 'GET', undefined, a.teacher)).json();
  expect(own.items.map((g: { id: string }) => g.id)).toEqual(aGroups.map(g => g.id).sort());
  expect(Object.keys(own.items[0]).sort()).toEqual(['grade', 'id', 'name', 'schoolYear', 'teacherId', 'teacherName']);
  for (const id of [bGroups[0]!.id, randomUUID(), 'bad']) {
    const response = await request(`${base}/${id}`, 'GET', undefined, a.teacher);
    expect(response.status).toBe(404); expect(await response.json()).toEqual({ code: 'NOT_FOUND', message: 'Recurso no encontrado' });
  }
  expect((await request(`${base}/${aGroups[0]!.id}`, 'GET', undefined, b.teacher)).status).toBe(404);
  expect((await request(`${base}?teacherId=${b.account.id}`, 'GET', undefined, a.teacher)).status).toBe(400);
  expect((await request(base, 'GET')).status).toBe(401);
  for (const [path, method] of [[base, 'POST'], [`${base}/${aGroups[0]!.id}`, 'PATCH'], [`${base}/${aGroups[0]!.id}`, 'DELETE'], [`${base}/teachers`, 'GET']])
    expect((await request(path!, method!, method === 'GET' ? undefined : {}, a.teacher)).status).toBe(403);
});

it('crea, valida, edita y elimina un curso vacío sin ampliar permisos', async () => {
  const { a } = await academicFixture();
  const input = { name: ' Curso de prueba ', grade: ' 3 ', schoolYear: 2026, teacherId: a.account.id };
  const result = await request(base, 'POST', input, a.admin);
  expect(result.status).toBe(201); const row = await result.json();
  expect(row).toMatchObject({ name: 'Curso de prueba', grade: '3', schoolYear: 2026, teacherId: a.account.id });
  const teachers = await (await request(`${base}/teachers`, 'GET', undefined, a.admin)).json();
  expect(teachers.items.find((t: { id: string }) => t.id === a.account.id)).toEqual({ id: a.account.id, name: 'Docente Test' });
  for (const bad of [{ ...input, name: '' }, { ...input, grade: 'x'.repeat(21) }, { ...input, schoolYear: '2026' }, { ...input, extra: true }, { ...input, teacherId: randomUUID() }])
    expect([400, 409]).toContain((await request(base, 'POST', bad, a.admin)).status);
  expect((await request(`${base}/${row.id}`, 'PATCH', {}, a.admin)).status).toBe(400);
  expect((await request(`${base}/${row.id}`, 'PATCH', { name: 'Corregido' }, a.admin)).status).toBe(200);
  expect((await request(`${base}/${row.id}`, 'DELETE', {}, a.admin)).status).toBe(400);
  const deleted = await request(`${base}/${row.id}`, 'DELETE', undefined, a.admin);
  expect(deleted.status).toBe(200); expect(await deleted.json()).toEqual({ id: row.id, deleted: true });
  expect((await request(`${base}/${row.id}`, 'GET', undefined, a.admin)).status).toBe(404);
});

it('el curso filtra estudiantes, registra inactivo y bloquea el borrado incluso con inactivos', async () => {
  const { a, b, aGroups } = await academicFixture();
  const id = aGroups[0]!.id;
  expect(await (await request(`${base}/${id}/students`, 'GET', undefined, a.teacher)).json()).toEqual({ items: [] });
  const created = await request('/api/v1/students', 'POST', { groupId: id, studentCode: 'CUR-01', firstName: 'Nombre ficticio', lastName: 'De prueba' }, a.teacher);
  expect(created.status).toBe(201); const student = await created.json(); expect(student.isActive).toBe(false);
  const list = await request(`${base}/${id}/students`, 'GET', undefined, a.teacher);
  expect(await list.json()).toEqual({ items: [student] });
  expect(await (await request(`${base}/${aGroups[1]!.id}/students`, 'GET', undefined, a.teacher)).json()).toEqual({ items: [] });
  expect((await request(`${base}/${id}/students`, 'GET', undefined, b.teacher)).status).toBe(404);
  expect((await request(`${base}/${id}/students`, 'GET', undefined, a.admin)).status).toBe(403);
  expect((await request(`${base}/${id}`, 'DELETE', undefined, a.admin)).status).toBe(409);
  expect((await request(`/api/v1/students/${student.id}`, 'GET', undefined, a.teacher)).status).toBe(200);
});

it('transferencia confirmada conserva registros y retira acceso anterior en todas las operaciones', async () => {
  const { a, b, aGroups } = await academicFixture(); const id = aGroups[0]!.id;
  const [row] = await db.insert(students).values({ groupId: id, studentCode: 'TRANSFER-01', firstName: 'Nombre ficticio', lastName: 'De prueba', isActive: true }).returning();
  expect((await request(`${base}/${id}`, 'PATCH', { teacherId: b.account.id }, a.admin)).status).toBe(409);
  const transfer = await request(`${base}/${id}`, 'PATCH', { teacherId: b.account.id, confirmTransfer: true }, a.admin);
  expect(transfer.status).toBe(200);
  expect((await transfer.json()).teacherId).toBe(b.account.id);
  expect((await request(`${base}/${id}/students`, 'GET', undefined, a.teacher)).status).toBe(404);
  for (const [method, suffix, body] of [['GET', '', undefined], ['PATCH', '', { firstName: 'Cambio' }], ['POST', '/deactivate', undefined]] as const)
    expect((await request(`/api/v1/students/${row!.id}${suffix}`, method, body, a.teacher)).status).toBe(404);
  expect(await (await request(`/api/v1/students/${row!.id}`, 'GET', undefined, b.teacher)).json()).toEqual(row);
  expect((await request(`/api/v1/students/${row!.id}`, 'PATCH', { firstName: 'Corregido' }, b.teacher)).status).toBe(200);
});

it('alta concurrente con borrado de vacío no deja estudiantes huérfanos', async () => {
  const { a, aGroups } = await academicFixture(); const id = aGroups[0]!.id;
  const [created, deleted] = await Promise.all([
    request('/api/v1/students', 'POST', { groupId: id, studentCode: 'RACE-01', firstName: 'Nombre', lastName: 'Ficticio' }, a.teacher),
    request(`${base}/${id}`, 'DELETE', undefined, a.admin),
  ]);
  expect([[201, 409], [404, 200]]).toContainEqual([created.status, deleted.status]);
});
