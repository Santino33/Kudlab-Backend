import { beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { academicFixture, login, request, reset } from '../helpers.js';
import { db } from '../../src/db/client.js';
import { students } from '../../src/db/schema/academic.js';
import { academicNotes, academicNoteRevisions } from '../../src/db/schema/academic-notes.js';

beforeEach(reset);

async function setup() {
  const f = await academicFixture();
  const [own, inactive, foreign] = await db.insert(students).values([
    { groupId: f.aGroups[0]!.id, studentCode: 'n-a1', firstName: 'Ana', lastName: 'Ficticia', isActive: true },
    { groupId: f.aGroups[1]!.id, studentCode: 'n-a2', firstName: 'Ino', lastName: 'Ficticio', isActive: false },
    { groupId: f.bGroups[0]!.id, studentCode: 'n-b1', firstName: 'Beto', lastName: 'Ficticio', isActive: true },
  ]).returning();
  return { ...f, own: own!, inactive: inactive!, foreign: foreign! };
}
const notes = (id: string) => `/api/v1/students/${id}/academic-notes`;
const body = { subject: 'LENGUAJE', term: 1, score: '4.5' };

describe('notas · registro y consulta (CA-01, 02, 07)', () => {
  it('registra con autor y año del curso, y consulta solo el año actual', async () => {
    const s = await setup();
    const created = await request(notes(s.own.id), 'POST', body, s.a.teacher);
    expect(created.status).toBe(201);
    expect(created.headers.get('cache-control')).toBe('no-store');
    const note = await created.json();
    expect(note).toMatchObject({ subject: 'LENGUAJE', term: 1, score: '4.5', version: 1, authorName: 'Docente Test' });
    expect(note.revisions).toHaveLength(1);
    expect(Object.keys(note).sort()).toEqual(['authorName', 'id', 'revisions', 'score', 'subject', 'term', 'updatedAt', 'version']);
    // Nota histórica de otro año: se conserva pero no se muestra.
    await db.insert(academicNotes).values({ studentId: s.own.id, subject: 'MATEMATICAS', schoolYear: 2025, term: 2, score: '3.0', authorId: s.a.account.id });
    const list = await (await request(notes(s.own.id), 'GET', undefined, s.a.teacher)).json();
    expect(list.schoolYear).toBe(2026);
    expect(list.items.map((n: { id: string }) => n.id)).toEqual([note.id]);
  });
  it('áreas y periodos son independientes y «4» se normaliza a «4.0»', async () => {
    const s = await setup();
    for (const [subject, term] of [['LENGUAJE', 1], ['MATEMATICAS', 1], ['LENGUAJE', 2]] as const)
      expect((await request(notes(s.own.id), 'POST', { subject, term, score: '4' }, s.a.teacher)).status).toBe(201);
    const list = await (await request(notes(s.own.id), 'GET', undefined, s.a.teacher)).json();
    expect(list.items).toHaveLength(3);
    expect(list.items.every((n: { score: string }) => n.score === '4.0')).toBe(true);
  });
  it('lista vacía permitida (no equivale a cero)', async () => {
    const s = await setup();
    expect(await (await request(notes(s.own.id), 'GET', undefined, s.a.teacher)).json()).toEqual({ schoolYear: 2026, items: [] });
  });
});

describe('notas · validación (CA-03, CA-04)', () => {
  it.each([['0.9', 'out_of_range'], ['5.1', 'out_of_range'], ['4.25', 'too_many_decimals'], ['4,5', 'invalid_format'], ['abc', 'invalid_format'], ['', 'required']])(
    'rechaza %j con fields cerrados', async (score, reason) => {
      const s = await setup();
      const res = await request(notes(s.own.id), 'POST', { ...body, score }, s.a.teacher);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ code: 'INVALID_INPUT', message: 'Datos inválidos', fields: [{ field: 'score', reason }] });
    });
  it.each(['1.0', '5.0', '5', '1'])('acepta el límite %s', async (score) => {
    const s = await setup();
    expect((await request(notes(s.own.id), 'POST', { ...body, score }, s.a.teacher)).status).toBe(201);
  });
  it('campos obligatorios, claves desconocidas y consultas', async () => {
    const s = await setup();
    const empty = await (await request(notes(s.own.id), 'POST', {}, s.a.teacher)).json();
    expect(empty.fields.map((f: { field: string }) => f.field)).toEqual(['subject', 'term', 'score']);
    expect((await request(notes(s.own.id), 'POST', { ...body, extra: 1 }, s.a.teacher)).status).toBe(400);
    expect((await request(`${notes(s.own.id)}?x=1`, 'GET', undefined, s.a.teacher)).status).toBe(400);
    expect((await request(`${notes(s.own.id)}?x=1`, 'GET')).status).toBe(401);
  });
});

