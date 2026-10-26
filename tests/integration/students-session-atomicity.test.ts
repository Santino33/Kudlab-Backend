import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { students } from '../../src/db/schema/academic.js';
import { recordAcceptedRequestInTransaction } from '../../src/auth/session-activity.js';
import * as activity from '../../src/auth/session-activity.js';
import { session, user } from '../../src/db/schema/auth.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { groups } from '../../src/db/schema/academic.js';
import { sessionActivity } from '../../src/db/schema/authentication.js';
import { academicFixture, request, reset } from '../helpers.js';
import * as academicAuth from '../../src/modules/academico/shared/academic-auth.js';

beforeEach(reset);
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

it.each(['status','role','scope'])('revalida %s cambiado después del guard',async(kind)=>{
  const {a,b,aGroups}=await academicFixture();
  const entered=barrier();const proceed=barrier();const original=academicAuth.withAcademicAccess;
  vi.spyOn(academicAuth,'withAcademicAccess').mockImplementation(async(actor,operation)=>{
    entered.release();await proceed.promise;return original(actor,operation);
  });
  const pending=request('/api/v1/students','POST',{groupId:aGroups[0]!.id,studentCode:'late',firstName:'Ana',lastName:'Pérez'},a.teacher);
  await entered.promise;
  try {
    if(kind==='status') await db.update(userAccounts).set({status:'INACTIVA'}).where(eq(userAccounts.id,a.account.id));
    if(kind==='role') {
      await db.update(userAccounts).set({role:'ADMIN'}).where(eq(userAccounts.id,a.account.id));
      await db.update(user).set({role:'admin'}).where(eq(user.email,'teacher-a@pilot.edu.co'));
    }
    if(kind==='scope') await db.update(groups).set({teacherId:b.account.id}).where(eq(groups.id,aGroups[0]!.id));
  } finally {proceed.release();}
  expect((await pending).status).toBe(kind==='scope'?404:403);
  expect(await db.select().from(students)).toHaveLength(0);
});

it('contención identidad→cuenta falla sin esperar una inversión de bloqueos',async()=>{
  const {a}=await academicFixture();
  const entered=barrier();const proceed=barrier();
  const holder=db.transaction(async(tx)=>{
    await tx.select().from(user).where(eq(user.email,'teacher-a@pilot.edu.co')).for('update');
    entered.release();await proceed.promise;
  });
  await entered.promise;
  try {expect((await request('/api/v1/students','GET',undefined,a.teacher)).status).toBe(503);}
  finally {proceed.release();await holder;}
  expect((await request('/api/v1/students','GET',undefined,a.teacher)).status).toBe(200);
});

it('cierre confirmado entre preparación y transacción rechaza sin escribir', async () => {
  const { a, aGroups } = await academicFixture();
  const entered = barrier(); const proceed = barrier();
  const original = academicAuth.withAcademicAccess;
  vi.spyOn(academicAuth, 'withAcademicAccess').mockImplementation(async (actor, operation) => {
    entered.release(); await proceed.promise; return original(actor, operation);
  });
  const pending = request('/api/v1/students', 'POST', { groupId:aGroups[0]!.id,studentCode:'closed',firstName:'Ana',lastName:'Pérez' },a.teacher);
  await entered.promise;
  try { expect((await request('/api/auth/sign-out','POST',undefined,a.teacher)).status).toBe(200); }
  finally { proceed.release(); }
  expect((await pending).status).toBe(401);
  expect(await db.select().from(students)).toHaveLength(0);
});

it('operación ya bloqueada confirma antes del cierre y luego la sesión no se reutiliza', async () => {
  const { a, aGroups }=await academicFixture();
  const entered=barrier(); const proceed=barrier();
  const original=activity.recordAcceptedRequestInTransaction;
  vi.spyOn(activity,'recordAcceptedRequestInTransaction').mockImplementation(async (tx,id,userId)=>{
    entered.release(); await proceed.promise; return original(tx,id,userId);
  });
  const pending=request('/api/v1/students','POST',{groupId:aGroups[0]!.id,studentCode:'committed',firstName:'Ana',lastName:'Pérez'},a.teacher);
  await entered.promise;
  const close=request('/api/auth/sign-out','POST',undefined,a.teacher);
  proceed.release();
  expect((await pending).status).toBe(201);
  expect((await close).status).toBe(200);
  expect(await db.select().from(students)).toHaveLength(1);
  expect((await request('/api/v1/students','GET',undefined,a.teacher)).status).toBe(401);
});

