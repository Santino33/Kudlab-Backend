import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { count, eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { user, session, account as credentials } from '../../src/db/schema/auth.js';
import { groups, students } from '../../src/db/schema/academic.js';
import * as scope from '../../src/modules/academico/shared/scope-provider.js';
import { academicFixture, request, reset } from '../helpers.js';
beforeEach(reset);
afterEach(() => vi.restoreAllMocks());
it('revierte todas las operaciones ajenas y refleja cambio de responsabilidad vigente', async () => {
  const { a,b,aGroups } = await academicFixture();
  const [row] = await db.insert(students).values({ groupId:aGroups[0]!.id, studentCode:'scope', firstName:'Ana',lastName:'Pérez' }).returning();
  for (const [method,suffix,body] of [['GET','',undefined],['PATCH','',{firstName:'Changed'}],['POST','/deactivate',undefined]] as const)
    expect((await request(`/api/v1/students/${row!.id}${suffix}`,method,body,b.teacher)).status).toBe(404);
  await db.update(groups).set({teacherId:b.account.id}).where(eq(groups.id,aGroups[0]!.id));
  expect((await request(`/api/v1/students/${row!.id}`,'GET',undefined,a.teacher)).status).toBe(404);
  expect((await request(`/api/v1/students/${row!.id}`,'GET',undefined,b.teacher)).status).toBe(200);
});
it('falla cerrado con proveedor ausente o que no puede verificar ámbito', async () => {
  const { a,aGroups } = await academicFixture();
  const body={groupId:aGroups[0]!.id,studentCode:'denied',firstName:'Ana',lastName:'Pérez'};
  vi.spyOn(scope,'academicScopeProvider').mockReturnValue({hasAssignment:async()=>{throw new Error('unavailable');}});
  expect((await request('/api/v1/students','POST',body,a.teacher)).status).toBe(404);
  expect(await db.select().from(students)).toHaveLength(0);
});
it('la corrección de un inactivo conserva su estado y un duplicado revierte otros campos', async () => {
  const { a,aGroups }=await academicFixture();
  const rows=await db.insert(students).values(['first','occupied'].map((studentCode)=>({groupId:aGroups[0]!.id,studentCode,firstName:'Original',lastName:'Pérez'}))).returning();
  expect((await request(`/api/v1/students/${rows[0]!.id}`,'PATCH',{firstName:'Corregido'},a.teacher)).status).toBe(200);
  expect((await request(`/api/v1/students/${rows[0]!.id}`,'PATCH',{studentCode:'occupied',firstName:'No guardar'},a.teacher)).status).toBe(409);
  const [stored]=await db.select().from(students).where(eq(students.id,rows[0]!.id));
  expect(stored).toMatchObject({studentCode:'first',firstName:'Corregido',isActive:false});
});
async function counts() {
  return Promise.all([user, session, credentials, userAccounts].map(async (table) => (await db.select({ n: count() }).from(table))[0]!.n));
}
it('alta crea únicamente estudiante y reserva códigos de inactivos ajenos', async () => {
  const { a, aGroups, bGroups } = await academicFixture();
  await db.insert(students).values({ groupId: bGroups[0]!.id, studentCode: 'reserved', firstName: 'Otro', lastName: 'Menor' });
  const before = await counts();
  const body = { groupId: aGroups[0]!.id, studentCode: 'reserved', firstName: 'Ana', lastName: 'Pérez' };
  expect((await request('/api/v1/students', 'POST', body, a.teacher)).status).toBe(409);
  const res = await request('/api/v1/students', 'POST', { ...body, studentCode: 'own' }, a.teacher);
  expect(res.status).toBe(201);
  expect(await counts()).toEqual(before);
  const [stored] = await db.select().from(students).where(eq(students.studentCode, 'own'));
  expect(stored).toMatchObject({ groupId: aGroups[0]!.id, isActive: false });
  await db.update(userAccounts).set({ status: 'INACTIVA' }).where(eq(userAccounts.id, a.account.id));
  expect((await request('/api/v1/students', 'POST', { ...body, studentCode: 'denied' }, a.teacher)).status).toBe(403);
  expect(await db.select().from(students).where(eq(students.studentCode, 'denied'))).toHaveLength(0);
});