describe('notas · unicidad, actualización y trazabilidad (CA-05, CA-06)', () => {
  it('duplicado → 409 note:already_exists y doble envío simultáneo sin duplicados', async () => {
    const s = await setup();
    const results = await Promise.all([1, 2].map(() => request(notes(s.own.id), 'POST', body, s.a.teacher)));
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const conflict = await (results.find((r) => r.status === 409)!).json();
    expect(conflict).toEqual({ code: 'CONFLICT', message: 'Conflicto con el estado actual', fields: [{ field: 'note', reason: 'already_exists' }] });
    expect(await db.select().from(academicNotes).where(eq(academicNotes.studentId, s.own.id))).toHaveLength(1);
  });
  it('actualización explícita con versión, revisión y reintento idempotente', async () => {
    const s = await setup();
    const note = await (await request(notes(s.own.id), 'POST', body, s.a.teacher)).json();
    const path = `${notes(s.own.id)}/${note.id}`;
    const changed = await request(path, 'PATCH', { score: '3.0', expectedVersion: 1 }, s.a.teacher);
    expect(changed.status).toBe(200);
    const next = await changed.json();
    expect(next).toMatchObject({ score: '3.0', version: 2 });
    expect(next.revisions.map((r: { score: string }) => r.score)).toEqual(['4.5', '3.0']);
    // Mismo valor: 200 sin nueva revisión.
    expect((await request(path, 'PATCH', { score: '3.0', expectedVersion: 1 }, s.a.teacher)).status).toBe(200);
    expect(await db.select().from(academicNoteRevisions).where(eq(academicNoteRevisions.noteId, note.id))).toHaveLength(2);
    // Versión desactualizada con otro valor: 409 y sin sobrescribir.
    const stale = await request(path, 'PATCH', { score: '2.0', expectedVersion: 1 }, s.a.teacher);
    expect(stale.status).toBe(409);
    expect((await stale.json()).fields).toEqual([{ field: 'version', reason: 'stale' }]);
    expect((await db.select().from(academicNotes).where(eq(academicNotes.id, note.id)))[0]!.score).toBe('3.0');
    expect((await request(path, 'PATCH', { score: '2.0' }, s.a.teacher)).status).toBe(400);
  });
  it('no existe vía de borrado', async () => {
    const s = await setup();
    const note = await (await request(notes(s.own.id), 'POST', body, s.a.teacher)).json();
    expect([404, 405]).toContain((await request(`${notes(s.own.id)}/${note.id}`, 'DELETE', undefined, s.a.teacher)).status);
    expect(await db.select().from(academicNotes)).toHaveLength(1);
  });
});

