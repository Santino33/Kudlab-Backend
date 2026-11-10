import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { bogotaToday, observationFingerprint, parseObservation, parseObservationQuery, readObservation } from '../../src/modules/seguimiento/observations/observations.validation.js';
import { ObservationError } from '../../src/modules/seguimiento/observations/observations.errors.js';

const valid = () => ({ requestId: randomUUID(), behavior: 'ATTENTION', frequency: 'SOMETIMES', observedOn: '2024-02-29', schoolYear: 2025, term: 4 });
it('CA-01/02/06: catálogos cerrados, año manual y área nula normalizada', () => {
  const v = valid();
  expect(parseObservation(v)).toMatchObject({ area: null, schoolYear: 2025 });
  for (const behavior of ['ATTENTION', 'FOLLOWING_INSTRUCTIONS'])
    for (const frequency of ['NEVER', 'SOMETIMES', 'ALMOST_ALWAYS', 'ALWAYS'])
      expect(parseObservation({ ...v, behavior, frequency })).toMatchObject({ behavior, frequency });
  for (const area of [undefined, null, 'LANGUAGE_READING', 'MATHEMATICS']) expect(() => parseObservation({ ...v, area })).not.toThrow();
  for (const schoolYear of [-2147483648, 0, 2147483647]) expect(() => parseObservation({ ...v, schoolYear })).not.toThrow();
  for (const patch of [{ frequency: 0 }, { frequency: 'NO_OPPORTUNITY' }, { area: '' }, { term: 0 }, { term: 5 },
    { schoolYear: 1.5 }, { schoolYear: 2147483648 }, { behavior: 'OTHER' }, { requestId: 'bad' }, { groupId: null },
    { observedOn: '2025-02-29' }, { observedOn: '2024-02-30' }, { authorId: randomUUID() }, { recordedAt: '2026-01-01' }])
    expect(() => parseObservation({ ...v, ...patch })).toThrow(ObservationError);
});
it('CA-06: fecha calendario y frontera del día Bogotá, no UTC', () => {
  const before = new Date('2026-01-02T04:59:59Z'), after = new Date('2026-01-02T05:00:00Z');
  expect(bogotaToday(before)).toBe('2026-01-01');
  expect(bogotaToday(after)).toBe('2026-01-02');
  expect(() => parseObservation({ ...valid(), observedOn: '2026-01-02' }, false, before)).toThrow(ObservationError);
  expect(() => parseObservation({ ...valid(), observedOn: '2026-01-02' }, false, after)).not.toThrow();
});
it('CA-01/04/07: obligatorios, extras sin eco, versión y huella estable por operación/objetivo/contexto', () => {
  const v = valid(), student = randomUUID();
  for (const key of Object.keys(v)) {
    const body: Record<string, unknown> = { ...v }; delete body[key];
    try { parseObservation(body); throw new Error('Accepted'); } catch (error) {
      expect(error).toMatchObject({ status: 400, fields: [{ field: key, reason: 'required' }] });
    }
  }
  expect(() => parseObservation(v, true)).toThrow(ObservationError);
  expect(() => parseObservation({ ...v, expectedVersion: 0 }, true)).toThrow(ObservationError);
  expect(() => parseObservation({ ...v, expectedVersion: 1 }, true)).not.toThrow();
  try { parseObservation({ ...v, arbitrarySecret: 'not echoed' }); } catch (error) {
    expect(error).toMatchObject({ fields: [{ field: 'observation', reason: 'not_allowed' }] });
  }
  const a = parseObservation(v), b = parseObservation({ area: null, ...Object.fromEntries(Object.entries(v).reverse()), requestId: randomUUID() });
  expect(observationFingerprint(student, a)).toBe(observationFingerprint(student, b));
  for (const changed of [parseObservation({ ...v, groupId: randomUUID() }), parseObservation({ ...v, frequency: 'ALWAYS' })])
    expect(observationFingerprint(student, a)).not.toBe(observationFingerprint(student, changed));
  expect(observationFingerprint(student, a)).not.toBe(observationFingerprint(randomUUID(), a));
  expect(observationFingerprint(student, a)).not.toBe(observationFingerprint(student, parseObservation({ ...v, expectedVersion: 1 }, true), randomUUID()));
});
it('CA-03/06: consultas cerradas, límites, rango inclusivo y área no especificada distinta de quitar filtro', () => {
  expect(parseObservationQuery(new URLSearchParams('schoolYear=2025&term=4&area=UNSPECIFIED&limit=100'))).toEqual({ schoolYear: 2025, term: 4, area: 'UNSPECIFIED', limit: 100 });
  for (const query of ['term=5', 'limit=0', 'limit=101', 'limit=1.5', 'area=null', 'other=x', 'limit=1&limit=2', 'observedFrom=2025-02-29', 'observedFrom=2026-01-02&observedTo=2026-01-01'])
    expect(() => parseObservationQuery(new URLSearchParams(query))).toThrow(ObservationError);
  expect(() => parseObservationQuery(new URLSearchParams('term=1'), true)).toThrow(ObservationError);
});
it('CA-01/06: frontera HTTP acotada, JSON y tipo válidos antes del servicio', async () => {
  const req = (body: string, type = 'application/json') => new Request('http://localhost', { method: 'POST', headers: { 'content-type': type }, body });
  expect(await readObservation(req(JSON.stringify(valid())))).toMatchObject({ area: null });
  for (const request of [req('{'), req('{}', 'text/plain'), req('a'.repeat(16385)), req('null')])
    await expect(readObservation(request)).rejects.toBeInstanceOf(ObservationError);
});
