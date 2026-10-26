import { beforeEach, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { academicFixture, request, reset } from '../helpers.js';
import { db } from '../../src/db/client.js';
import { students } from '../../src/db/schema/academic.js';
beforeEach(reset);
it('lista solo ámbito propio, incluye inactivos y detalle neutral para IDs ajenos', async () => {
  const { a, b, aGroups, bGroups } = await academicFixture();
  expect(await (await request(base, 'GET', undefined, a.teacher)).json()).toEqual({ items: [] });
  const rows = await db.insert(students).values([
    { groupId: aGroups[0]!.id, studentCode: 'a1', firstName: 'Ana', lastName: 'Pérez', isActive: true },
    { groupId: aGroups[1]!.id, studentCode: 'a2', firstName: 'Ana', lastName: 'Pérez' },
    { groupId: bGroups[0]!.id, studentCode: 'b1', firstName: 'Ana', lastName: 'Pérez' },
    { groupId: bGroups[1]!.id, studentCode: 'b2', firstName: 'Ana', lastName: 'Pérez' },
  ]).returning();
  const own = await (await request(base, 'GET', undefined, a.teacher)).json();
  expect(own.items.map((s: { id: string }) => s.id)).toEqual(rows.slice(0,2).map((s) => s.id).sort());
  expect((await (await request(base, 'GET', undefined, b.teacher)).json()).items).toHaveLength(2);
  expect((await request(`${base}/${rows[0]!.id}`, 'GET', undefined, a.teacher)).status).toBe(200);
  const bodies = await Promise.all([rows[2]!.id, randomUUID(), 'bad'].map(async (id) => {
    const res = await request(`${base}/${id}`, 'GET', undefined, a.teacher); expect(res.status).toBe(404); return res.json();
  }));
  expect(bodies[0]).toEqual(bodies[1]); expect(bodies[1]).toEqual(bodies[2]);
  expect((await request(`${base}?teacherId=${b.account.id}`, 'GET', undefined, a.teacher)).status).toBe(400);
});
const base = '/api/v1/students';
it('corrige activos e inactivos sin alterar identidad, grupo o estado', async () => {
  const { a, b, aGroups } = await academicFixture();
  const [row] = await db.insert(students).values({ groupId: aGroups[0]!.id, studentCode: 'editable', firstName: 'Ana', lastName: 'Pérez', isActive: true }).returning();
  const path = `${base}/${row!.id}`;
  const result = await request(path, 'PATCH', { studentCode: row!.studentCode, firstName: ' María ' }, a.teacher);
  expect(result.status).toBe(200);
  expect(await result.json()).toMatchObject({ id: row!.id, groupId: row!.groupId, isActive: true, firstName: 'María' });
  for (const bad of [{}, { isActive: true }, { groupId: row!.groupId }, { id: row!.id }])
    expect((await request(path, 'PATCH', bad, a.teacher)).status).toBe(400);
  expect((await request(path, 'PATCH', { firstName: '' }, b.teacher)).status).toBe(404);
  const persisted = await (await request(path, 'GET', undefined, a.teacher)).json();
  expect(persisted.firstName).toBe('María');
});
it('inactiva de forma idempotente sin borrar ni cambiar los datos', async () => {
  const { a, b, aGroups } = await academicFixture();
  const [row] = await db.insert(students).values({ groupId: aGroups[0]!.id, studentCode: 'deactivate', firstName: 'Ana', lastName: 'Pérez', isActive: true }).returning();
  const path = `${base}/${row!.id}/deactivate`;
  for (let i=0; i<2; i++) {
    const res = await request(path, 'POST', undefined, a.teacher);
    expect(res.status).toBe(200); expect(await res.json()).toEqual({ ...row, isActive: false });
  }
  expect((await request(path, 'POST', {}, a.teacher)).status).toBe(400);
  const foreign = await request(path, 'POST', undefined, b.teacher);
  const missing = await request(`${base}/${randomUUID()}/deactivate`, 'POST', undefined, b.teacher);
  expect(foreign.status).toBe(404); expect(await foreign.json()).toEqual(await missing.json());
  expect((await request('/api/auth/get-session','GET',undefined,a.teacher)).status).toBe(200);
  expect((await request(`${base}/bad/deactivate`,'POST',undefined,a.teacher)).status).toBe(404);
  expect((await request(`${path}?bad=1`,'POST',undefined,a.teacher)).status).toBe(400);
  expect((await request(path,'POST',{},{})).status).toBe(401);
  expect((await request(path,'POST',{},a.admin)).status).toBe(403);
});
it('recorrido completo sin interacción del estudiante ni habilitación de cuentas',async()=>{
  const {a,aGroups}=await academicFixture();
  const create=await request(base,'POST',{groupId:aGroups[0]!.id,studentCode:'journey',firstName:'Ana',lastName:'Pérez'},a.teacher);
  expect(create.status).toBe(201);const row=await create.json();
  const path=`${base}/${row.id}`;
  expect((await request(path,'GET',undefined,a.teacher)).status).toBe(200);
  expect((await request(path,'PATCH',{lastName:'Gómez'},a.teacher)).status).toBe(200);
  expect((await request(`${path}/deactivate`,'POST',undefined,a.teacher)).status).toBe(200);
  const final=await (await request(path,'GET',undefined,a.teacher)).json();
  expect(final).toEqual({...row,lastName:'Gómez',isActive:false});
});
it('alta propia devuelve solo DTO inactivo, con campos seguros y código global único', async () => {
  const { a, b, aGroups, bGroups } = await academicFixture();
  const body = { groupId: aGroups[0]!.id, studentCode: '0001-A', firstName: 'María', lastName: 'Pérez' };
  const created = await request(base, 'POST', body, a.teacher);
  expect(created.status).toBe(201);
  const dto = await created.json();
  expect(Object.keys(dto).sort()).toEqual(['firstName','groupId','id','isActive','lastName','studentCode']);
  expect(dto).toMatchObject({ ...body, isActive: false });
  const conflict = await request(base, 'POST', { ...body, groupId: bGroups[0]!.id }, b.teacher);
  expect(conflict.status).toBe(409);
  expect(await conflict.json()).toEqual({ code: 'CONFLICT', message: 'Código de estudiante no disponible' });
  const ownBad = await request(base, 'POST', { ...body, firstName: '' }, a.teacher);
  expect(ownBad.status).toBe(400);
  expect((await ownBad.json()).fields).toEqual({ firstName: 'required' });
});
it('autentica antes del cuerpo y no revela grupos ajenos o inexistentes', async () => {
  const { a, aGroups, bGroups } = await academicFixture();
  expect((await request(base, 'POST', {}, {})).status).toBe(401);
  expect((await request(base, 'POST', {}, a.admin)).status).toBe(403);
  const body = { studentCode: 'new', firstName: 'Ana', lastName: 'Pérez' };
  const foreign = await request(base, 'POST', { ...body, groupId: bGroups[0]!.id }, a.teacher);
  const missing = await request(base, 'POST', { ...body, groupId: randomUUID() }, a.teacher);
  expect(foreign.status).toBe(404); expect(await foreign.json()).toEqual(await missing.json());
  for (const extra of [{ isActive: false }, { teacherId: a.account.id }])
    expect((await request(base, 'POST', { ...body, groupId: aGroups[0]!.id, ...extra }, a.teacher)).status).toBe(400);
  expect((await request(`${base}?teacherId=other`, 'POST', { ...body, groupId: aGroups[0]!.id }, a.teacher)).status).toBe(400);
});
