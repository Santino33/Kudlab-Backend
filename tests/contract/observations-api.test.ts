import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readContract, assertResponse } from '../openapi.helpers.js';
import { reset } from '../helpers.js';
import { assertObservationTestDatabase, observationFixture } from '../observations-fixture.js';
import * as consent from '../../src/modules/academico/consents/consent-decision.js';

beforeEach(async () => { assertObservationTestDatabase(); await reset(); });
afterEach(() => vi.restoreAllMocks());
it('T-08/CA-01/03/04/07: cinco operaciones montadas, recibos y respuestas contra OpenAPI', async () => {
  const f = await observationFixture(), doc = readContract(); await f.activate();
  const base = `/api/v1/students/${f.student.id}/observations`, path = '/api/v1/students/{id}/observations';
  const write = (url: string, body: unknown) => f.app.request(url, { method: 'POST', headers: f.headers, body: JSON.stringify(body) });
  const check = async (url: string, method: string, res: Response, status: number) => {
    expect(res.status, `${method} ${url}`).toBe(status);
    expect(res.headers.get('cache-control')).toBe('no-store');
    return assertResponse(doc, url, method, res);
  };
  const input = f.input();
  const first = await check(path, 'POST', await write(base, input), 201);
  expect((await check(path, 'POST', await write(base, input), 200)).receipt).toEqual(first.receipt);
  const h = await check(path, 'GET', await f.app.request(`${base}?schoolYear=2025&area=UNSPECIFIED&limit=1`, { headers: f.headers }), 200);
  expect(h.items[0].id).toBe(first.receipt.observationId);
  const rev = `${base}/${first.receipt.observationId}/revisions`, revPath = `${path}/{observationId}/revisions`;
  const correction = { ...input, requestId: randomUUID(), expectedVersion: 1, frequency: 'ALWAYS' };
  await check(revPath, 'POST', await write(rev, correction), 201);
  await check(revPath, 'POST', await write(rev, correction), 200);
  const revisions = await check(revPath, 'GET', await f.app.request(`${rev}?limit=1`, { headers: f.headers }), 200);
  expect(revisions.items[0].version).toBe(1); expect(revisions.nextCursor).toBeTruthy();
  await check(revPath, 'GET', await f.app.request(`${rev}?cursor=${revisions.nextCursor}`, { headers: f.headers }), 200);
  await check(revPath, 'POST', await write(rev, { ...correction, requestId: randomUUID() }), 409);
  await check(path, 'POST', await write(base, { ...input, frequency: 'NEVER' }), 409);
  const receipts = `/api/v1/students/${f.student.id}/observation-requests/`, receiptPath = '/api/v1/students/{id}/observation-requests/{requestId}';
  await check(receiptPath, 'GET', await f.app.request(receipts + input.requestId, { headers: f.headers }), 200);
  expect((await check(receiptPath, 'GET', await f.app.request(receipts + randomUUID(), { headers: f.headers }), 200)).receipt).toBeNull();
  for (const body of [{ ...f.input(), frequency: 0 }, { ...f.input(), actorId: randomUUID() }, { ...f.input(), term: 5 }, {}])
    await check(path, 'POST', await write(base, body), 400);
  for (const suffix of ['?other=x', '?limit=1&limit=2', '?cursor=bad', '?observedFrom=2026-01-03&observedTo=2026-01-02'])
    await check(path, 'GET', await f.app.request(base + suffix, { headers: f.headers }), 400);
  await check(path, 'POST', await write(base + '?limit=1', f.input()), 400);
  await check(revPath, 'GET', await f.app.request(rev + '?schoolYear=2026', { headers: f.headers }), 400);
  await check(receiptPath, 'GET', await f.app.request(receipts + input.requestId + '?other=x', { headers: f.headers }), 400);
  vi.spyOn(consent, 'readConsentDecision').mockResolvedValueOnce({ kind: 'unavailable' });
  await check(path, 'POST', await write(base, f.input()), 503);
});
it('T-08/CA-08: guardias de los cinco endpoints, neutralidad de ámbito y regresión CRUD/indicadores', async () => {
  const f = await observationFixture();
  const base = `/api/v1/students/${f.student.id}/observations`, id = randomUUID();
  const cases = [['GET', base], ['POST', base], ['GET', `${base}/${id}/revisions`], ['POST', `${base}/${id}/revisions`],
    ['GET', `/api/v1/students/${f.student.id}/observation-requests/${id}`]];
  for (const [method, url] of cases) {
    const body = method === 'POST' ? JSON.stringify({ ...f.input(), ...(url!.endsWith('/revisions') ? { expectedVersion: 1 } : {}) }) : undefined;
    for (const [auth, status] of [[{}, 401], [f.a.admin, 403], [f.b.teacher, 404]] as const)
      expect((await f.app.request(url!, { method, headers: { ...auth, origin: process.env.SPA_ORIGIN!, 'content-type': 'application/json' }, body })).status).toBe(status);
  }
  const own = await f.app.request(base, { headers: f.headers });
  expect(own.status).toBe(200); expect((await own.json()).items).toEqual([]);
  expect((await f.app.request(base, { method: 'POST', headers: { ...f.headers, origin: 'https://other.invalid' }, body: JSON.stringify(f.input()) })).status).toBe(403);
  expect((await f.app.request(`/api/v1/students/${f.student.id}?other=x`, { headers: f.headers })).status).toBe(400);
  expect((await f.app.request(`/api/v1/students/${f.student.id}`, { headers: f.headers })).status).toBe(200);
  expect((await f.app.request(`/api/v1/students/${f.student.id}/indicator-history?limit=1`, { headers: f.headers })).status).toBe(200);
});
