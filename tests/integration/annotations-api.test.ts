import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { desc, eq, sql } from 'drizzle-orm';
import { academicFixture, login, request, reset } from '../helpers.js';
import { db } from '../../src/db/client.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { teacherAnnotations } from '../../src/db/schema/annotations.js';
import { session } from '../../src/db/schema/auth.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { createStudentAnnotation } from '../../src/modules/seguimiento/annotations/annotations.service.js';

beforeEach(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.pathname !== '/kudlab_annotations_test' || !['127.0.0.1', 'localhost'].includes(url.hostname))
    throw new Error('Annotations destructive tests require their exclusive local test database');
  await reset();
});
const base = '/api/v1/student-annotations';
async function setup() {
  const f = await academicFixture();
  // Raw fixtures are only for the guarded destructive test DB, never delivery activation.
  const [own, inactive, foreign] = await db.insert(students).values([
    { groupId: f.aGroups[0]!.id, studentCode: 'ann-a', firstName: 'Ana', lastName: 'Ficticia', isActive: true },
    { groupId: f.aGroups[0]!.id, studentCode: 'ann-i', firstName: 'Ino', lastName: 'Ficticio', isActive: false },
    { groupId: f.bGroups[0]!.id, studentCode: 'ann-b', firstName: 'Beto', lastName: 'Ficticio', isActive: true },
  ]).returning();
  const [account] = await db.select().from(userAccounts).where(eq(userAccounts.id, f.a.account.id));
  const [current] = await db.select().from(session).where(eq(session.userId, account!.authUserId!)).orderBy(desc(session.createdAt)).limit(1);
  return { ...f, own: own!, inactive: inactive!, foreign: foreign!, actor: { accountId: account!.id, authUserId: account!.authUserId!, sessionId: current!.id } };
}
const list = (studentId: string, query = '') => `${base}?studentId=${studentId}${query}`;

