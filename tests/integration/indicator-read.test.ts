import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { reset, request } from '../helpers.js';
import { indicatorWorld, runSession } from '../indicator-fixture.js';
import { assertResponse, readContract } from '../openapi.helpers.js';
import { indicatorDefinitionsResponseSchema, indicatorHistoryResponseSchema } from '../../src/modules/evolucion/read/dto.js';

const dates = ['2026-03-02T15:00:00Z', '2026-04-10T15:00:00Z', '2026-05-20T15:00:00Z'].map(d => new Date(d));
async function setup() {
  const w = await indicatorWorld();
  const ids = [(await runSession(w, { startedAt: dates[0]! })).sessionId, (await runSession(w, { startedAt: dates[1]! })).sessionId, (await runSession(w, { startedAt: dates[2]! })).sessionId];
  const get = (path: string, headers?: Record<string, string>) => request(path, 'GET', undefined, headers);
  return { w, ids, studentId: w.f.student.id, a: w.f.a.teacher, b: w.f.b.teacher, admin: w.f.a.admin, history: (q = '', who: Record<string, string> | undefined = w.f.a.teacher, id = w.f.student.id) => get(`/api/v1/students/${id}/indicator-history${q}`, who), get };
}
const contract = readContract();
describe('lecturas HTTP de indicadores (T-B01/T-B02)', () => {
  beforeEach(async () => { await reset(); });
  afterAll(async () => { await reset(); });

  it('catálogo: TEACHER ve seis indicadores sin caché; ADMIN 403; sin sesión 401; con query 400', async () => {
    const x = await setup();
    const ok = await x.get('/api/v1/indicator-definitions', x.a);
    expect(ok.status).toBe(200); expect(ok.headers.get('cache-control')).toBe('no-store');
    await assertResponse(contract, '/api/v1/indicator-definitions', 'get', ok.clone());
    const body = await ok.json(); expect(indicatorDefinitionsResponseSchema.safeParse(body).success).toBe(true); expect(body.items).toHaveLength(6);
    expect((await x.get('/api/v1/indicator-definitions', x.admin)).status).toBe(403);
    expect((await x.get('/api/v1/indicator-definitions')).status).toBe(401);
    expect((await x.get('/api/v1/indicator-definitions?x=1', x.a)).status).toBe(400);
  });
  it('historia: forma válida, orden descendente, sin asignación ni curso y sin caché', async () => {
    const x = await setup(), r = await x.history('?limit=25');
    expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('no-store');
    await assertResponse(contract, '/api/v1/students/{id}/indicator-history', 'get', r.clone());
    const body = await r.json(); expect(indicatorHistoryResponseSchema.safeParse(body).success).toBe(true);
    expect(body.studentId).toBe(x.studentId); expect(body.items.map((i: { sessionId: string }) => i.sessionId)).toEqual([x.ids[2], x.ids[1], x.ids[0]]);
    expect(body.items.every((i: { detailAccess: string }) => i.detailAccess === 'AVAILABLE')).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/assignment|groupId|approvalReference/i);
  });
  it('filtros: indicador, alcance y fechas de Bogotá (hasta inclusivo)', async () => {
    const x = await setup();
    const day = async (q: string) => (await (await x.history(q)).json()).items.map((i: { sessionId: string }) => i.sessionId);
    expect(await day('?from=2026-04-10&to=2026-04-10')).toEqual([x.ids[1]]);
    expect(await day('?from=2026-03-03&to=2026-05-19')).toEqual([x.ids[1]]);
    expect(await day('?from=2027-01-01')).toEqual([]);
    const narrow = (await (await x.history('?metricCode=omission_rate_pct&scope=SEGMENT_2')).json()).items[0];
    expect(narrow.indicators.map((i: { metricCode: string; scope: string }) => `${i.metricCode}:${i.scope}`)).toEqual(['omission_rate_pct:SEGMENT_2']);
  });
  it('parámetros inválidos → 400 sin fields', async () => {
    const x = await setup();
    for (const q of ['?x=1', '?from=2026-02-30', '?from=2026-04-02&to=2026-04-01', '?metricCode=iq', '?scope=SEGMENT_9', '?taskId=TG-02', '?limit=0', '?limit=101', '?limit=1&limit=2', '?cursor=zzz']) {
      const r = await x.history(q); await assertResponse(contract, '/api/v1/students/{id}/indicator-history', 'get', r.clone()); expect(r.status, q).toBe(400); expect(await r.json()).toEqual({ code: 'INVALID_INPUT', message: 'Datos inválidos' });
    }
  });
  it('paginación con cursor ligado: sin repetir ni omitir y rechazo de cursor de otros filtros', async () => {
    const x = await setup(), first = await (await x.history('?limit=2')).json();
    expect(first.items).toHaveLength(2); expect(first.nextCursor).toBeTruthy();
    const second = await (await x.history(`?limit=2&cursor=${encodeURIComponent(first.nextCursor)}`)).json();
    expect([...first.items, ...second.items].map((i: { sessionId: string }) => i.sessionId)).toEqual([x.ids[2], x.ids[1], x.ids[0]]); expect(second.nextCursor).toBeNull();
    expect((await x.history(`?limit=2&scope=SESSION&cursor=${encodeURIComponent(first.nextCursor)}`)).status).toBe(400);
  });
  it('ámbito: docente ajeno, inexistente e id inválido dan el mismo 404 neutro; ADMIN 403; sin sesión 401', async () => {
    const x = await setup(), foreign = await x.history('', x.b), missing = await x.history('', x.a, '99999999-9999-4999-8999-999999999999'), bad = await x.history('', x.a, 'abc');
    expect([foreign.status, missing.status, bad.status]).toEqual([404, 404, 404]);
    await assertResponse(contract, '/api/v1/students/{id}/indicator-history', 'get', foreign.clone());
    expect(await foreign.json()).toEqual(await missing.json());
    expect((await x.history('', x.admin)).status).toBe(403); expect((await x.history('', {})).status).toBe(401);
  });
  it('orden de montaje: la historia admite query y el CRUD de estudiantes no regresiona', async () => {
    const x = await setup();
    expect((await x.history('?limit=1')).status).toBe(200);
    expect((await x.get(`/api/v1/students/${x.studentId}`, x.a)).status).toBe(200);
    expect((await x.get(`/api/v1/students/${x.studentId}?x=1`, x.a)).status).toBe(400);
    expect((await x.get('/api/v1/students', x.a)).status).toBe(200);
  });
});