it('fallo técnico final revierte y no devuelve detalle interno', async()=>{
  const {a,aGroups}=await academicFixture();
  vi.spyOn(activity,'recordAcceptedRequestInTransaction').mockRejectedValueOnce(new Error('private_database_details'));
  const res=await request('/api/v1/students','POST',{groupId:aGroups[0]!.id,studentCode:'technical',firstName:'Ana',lastName:'Pérez'},a.teacher);
  expect(res.status).toBe(503);expect(JSON.stringify(await res.json())).not.toContain('private_database_details');
  expect(await db.select().from(students)).toHaveLength(0);
});

it.each(['create', 'patch', 'deactivate', 'read'])('no confirma %s si vence la sesión al aceptar', async (operation) => {
  const { a, aGroups } = await academicFixture();
  const { session: current } = await (await request('/api/auth/get-session', 'GET', undefined, a.teacher)).json();
  const [row] = await db.insert(students).values({ groupId: aGroups[0]!.id, studentCode: 'existing', firstName: 'Original', lastName: 'Pérez', isActive: true }).returning();
  const original = activity.recordAcceptedRequestInTransaction;
  const now = Date.now();
  vi.spyOn(activity, 'recordAcceptedRequestInTransaction').mockImplementation(async (tx, id, userId) => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now + 31 * 60 * 1000);
    return original(tx, id, userId);
  });
  const base = '/api/v1/students';
  const res = operation === 'create'
    ? await request(base, 'POST', { groupId: aGroups[0]!.id, studentCode: 'rollback', firstName: 'Ana', lastName: 'Pérez' }, a.teacher)
    : operation === 'patch' ? await request(`${base}/${row!.id}`, 'PATCH', { firstName: 'Changed' }, a.teacher)
    : operation === 'deactivate' ? await request(`${base}/${row!.id}/deactivate`, 'POST', undefined, a.teacher)
    : await request(base, 'GET', undefined, a.teacher);
  expect(res.status).toBe(401);
  expect(await res.json()).toEqual({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' });
  expect(await db.select().from(students)).toEqual([row]);
  expect(await db.select().from(sessionActivity).where(eq(sessionActivity.sessionId,current.id))).toHaveLength(0);
});

it('lecturas aceptadas renuevan solo su sesión; rechazos no renuevan; cierre y expiración deniegan', async () => {
  const { a } = await academicFixture();
  const { session: current } = await (await request('/api/auth/get-session', 'GET', undefined, a.teacher)).json();
  expect((await request('/api/v1/students?bad=1','GET',undefined,a.teacher)).status).toBe(400);
  expect(await db.select().from(sessionActivity).where(eq(sessionActivity.sessionId,current.id))).toHaveLength(0);
  expect((await request('/api/v1/students','GET',undefined,a.teacher)).status).toBe(200);
  expect(await db.select().from(sessionActivity).where(eq(sessionActivity.sessionId,current.id))).toHaveLength(1);
  await db.update(session).set({ expiresAt: new Date(Date.now()-1000) }).where(eq(session.id,current.id));
  expect((await request('/api/v1/students','GET',undefined,a.teacher)).status).toBe(401);
});

it('revierte una escritura si no puede aceptar la sesión dentro de la transacción', async () => {
  const { aGroups } = await academicFixture();
  await expect(db.transaction(async (tx) => {
    await tx.insert(students).values({ groupId: aGroups[0]!.id, studentCode: 'rollback', firstName: 'Ana', lastName: 'Pérez' });
    if (!await recordAcceptedRequestInTransaction(tx, 'missing', 'missing')) throw new Error('Sesión requerida');
  })).rejects.toThrow('Sesión requerida');
  expect(await db.select().from(students).where(eq(students.studentCode, 'rollback'))).toHaveLength(0);
});