describe('annotations persisted individual source (CA-01/02/03/05/07)', () => {
  it('creates, rereads after fresh login, edits without revisions and deletes with JSON', async () => {
    const f = await setup();
    const response = await request(base, 'POST', { studentId: f.own.id, text: '  Texto\n<script>no HTML</script>  ' }, f.a.teacher);
    expect(response.status).toBe(201); expect(response.headers.get('cache-control')).toBe('no-store');
    const created = await response.json();
    expect(created).toMatchObject({ studentId: f.own.id, author: { id: f.a.account.id, name: 'Docente Test' }, updatedAt: null, canEdit: true, canDelete: true });
    const fresh = await login('teacher-a@pilot.edu.co', 'TeacherPass1');
    expect((await (await request(list(f.own.id), 'GET', undefined, fresh)).json()).items).toEqual([created]);
    const changed = await request(`${base}/${created.id}`, 'PATCH', { text: 'Corregido' }, fresh);
    expect(changed.status).toBe(200); const next = await changed.json();
    expect(next).toMatchObject({ id: created.id, author: created.author, createdAt: created.createdAt, text: 'Corregido' });
    expect(next.updatedAt).not.toBeNull();
    const stored = await db.select().from(teacherAnnotations); expect(stored).toHaveLength(1); expect(stored[0]!.text).toBe('Corregido');
    const removed = await request(`${base}/${created.id}`, 'DELETE', undefined, fresh);
    expect(removed.status).toBe(200); expect(await removed.json()).toEqual({ id: created.id, studentId: f.own.id, deleted: true });
    expect((await (await request(list(f.own.id), 'GET', undefined, fresh)).json()).items).toEqual([]);
    expect((await request(`${base}/${created.id}`, 'DELETE', undefined, fresh)).status).toBe(404);
  });
  it('validates server-side Unicode boundaries, strict payloads and body limit', async () => {
    const f = await setup();
    for (const text of ['', '  ', '\u00a0\u2003\ufeff', 'a'.repeat(1001), '😀'.repeat(1001)])
      expect((await request(base, 'POST', { studentId: f.own.id, text }, f.a.teacher)).status).toBe(400);
    for (const text of ['a'.repeat(1000), '😀'.repeat(1000)])
      expect((await request(base, 'POST', { studentId: f.own.id, text }, f.a.teacher)).status).toBe(201);
    expect((await request(base, 'POST', { studentId: f.own.id, text: 'x', authorAccountId: f.b.account.id }, f.a.teacher)).status).toBe(400);
    expect((await request(base, 'POST', { studentId: f.own.id, text: 'x'.repeat(17000) }, f.a.teacher)).status).toBe(413);
    expect((await request(`${base}?x=1`, 'POST', { studentId: f.own.id, text: 'x' }, f.a.teacher)).status).toBe(400);
    expect(await db.select().from(teacherAnnotations)).toHaveLength(2);
  });
  it('database enforces Unicode nonblank and length independently, with restrictive FKs', async () => {
    const f = await setup();
    for (const text of ['', '\t\n', '\u00a0\u2003\ufeff', 'a'.repeat(1001)])
      await expect(db.insert(teacherAnnotations).values({ studentId: f.own.id, authorAccountId: f.a.account.id, text })).rejects.toThrow();
    await db.insert(teacherAnnotations).values({ studentId: f.own.id, authorAccountId: f.a.account.id, text: '😀'.repeat(1000) });
    await expect(db.delete(students).where(eq(students.id, f.own.id))).rejects.toThrow();
    const tables = await db.execute(sql`select table_name from information_schema.tables where table_schema='public' and table_name like '%annotation%'`);
    expect(tables.rows.map(row => row.table_name)).toEqual(['teacher_annotations']);
  });
  it('pages tied dates by ID, preserves all rows, rejects foreign cursors and unknown/repeated query', async () => {
    const f = await setup();
    await db.insert(teacherAnnotations).values([1, 2, 3].map(n => ({ studentId: f.own.id, authorAccountId: f.a.account.id, text: `Fila ${n}`, createdAt: new Date('2026-11-10T00:00:00Z') })));
    const first = await (await request(list(f.own.id, '&limit=2'), 'GET', undefined, f.a.teacher)).json();
    expect(first.items).toHaveLength(2); expect(first.nextCursor).toBeTypeOf('string');
    const second = await (await request(list(f.own.id, `&limit=2&cursor=${first.nextCursor}`), 'GET', undefined, f.a.teacher)).json();
    expect(second.items).toHaveLength(1); expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map(row => row.id)).size).toBe(3);
    expect((await request(list(f.inactive.id, `&cursor=${first.nextCursor}`), 'GET', undefined, f.a.teacher)).status).toBe(400);
    for (const query of ['&x=1', '&limit=1&limit=2', '&cursor=bad']) expect((await request(list(f.own.id, query), 'GET', undefined, f.a.teacher)).status).toBe(400);
  });
  it('does not lose PostgreSQL microseconds between pages with the same DTO millisecond', async () => {
    const f = await setup();
    await db.insert(teacherAnnotations).values([
      { studentId: f.own.id, authorAccountId: f.a.account.id, text: 'Más reciente', createdAt: sql`'2026-11-10T00:00:00.000999Z'::timestamptz` },
      { studentId: f.own.id, authorAccountId: f.a.account.id, text: 'Anterior', createdAt: sql`'2026-11-10T00:00:00.000111Z'::timestamptz` },
    ]);
    const first = await (await request(list(f.own.id, '&limit=1'), 'GET', undefined, f.a.teacher)).json();
    const next = await (await request(list(f.own.id, `&limit=1&cursor=${first.nextCursor}`), 'GET', undefined, f.a.teacher)).json();
    expect(first.items[0].text).toBe('Más reciente'); expect(next.items[0].text).toBe('Anterior'); expect(next.nextCursor).toBeNull();
  });
});