describe('notas · permisos y ámbito (CA-08, CA-09, CA-13)', () => {
  it('ajeno, ausente y mal formado → 404 neutro; ADMIN 403; sin sesión 401', async () => {
    const s = await setup();
    const admin = await login();
    const note = await (await request(notes(s.own.id), 'POST', body, s.a.teacher)).json();
    const bodies = [];
    for (const id of [s.own.id, randomUUID(), 'bad']) {
      const res = await request(notes(id), 'GET', undefined, s.b.teacher); expect(res.status).toBe(404); bodies.push(await res.json());
    }
    expect(bodies[0]).toEqual(bodies[1]); expect(bodies[1]).toEqual(bodies[2]);
    expect((await request(notes(s.own.id), 'POST', body, s.b.teacher)).status).toBe(404);
    expect((await request(`${notes(s.own.id)}/${note.id}`, 'PATCH', { score: '3.0', expectedVersion: 1 }, s.b.teacher)).status).toBe(404);
    expect((await request(notes(s.own.id), 'GET', undefined, admin)).status).toBe(403);
    expect((await request(notes(s.own.id), 'GET')).status).toBe(401);
  });
  it('una nota de otro estudiante u otro año no se actualiza por ID → 404', async () => {
    const s = await setup();
    const [second] = await db.insert(students).values({ groupId: s.aGroups[0]!.id, studentCode: 'n-a3', firstName: 'Eva', lastName: 'Ficticia', isActive: true }).returning();
    const note = await (await request(notes(second!.id), 'POST', body, s.a.teacher)).json();
    expect((await request(`${notes(s.own.id)}/${note.id}`, 'PATCH', { score: '3.0', expectedVersion: 1 }, s.a.teacher)).status).toBe(404);
    const [old] = await db.insert(academicNotes).values({ studentId: s.own.id, subject: 'LENGUAJE', schoolYear: 2025, term: 3, score: '3.0', authorId: s.a.account.id }).returning();
    expect((await request(`${notes(s.own.id)}/${old!.id}`, 'PATCH', { score: '4.0', expectedVersion: 1 }, s.a.teacher)).status).toBe(404);
  });
  it('estudiante inactivo: se consulta, no se escribe (409 student:inactive)', async () => {
    const s = await setup();
    const [seed] = await db.insert(academicNotes).values({ studentId: s.inactive.id, subject: 'LENGUAJE', schoolYear: 2026, term: 1, score: '4.0', authorId: s.a.account.id }).returning();
    await db.insert(academicNoteRevisions).values({ noteId: seed!.id, version: 1, score: '4.0', authorId: s.a.account.id });
    expect((await request(notes(s.inactive.id), 'GET', undefined, s.a.teacher)).status).toBe(200);
    const created = await request(notes(s.inactive.id), 'POST', { ...body, term: 2 }, s.a.teacher);
    expect(created.status).toBe(409);
    expect((await created.json()).fields).toEqual([{ field: 'student', reason: 'inactive' }]);
    const patched = await request(`${notes(s.inactive.id)}/${seed!.id}`, 'PATCH', { score: '5.0', expectedVersion: 1 }, s.a.teacher);
    expect(patched.status).toBe(409);
  });
  it('cambio de responsable por ADMIN: el nuevo ve y edita, el anterior 404, autoría conservada (CA-09)', async () => {
    const s = await setup();
    const admin = await login();
    const note = await (await request(notes(s.own.id), 'POST', body, s.a.teacher)).json();
    const moved = await request(`/api/v1/groups/${s.aGroups[0]!.id}`, 'PATCH', { teacherId: s.b.account.id, confirmTransfer: true }, admin);
    expect(moved.status).toBe(200);
    expect((await request(notes(s.own.id), 'GET', undefined, s.a.teacher)).status).toBe(404);
    expect((await request(`${notes(s.own.id)}/${note.id}`, 'PATCH', { score: '3.0', expectedVersion: 1 }, s.a.teacher)).status).toBe(404);
    const seen = await (await request(notes(s.own.id), 'GET', undefined, s.b.teacher)).json();
    expect(seen.items[0]).toMatchObject({ id: note.id, authorName: 'Docente Test' });
    const edited = await request(`${notes(s.own.id)}/${note.id}`, 'PATCH', { score: '3.5', expectedVersion: 1 }, s.b.teacher);
    expect(edited.status).toBe(200);
    expect((await edited.json()).revisions).toHaveLength(2);
  });
  it('el CRUD de estudiantes conserva su contrato', async () => {
    const s = await setup();
    expect((await request(`/api/v1/students/${s.own.id}`, 'GET', undefined, s.a.teacher)).status).toBe(200);
    expect((await request('/api/v1/students?x=1', 'GET', undefined, s.a.teacher)).status).toBe(400);
    expect((await request(`/api/v1/students/${s.own.id}`, 'GET', undefined, s.b.teacher)).status).toBe(404);
  });
});
