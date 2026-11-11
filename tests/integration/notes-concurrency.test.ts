import { beforeEach, describe, expect, it } from 'vitest';
import { desc, eq, sql } from 'drizzle-orm';
import { academicFixture, login, request, reset } from '../helpers.js';
import { db } from '../../src/db/client.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { academicNotes } from '../../src/db/schema/academic-notes.js';
import { session, user } from '../../src/db/schema/auth.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { createNote, type NotesTestHooks } from '../../src/modules/academico/notes/notes.service.js';
import type { AcademicActor } from '../../src/modules/academico/shared/academic-auth.js';

beforeEach(reset);

// Puntos de sincronización inyectados solo por el arnés: promesas con liberación y tiempo límite, sin pausas manuales.
function gate() {
  let release!: () => void;
  const open = new Promise<void>((resolve) => { release = resolve; });
  return { release, wait: () => Promise.race([open, new Promise<void>((_, reject) => setTimeout(() => reject(new Error('gate timeout')), 10_000))]) };
}
const settledWithin = (promise: Promise<unknown>, ms: number) =>
  Promise.race([promise.then(() => true, () => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]);

async function setup() {
  const f = await academicFixture();
  const [own] = await db.insert(students).values({ groupId: f.aGroups[0]!.id, studentCode: 'c-a1', firstName: 'Ana', lastName: 'Ficticia', isActive: true }).returning();
  const [account] = await db.select().from(userAccounts).where(eq(userAccounts.id, f.a.account.id));
  const [current] = await db.select().from(session).where(eq(session.userId, account!.authUserId!)).orderBy(desc(session.createdAt)).limit(1);
  const actor: AcademicActor = { accountId: account!.id, authUserId: account!.authUserId!, sessionId: current!.id };
  return { ...f, own: own!, actor };
}
const payload = (term = 1) => async () => ({ subject: 'LENGUAJE', term, score: '4.5' });

describe('notas · concurrencia con conexiones independientes (CA-05, 09, 13, 14)', () => {
  it('alta contra transferencia del curso: sin confirmar contra un ámbito perdido', async () => {
    const s = await setup();
    const admin = await login();
    const hooks: NotesTestHooks = { afterGroupRead: async () => {
      // Con la lectura sin bloqueo hecha, el ADMIN transfiere el curso y confirma antes de que la alta bloquee el curso.
      const moved = await request(`/api/v1/groups/${s.aGroups[0]!.id}`, 'PATCH', { teacherId: s.b.account.id, confirmTransfer: true }, admin);
      expect(moved.status).toBe(200);
    } };
    await expect(createNote(s.actor, s.own.id, payload(), hooks)).rejects.toMatchObject({ status: 404 });
    expect(await db.select().from(academicNotes)).toHaveLength(0);
  });

  it('cambio de curso del estudiante entre lectura y bloqueo: un único reintento y se confirma sobre el curso actual', async () => {
    const s = await setup();
    await db.update(groups).set({ schoolYear: 2027 }).where(eq(groups.id, s.aGroups[1]!.id));
    let calls = 0;
    const hooks: NotesTestHooks = { afterGroupRead: async () => {
      calls++;
      if (calls === 1) await db.update(students).set({ groupId: s.aGroups[1]!.id }).where(eq(students.id, s.own.id));
    } };
    const created = await createNote(s.actor, s.own.id, payload(), hooks);
    expect(calls).toBe(2);
    expect(created.score).toBe('4.5');
    expect((await db.select().from(academicNotes))[0]!.schoolYear).toBe(2027);
  });

  it('si el cambio persiste tras el segundo intento, 404 neutro', async () => {
    const s = await setup();
    let calls = 0;
    const hooks: NotesTestHooks = { afterGroupRead: async () => {
      calls++;
      await db.update(students).set({ groupId: calls % 2 ? s.aGroups[1]!.id : s.aGroups[0]!.id }).where(eq(students.id, s.own.id));
    } };
    await expect(createNote(s.actor, s.own.id, payload(), hooks)).rejects.toMatchObject({ status: 404 });
    expect(calls).toBe(2);
    expect(await db.select().from(academicNotes)).toHaveLength(0);
  });

  it('alta contra inactivación: la inactivación espera al commit de la alta y no la invalida a mitad', async () => {
    const s = await setup();
    const open = gate();
    let deactivation!: Promise<Response>;
    const hooks: NotesTestHooks = { afterAccess: async () => {
      deactivation = request(`/api/v1/students/${s.own.id}/deactivate`, 'POST', undefined, s.a.teacher);
      expect(await settledWithin(deactivation, 700)).toBe(false); // bloqueada por el estudiante FOR SHARE
      open.release();
    } };
    const created = await createNote(s.actor, s.own.id, payload(), hooks);
    await open.wait();
    expect(created.version).toBe(1);
    expect((await deactivation).status).toBe(200);
    // Después de inactivar, la escritura se rechaza.
    const next = await request(`/api/v1/students/${s.own.id}/academic-notes`, 'POST', { subject: 'MATEMATICAS', term: 1, score: '3.0' }, s.a.teacher);
    expect(next.status).toBe(409);
  });

  it('alta contra cambio de schoolYear: la actualización del curso espera y la nota queda en el año bloqueado', async () => {
    const s = await setup();
    const admin = await login();
    let change!: Promise<Response>;
    const hooks: NotesTestHooks = { afterAccess: async () => {
      change = request(`/api/v1/groups/${s.aGroups[0]!.id}`, 'PATCH', { schoolYear: 2030 }, admin);
      expect(await settledWithin(change, 700)).toBe(false);
    } };
    await createNote(s.actor, s.own.id, payload(), hooks);
    expect((await change).status).toBe(200);
    expect((await db.select().from(academicNotes))[0]!.schoolYear).toBe(2026);
  });

  it('error de bloqueo NOWAIT (55P03) → 503 sin reintento automático y sin escritura', async () => {
    const s = await setup();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const locked = db.transaction(async (tx) => {
      await tx.select().from(user).where(eq(user.id, s.actor.authUserId)).for('update');
      await held;
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const response = await request(`/api/v1/students/${s.own.id}/academic-notes`, 'POST', { subject: 'LENGUAJE', term: 1, score: '4.5' }, s.a.teacher);
    release(); await locked;
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'UNAVAILABLE' });
    expect(await db.select().from(academicNotes)).toHaveLength(0);
  });

  it('reenvío tras commit (respuesta perdida): 409 already_exists, una sola fila, valor intacto', async () => {
    const s = await setup();
    const path = `/api/v1/students/${s.own.id}/academic-notes`;
    expect((await request(path, 'POST', { subject: 'LENGUAJE', term: 1, score: '4.5' }, s.a.teacher)).status).toBe(201);
    const retry = await request(path, 'POST', { subject: 'LENGUAJE', term: 1, score: '4.5' }, s.a.teacher);
    expect(retry.status).toBe(409);
    expect(await db.select({ n: sql<number>`count(*)::int` }).from(academicNotes)).toEqual([{ n: 1 }]);
  });
});
