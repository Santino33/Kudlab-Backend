import { describe, expect, it, vi } from 'vitest';
import { validateConsentFile } from '../../src/modules/academico/consents/consent-validator.js';

describe('basic consent file admission (CA-01/CA-02/CA-03)', () => {
  it.each([
    ['evidence.PDF', Buffer.from('%PDF-1.7'), 'application/pdf'],
    ['evidence.png', Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'],
    ['evidence.jpg', Buffer.from([255, 216, 255]), 'image/jpeg'],
    ['evidence.jpeg', Buffer.from([255, 216, 255]), 'image/jpeg'],
  ])('admits basic signature in %s without claiming structural validation', async (name, bytes, mediaType) => {
    expect(await validateConsentFile(new File([bytes], name, { type: 'text/html' }))).toEqual({ kind: 'valid', mediaType });
  });

  it('rejects empty, unknown signatures, missing and mismatched extensions regardless of declared MIME', async () => {
    expect(await validateConsentFile(new File([], 'empty.pdf'))).toEqual({ kind: 'invalid' });
    expect(await validateConsentFile(new File(['<html>'], 'fake.pdf', { type: 'application/pdf' }))).toEqual({ kind: 'unsupported' });
    for (const name of ['image.png', 'pdf', 'evidence.pdf.exe']) {
      expect(await validateConsentFile(new File(['%PDF-'], name))).toEqual({ kind: 'invalid' });
    }
  });

  it('accepts exactly 10 MiB, rejects one byte more, and reads only the header', async () => {
    const bytes = Buffer.alloc(10485760); bytes.write('%PDF-');
    const file = new File([bytes], 'boundary.pdf');
    const fullRead = vi.spyOn(file, 'arrayBuffer');
    const slice = vi.spyOn(file, 'slice');
    expect(await validateConsentFile(file)).toEqual({ kind: 'valid', mediaType: 'application/pdf' });
    expect(fullRead).not.toHaveBeenCalled();
    expect(slice).toHaveBeenCalledWith(0, 8);
    expect(await validateConsentFile(new File([bytes, 'x'], 'too-large.pdf'))).toEqual({ kind: 'invalid' });
  });

  it('preserves cancellation and read failure as unavailable', async () => {
    const file = new File(['%PDF-'], 'evidence.pdf');
    expect(await validateConsentFile(file, AbortSignal.abort())).toEqual({ kind: 'unavailable' });
    vi.spyOn(file, 'slice').mockImplementation(() => { throw new Error('read failure'); });
    expect(await validateConsentFile(file)).toEqual({ kind: 'unavailable' });
  });
});