describe('annotations authority and race safety (CA-04/06/07/08)', () => {
  it('denies absent session, ADMIN, foreign student and malformed/absent IDs without changing records', async () => {
    const f = await setup(); const admin = await login();
    const row = await (await request(base, 'POST', { studentId: f.own.id, text: 'Protegido' }, f.a.teacher)).json();
    expect((await request(list(f.own.id), 'GET')).status).toBe(401);
    expect((await request(list(f.own.id), 'GET', undefined, admin)).status).toBe(403);
    const bodies = [];
    for (const id of [f.own.id, randomUUID(), 'bad']) {
      const r = await request(list(id), 'GET', undefined, f.b.teacher); expect(r.status).toBe(404); bodies.push(await r.json());
    }
    expect(bodies[0]).toEqual(bodies[1]); expect(bodies[1]).toEqual(bodies[2]);
    for (const [method, body] of [['PATCH', { text: 'Ajeno' }], ['DELETE', undefined]] as const)
      expect((await request(`${base}/${row.id}`, method, body, f.b.teacher)).status).toBe(404);
    expect((await request(base, 'POST', { studentId: f.own.id, text: 'Ajeno' }, f.b.teacher)).status).toBe(404);
    expect((await db.select().from(teacherAnnotations))[0]!.text).toBe('Protegido');
  });
  it('new responsible reads previous authors but cannot edit/delete; former author loses scope', async () => {
    const f = await setup();
    const row = await (await request(base, 'POST', { studentId: f.own.id, text: 'Original A' }, f.a.teacher)).json();
    await db.update(groups).set({ teacherId: f.b.account.id }).where(eq(groups.id, f.own.groupId));
    const seen = await (await request(list(f.own.id), 'GET', undefined, f.b.teacher)).json();
    expect(seen.items[0]).toMatchObject({ author: row.author, canEdit: false, canDelete: false });
    for (const [method, body] of [['PATCH', { text: 'No' }], ['DELETE', undefined]] as const) {
      const denied = await request(`${base}/${row.id}`, method, body, f.b.teacher);
      expect(denied.status).toBe(409); expect((await denied.json()).fields).toEqual([{ field: 'operation', reason: 'NOT_AUTHOR' }]);
      expect((await request(`${base}/${row.id}`, method, body, f.a.teacher)).status).toBe(404);
    }
    expect((await request(list(f.own.id), 'GET', undefined, f.a.teacher)).status).toBe(404);
    expect((await request(base, 'POST', { studentId: f.own.id, text: 'No' }, f.a.teacher)).status).toBe(404);
  });
  it('inactive retains history; all three writes fail even from an earlier open screen', async () => {
    const f = await setup();
    const row = await (await request(base, 'POST', { studentId: f.own.id, text: 'Conservar' }, f.a.teacher)).json();
    const deactivated = await request(`/api/v1/students/${f.own.id}/deactivate`, 'POST', undefined, f.a.teacher); expect(deactivated.status).toBe(200);
    for (const [path, method, body] of [[base, 'POST', { studentId: f.own.id, text: 'No' }], [`${base}/${row.id}`, 'PATCH', { text: 'No' }], [`${base}/${row.id}`, 'DELETE', undefined]] as const) {
      const result = await request(path, method, body, f.a.teacher); expect(result.status).toBe(409);
      expect((await result.json()).fields).toEqual([{ field: 'operation', reason: 'STUDENT_INACTIVE' }]);
    }
    const seen = await (await request(list(f.own.id), 'GET', undefined, f.a.teacher)).json();
    expect(seen).toMatchObject({ isActive: false, canCreate: false }); expect(seen.items[0]).toMatchObject({ text: 'Conservar', canEdit: false, canDelete: false });
  });
  it('transfer or inactivation confirmed between resolution and lock rejects the write', async () => {
    const f = await setup();
    await expect(createStudentAnnotation(f.actor, { studentId: f.own.id, text: 'No' }, {
      afterGroupRead: async () => { await db.update(students).set({ isActive: false }).where(eq(students.id, f.own.id)); },
    })).rejects.toMatchObject({ status: 409 });
    // Restore only this raw fixture in the exclusive destructive test DB for the independent transfer branch.
    await db.update(students).set({ isActive: true }).where(eq(students.id, f.own.id));
    await expect(createStudentAnnotation(f.actor, { studentId: f.own.id, text: 'No' }, {
      afterGroupRead: async () => { await db.update(groups).set({ teacherId: f.b.account.id }).where(eq(groups.id, f.own.groupId)); },
    })).rejects.toMatchObject({ status: 404 });
    expect(await db.select().from(teacherAnnotations)).toHaveLength(0);
  });
  it('holds the student write lock until commit and rolls back on final operation failure', async () => {
    const f = await setup();
    const created = await createStudentAnnotation(f.actor, { studentId: f.own.id, text: 'Antes de inactivar' }, { afterAccess: async () => {
      await expect(db.transaction(async tx => {
        await tx.select().from(students).where(eq(students.id, f.own.id)).for('update', { noWait: true });
      })).rejects.toThrow();
    } });
    expect(created.text).toBe('Antes de inactivar');
    await expect(createStudentAnnotation(f.actor, { studentId: f.own.id, text: 'No parcial' }, { afterAccess: async () => { throw new Error('synthetic operation failure'); } })).rejects.toThrow('synthetic operation failure');
    expect(await db.select().from(teacherAnnotations)).toHaveLength(1);
    await db.update(session).set({ expiresAt: new Date(0) }).where(eq(session.id, f.actor.sessionId));
    await expect(createStudentAnnotation(f.actor, { studentId: f.own.id, text: 'No sesión' })).rejects.toMatchObject({ status: 401 });
    expect(await db.select().from(teacherAnnotations)).toHaveLength(1);
  });
  it('rolls back an inserted annotation if final session acceptance expires (no partial write)', async () => {
    const f = await setup();
    try {
      await expect(createStudentAnnotation(f.actor, { studentId: f.own.id, text: 'Debe revertirse' }, {
        afterAccess: async () => { vi.setSystemTime(new Date(Date.now() + 366 * 24 * 60 * 60 * 1000)); },
      })).rejects.toMatchObject({ status: 401 });
    } finally { vi.useRealTimers(); }
    expect(await db.select().from(teacherAnnotations)).toHaveLength(0);
  });
});
