import { describe, expect, it } from 'vitest';
import { ConsentInputError, parseConsentMetadata, parseConsentForm } from '../../src/modules/academico/consents/consents.validation.js';

const input = { requestId: '993e9e73-e0d7-4f52-98e8-e2f24685f84a', expectedVersion: 0,
  signedOn: '2026-11-08', receivedOn: '2026-11-08' };
const now = new Date('2026-11-09T04:59:59.999Z');
describe('consent metadata — CA-02 dates and forbidden fields', () => {
  it('uses the Bogota day at its exact midnight boundary', () => {
    expect(parseConsentMetadata(input, now)).toEqual(input);
    const tomorrow = { ...input, receivedOn: '2026-11-09' };
    expect(() => parseConsentMetadata(tomorrow, now)).toThrow(ConsentInputError);
    expect(parseConsentMetadata(tomorrow, new Date('2026-11-09T05:00:00.000Z'))).toEqual(tomorrow);
  });
  it.each(['2026-02-29', '2024-02-30', '2026-04-31', '2026-13-01', '2026-00-01', '0000-01-01',
    '2026-1-01', '2026-11-08T00:00:00Z', ' 2026-11-08', ''])('rejects non-calendar/non-ISO date %s', signedOn => {
    expect(() => parseConsentMetadata({ ...input, signedOn }, now)).toThrow(ConsentInputError);
  });
  it('accepts leap day and rejects reversed dates', () => {
    expect(parseConsentMetadata({ ...input, signedOn: '2024-02-29' }, now).signedOn).toBe('2024-02-29');
    expect(() => parseConsentMetadata({ ...input, receivedOn: '2026-11-07' }, now)).toThrow(ConsentInputError);
  });
  it.each(['authorId', 'expiresAt', 'now', 'isActive', 'objectKey'])('rejects server-owned field %s', key => {
    expect(() => parseConsentMetadata({ ...input, [key]: 'untrusted' }, now)).toThrow(ConsentInputError);
  });
  it.each([null, [], {}, { ...input, requestId: 'invalid' }, { ...input, expectedVersion: -1 },
    { ...input, expectedVersion: 1.5 }, { ...input, expectedVersion: '0' },
    { ...input, expectedVersion: Number.MAX_SAFE_INTEGER + 1 }, { ...input, signedOn: null }])('rejects malformed metadata %#', value => {
    expect(() => parseConsentMetadata(value, now)).toThrow(ConsentInputError);
  });
  it('reports fixed fields/reasons without reflecting payload and distinguishes a bad clock', () => {
    try { parseConsentMetadata({ ...input, signedOn: 'private-diagnostic' }, now); throw new Error('Expected validation failure'); }
    catch (error) {
      expect(error).toBeInstanceOf(ConsentInputError);
      expect((error as ConsentInputError).fields).toEqual([{ field: 'signedOn', reason: 'invalid_format' }]);
      expect(JSON.stringify(error)).not.toContain('private-diagnostic');
    }
    expect(() => parseConsentMetadata(input, new Date(NaN))).not.toThrow(ConsentInputError);
    expect(() => parseConsentMetadata(input, new Date(NaN))).toThrow('Reloj');
  });
});

describe('consent multipart parts — CA-02, not raw transport or format validation', () => {
  function form(size = 1) {
    const value = new FormData();
    value.append('file', new File([new Uint8Array(size)], 'untrusted.png', { type: 'image/png' }));
    value.append('metadata', JSON.stringify(input));
    return value;
  }
  it('retains the exact File and accepts the exact 10 MiB boundary', () => {
    const value = form(10485760), file = value.get('file');
    expect(parseConsentForm(value, now)).toEqual({ file, metadata: input });
    expect(parseConsentForm(value, now).file).toBe(file);
  });
  it('rejects empty and oversized files before content validation', () => {
    expect(() => parseConsentForm(form(0), now)).toThrow(ConsentInputError);
    try { parseConsentForm(form(10485761), now); throw new Error('Expected rejection'); }
    catch (error) { expect(error).toMatchObject({ status: 413, fields: [{ field: 'file', reason: 'too_large' }] }); }
  });
  it.each(['file', 'metadata'])('rejects duplicate and missing %s parts', key => {
    const duplicate = form(); duplicate.append(key, duplicate.get(key)!);
    expect(() => parseConsentForm(duplicate, now)).toThrow(ConsentInputError);
    const missing = form(); missing.delete(key);
    expect(() => parseConsentForm(missing, now)).toThrow(ConsentInputError);
  });
  it('rejects string file, file metadata, extra parts, malformed JSON and server fields', () => {
    const values = [form(), form(), form(), form(), form()];
    values[0]!.set('file', 'not-a-file');
    values[1]!.set('metadata', new File(['{}'], 'metadata.json'));
    values[2]!.append('authorId', 'untrusted');
    values[3]!.set('metadata', '{');
    values[4]!.set('metadata', JSON.stringify({ ...input, isActive: true }));
    for (const value of values) expect(() => parseConsentForm(value, now)).toThrow(ConsentInputError);
  });
});
