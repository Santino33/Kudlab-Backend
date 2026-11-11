import { describe, expect, it } from 'vitest';
import { AnnotationError } from '../../src/modules/seguimiento/annotations/annotations.errors.js';
import { annotationText, encodeAnnotationCursor, parseAnnotationCreate, parseAnnotationQuery, parseAnnotationUpdate } from '../../src/modules/seguimiento/annotations/annotations.validation.js';

const studentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const url = `https://api.example.test/api/v1/student-annotations?studentId=${studentId}`;
describe('annotations text and strict payloads (CA-01/02/03)', () => {
  it.each(['', '   ', '\t\r\n', '\u00a0\u2003\ufeff'])('rejects blank %j', text => {
    expect(() => annotationText(text)).toThrow(AnnotationError);
  });
  it.each([undefined, null, 1, {}, []])('rejects non-text %j', value => expect(() => annotationText(value)).toThrow());
  it('preserves whitespace and plain text, counts code points, never truncates', () => {
    expect(annotationText('  <script>texto</script>\n')).toBe('  <script>texto</script>\n');
    expect(annotationText('😀'.repeat(1000))).toHaveLength(2000);
    expect(() => annotationText('a'.repeat(1001))).toThrow(AnnotationError);
    expect(() => annotationText('😀'.repeat(1001))).toThrow(AnnotationError);
    expect(() => annotationText('\0')).toThrow();
    expect(() => annotationText('\ud800')).toThrow();
  });
  it('accepts only server-owned provenance', () => {
    expect(parseAnnotationCreate({ studentId, text: 'Texto' })).toEqual({ studentId, text: 'Texto' });
    for (const extra of ['author', 'authorAccountId', 'createdAt', 'updatedAt', 'period', 'sessionId', 'isActive'])
      expect(() => parseAnnotationCreate({ studentId, text: 'Texto', [extra]: 'manipulado' })).toThrow();
    expect(() => parseAnnotationCreate({ studentId: 'bad', text: 'Texto' })).toThrow();
    expect(() => parseAnnotationUpdate({ text: 'Nuevo', studentId })).toThrow();
    expect(parseAnnotationUpdate({ text: 'Nuevo' })).toEqual({ text: 'Nuevo' });
  });
});
describe('annotations pagination boundaries', () => {
  it('defaults to 25 and accepts an own cursor', () => {
    expect(parseAnnotationQuery(url)).toEqual({ studentId, limit: 25, cursor: undefined });
    const cursor = { studentId, id, createdAt: '2026-11-11T00:00:00.000Z' };
    expect(parseAnnotationQuery(`${url}&limit=100&cursor=${encodeAnnotationCursor(cursor)}`)).toEqual({ studentId, limit: 100, cursor });
  });
  it.each(['0', '101', '-1', '01', '1.0', '1e2', '', 'no'])('rejects limit %s', limit => {
    expect(() => parseAnnotationQuery(`${url}&limit=${limit}`)).toThrow();
  });
  it.each(['&x=1', '&studentId='+studentId, '&limit=2&limit=3', '&cursor=bad', '&cursor=', '&cursor='+ 'a'.repeat(513)])('rejects unknown/repeated/malformed query %s', query => {
    expect(() => parseAnnotationQuery(url + query)).toThrow();
  });
  it('rejects foreign, extra-field and invalid-date cursors', () => {
    for (const cursor of [{ studentId: id, id, createdAt: '2026-11-11T00:00:00.000Z' },
      { studentId, id, createdAt: 'bad' }, { studentId, id, createdAt: '2026-11-11T00:00:00.000Z', extra: true }])
      expect(() => parseAnnotationQuery(`${url}&cursor=${Buffer.from(JSON.stringify(cursor)).toString('base64url')}`)).toThrow();
  });
});
