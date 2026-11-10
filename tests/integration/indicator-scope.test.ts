import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { groups, students } from '../../src/db/schema/academic.js';
import { reset, request } from '../helpers.js';
import { indicatorWorld, runSession } from '../indicator-fixture.js';

const counts = async () => (await db.execute(sql`select (select count(*) from task_sessions)::int s, (select count(*) from indicator_calculation_runs)::int r, (select count(*) from calculated_indicators)::int i, (select count(*) from task_assignments)::int a`)).rows[0];
async function setup() {
  const w = await indicatorWorld();
  const ids = [(await runSession(w, { startedAt: new Date('2026-03-02T15:00:00Z') })).sessionId, (await runSession(w, { startedAt: new Date('2026-04-10T15:00:00Z') })).sessionId];
  const history = async (who: Record<string, string>) => request(`/api/v1/students/${w.f.student.id}/indicator-history`, 'GET', undefined, who);
  const detail = (id: string, who: Record<string, string>) => request(`/api/v1/task-sessions/${id}`, 'GET', undefined, who);
  return { w, ids, history, detail };
}
describe('ámbito de la historia: traslado, responsable, inactivo y no escritura (T-B04)', () => {
  beforeEach(async () => { await reset(); });
  afterAll(async () => { await reset(); });

  it('consultar varias veces, con y sin filtros, no crea ni cambia filas (CA-10)', async () => {
    const x = await setup(), before = await counts();
    for (const q of ['', '?scope=SESSION', '?from=2026-03-01&to=2026-03-31', '?metricCode=rt_cv_pct']) await request(`/api/v1/students/${x.w.f.student.id}/indicator-history${q}`, 'GET', undefined, x.w.f.a.teacher);
    await request('/api/v1/indicator-definitions', 'GET', undefined, x.w.f.a.teacher);
    expect(await counts()).toEqual(before);
  });
  it('estudiante inactivo: la historia se conserva igual y sin marcas de consentimiento (CA-11, D-5)', async () => {
    const x = await setup(), before = await (await x.history(x.w.f.a.teacher)).json();
    await db.update(students).set({ isActive: false }).where(eq(students.id, x.w.f.student.id));
    const after = await x.history(x.w.f.a.teacher);
    expect(after.status).toBe(200); expect(await after.json()).toEqual(before);
    expect(JSON.stringify(before)).not.toMatch(/consent/i);
  });
  it('traslado a otro curso/docente: historia conservada para el actual, sin abrir detalles de origen ni exponer el curso (CA-12)', async () => {
    const x = await setup();
    await db.update(students).set({ groupId: x.w.f.bGroups[0]!.id }).where(eq(students.id, x.w.f.student.id));
    const asB = await x.history(x.w.f.b.teacher), body = await asB.json();
    expect(asB.status).toBe(200); expect(body.items.map((i: { sessionId: string }) => i.sessionId)).toEqual([x.ids[1], x.ids[0]]);
    expect(body.items.every((i: { detailAccess: string }) => i.detailAccess === 'UNAVAILABLE')).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/assignment|groupId|"A1"|"B1"/i);
    expect((await x.history(x.w.f.a.teacher)).status).toBe(404);
    for (const id of x.ids) expect((await x.detail(id, x.w.f.b.teacher)).status).toBe(404);
  });
  it('mismo curso con nuevo responsable: historia y detalle abren con normalidad (CA-12, caso 2)', async () => {
    const x = await setup();
    await db.update(groups).set({ teacherId: x.w.f.b.account.id }).where(eq(groups.id, x.w.f.student.groupId));
    const asB = await x.history(x.w.f.b.teacher), body = await asB.json();
    expect(asB.status).toBe(200); expect(body.items.every((i: { detailAccess: string }) => i.detailAccess === 'AVAILABLE')).toBe(true);
    for (const id of x.ids) expect((await x.detail(id, x.w.f.b.teacher)).status).toBe(200);
    expect((await x.history(x.w.f.a.teacher)).status).toBe(404);
  });
  it('paridad: detailAccess coincide con poder abrir GET /task-sessions/{id} en cada caso', async () => {
    const x = await setup();
    const parity = async (who: Record<string, string>) => {
      const body = await (await x.history(who)).json();
      for (const item of body.items) expect((await x.detail(item.sessionId, who)).status === 200, item.sessionId).toBe(item.detailAccess === 'AVAILABLE');
    };
    await parity(x.w.f.a.teacher);
    await db.update(students).set({ groupId: x.w.f.bGroups[0]!.id }).where(eq(students.id, x.w.f.student.id));
    await parity(x.w.f.b.teacher);
  });
});
