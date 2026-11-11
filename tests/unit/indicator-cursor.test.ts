import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor, InvalidCursorError } from '../../src/modules/evolucion/read/cursor.js';

const id = '11111111-1111-4111-8111-111111111111', student = '22222222-2222-4222-8222-222222222222';
const position = { at: new Date('2026-03-02T15:00:00.000Z'), id };
describe('cursor de historia', () => {
  it('va y vuelve con la misma consulta', () => {
    const cursor = encodeCursor({ studentId: student, metricCode: 'accuracy_pct' }, position);
    expect(decodeCursor(cursor, { studentId: student, metricCode: 'accuracy_pct' })).toEqual(position);
  });
  it('se rechaza con otro estudiante o con otros filtros', () => {
    const cursor = encodeCursor({ studentId: student, from: '2026-03-01' }, position);
    expect(() => decodeCursor(cursor, { studentId: id, from: '2026-03-01' })).toThrow(InvalidCursorError);
    expect(() => decodeCursor(cursor, { studentId: student, from: '2026-03-02' })).toThrow(InvalidCursorError);
    expect(() => decodeCursor(cursor, { studentId: student })).toThrow(InvalidCursorError);
  });
  it.each(['', 'x', '!!', Buffer.from('{"v":2}').toString('base64url'), Buffer.from('null').toString('base64url'),
    Buffer.from(JSON.stringify({ v: 1, f: 'x', at: 'no', id })).toString('base64url')])('rechaza cursor mal formado %#', value => {
    expect(() => decodeCursor(value, { studentId: student })).toThrow(InvalidCursorError);
  });
});
