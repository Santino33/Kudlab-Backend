import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsentStorageError, MAX_CONSENT_FILE_BYTES, createConsentStorage, describeConsentEvidence,
  type ConsentEvidence } from '../../src/modules/academico/consents/consent-storage.js';

type Handler = Extract<NonNullable<S3ClientConfig['requestHandler']>, { handle: unknown }>['handle'];
type Request = Parameters<Handler>[0];
type Response = Awaited<ReturnType<Handler>>['response'];
type Step = (request: Request) => Response | Promise<Response>;
const settings = {
  CONSENT_STORAGE_ENDPOINT: `https://${'a'.repeat(32)}.r2.cloudflarestorage.com`,
  CONSENT_STORAGE_BUCKET: 'synthetic-consent-test',
  CONSENT_STORAGE_ACCESS_KEY_ID: 'synthetic-access-key-only',
  CONSENT_STORAGE_SECRET_ACCESS_KEY: 'synthetic-secret-key-only',
};
const recordId = 'c82e6873-598d-4a1d-b783-2731dca190b8';
// These bytes exercise the storage transport, not PDF validation or a consent record.
const original = Buffer.from('synthetic-storage-payload');
const reference = () => describeConsentEvidence(recordId, original, 'application/pdf');
const clients: ReturnType<typeof createConsentStorage>[] = [];
const response = (statusCode = 200, body = Buffer.alloc(0), headers: Record<string, string> = {}): Response =>
  ({ statusCode, headers, body: Readable.from([body]) });
const s3Error = (status: number, code: string) => response(status, Buffer.from(`<Error><Code>${code}</Code><Message>PRIVATE-S3-DIAGNOSTIC</Message></Error>`));
function document(bytes = original, expected = reference(), headers: Record<string, string> = {}) {
  return response(200, bytes, { 'content-length': String(expected.byteSize), 'content-type': expected.mediaType,
    'x-amz-meta-sha256': expected.sha256, ...headers });
}
function harness(steps: Step[], source: NodeJS.ProcessEnv = settings) {
  const remaining = [...steps];
  const handle = vi.fn<Handler>(async (request: Request) => {
    const step = remaining.shift();
    if (!step) throw new Error('Unexpected storage request');
    return { response: await step(request) };
  });
  const storage = createConsentStorage(source, { handle });
  clients.push(storage);
  return { storage, handle };
}
const unavailable = { name: 'ConsentStorageError', code: 'UNAVAILABLE' };
const mismatch = { name: 'ConsentStorageError', code: 'EVIDENCE_MISMATCH' };
afterEach(() => { clients.splice(0).forEach(client => client.close()); vi.restoreAllMocks(); });

describe('consent storage — CA-01/02/03/08, transport only', () => {
  it('binds original bytes, size and SHA-256 to an opaque server record UUID', () => {
    expect(reference()).toEqual({ objectKey: `consents/${recordId}`, mediaType: 'application/pdf', byteSize: original.length,
      sha256: createHash('sha256').update(original).digest('hex') });
    for (const id of ['student-name', '../other', `x/${recordId}`, `${recordId}?token=secret`])
      expect(() => describeConsentEvidence(id, original, 'application/pdf')).toThrow(ConsentStorageError);
    expect(() => describeConsentEvidence(recordId, Buffer.alloc(0), 'application/pdf')).toThrow(ConsentStorageError);
    expect(() => describeConsentEvidence(recordId, Buffer.alloc(MAX_CONSENT_FILE_BYTES + 1), 'application/pdf')).toThrow(ConsentStorageError);
    expect(describeConsentEvidence(recordId, Buffer.alloc(MAX_CONSENT_FILE_BYTES), 'image/png').byteSize).toBe(10_485_760);
  });

  it.each([{}, { CONSENT_STORAGE_BUCKET: settings.CONSENT_STORAGE_BUCKET },
    ...Object.keys(settings).map(key => ({ ...settings, [key]: '' })),
  ])('keeps an incompletely configured adapter unavailable without network or startup failure', async source => {
    const { storage, handle } = harness([], source);
    await expect(storage.putImmutable(reference(), original)).rejects.toMatchObject(unavailable);
    await expect(storage.readVerified(reference())).rejects.toMatchObject(unavailable);
    expect(handle).not.toHaveBeenCalled();
  });

  it.each([
    ['CONSENT_STORAGE_ENDPOINT', 'http://127.0.0.1:1234'],
    ['CONSENT_STORAGE_ENDPOINT', `${settings.CONSENT_STORAGE_ENDPOINT}/bucket`],
    ['CONSENT_STORAGE_ENDPOINT', `${settings.CONSENT_STORAGE_ENDPOINT}?secret=value`],
    ['CONSENT_STORAGE_ENDPOINT', `${settings.CONSENT_STORAGE_ENDPOINT}.evil.example`],
    ['CONSENT_STORAGE_ENDPOINT', 'https://private:secret@evil.example'],
    ['CONSENT_STORAGE_BUCKET', '../other'], ['CONSENT_STORAGE_ACCESS_KEY_ID', 'key\r\nsecret'],
    ['CONSENT_STORAGE_SECRET_ACCESS_KEY', 'short'],
  ])('rejects invalid %s without reflecting its value or using ambient SDK configuration', async (key, value) => {
    const { storage, handle } = harness([], { ...settings, [key]: value });
    const error = await storage.readVerified(reference()).catch(error => error);
    expect(error).toMatchObject(unavailable);
    expect(String(error)).not.toContain(value);
    expect(error.cause).toBeUndefined();
    expect(handle).not.toHaveBeenCalled();
  });

  it('uses real SDK signing/serialization, conditional PUT and full verified GET, with no public ACL', async () => {
    const { storage, handle } = harness([() => response(), () => document()]);
    await expect(storage.putImmutable(reference(), original)).resolves.toBeUndefined();
    expect(handle).toHaveBeenCalledTimes(2);
    const put = handle.mock.calls[0]![0];
    const get = handle.mock.calls[1]![0];
    expect(put).toMatchObject({ protocol: 'https:', hostname: `${'a'.repeat(32)}.r2.cloudflarestorage.com`,
      path: `/synthetic-consent-test/consents/${recordId}`, method: 'PUT', body: original });
    expect(put.headers).toMatchObject({ 'if-none-match': '*', 'content-type': 'application/pdf',
      'content-length': String(original.length), 'x-amz-meta-sha256': reference().sha256 });
    expect(put.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 /);
    expect(put.headers.authorization).toContain('/auto/s3/aws4_request');
    expect(put.headers['x-amz-acl']).toBeUndefined();
    expect(put.query?.['X-Amz-Signature']).toBeUndefined();
    expect(get.method).toBe('GET');
    expect(get.headers.authorization).toMatch(/^AWS4-HMAC-SHA256 /);
  });

  it.each(['application/pdf', 'image/jpeg', 'image/png'] as const)('returns only fully verified %s bytes', async mediaType => {
    const expected = describeConsentEvidence(recordId, original, mediaType);
    const { storage } = harness([() => document(original, expected)]);
    expect(await storage.readVerified(expected)).toEqual(original);
  });

  it.each([409, 412, 429, 500, 503])('reconciles PUT %s by bytes without retrying PUT or overwriting', async status => {
    const { storage, handle } = harness([() => s3Error(status, 'PreconditionFailed'), () => document()]);
    await expect(storage.putImmutable(reference(), original)).resolves.toBeUndefined();
    expect(handle.mock.calls.map(([request]) => request.method)).toEqual(['PUT', 'GET']);
  });

  it('reconciles a lost PUT response, never declaring success from the key alone', async () => {
    const { storage, handle } = harness([() => { throw new Error('PRIVATE-NETWORK-DETAIL'); }, () => document()]);
    await expect(storage.putImmutable(reference(), original)).resolves.toBeUndefined();
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it('preserves uncertainty on GET 404 after a lost PUT, allowing only an explicit same-key retry', async () => {
    const { storage, handle } = harness([
      () => { throw new Error('lost reply'); }, () => s3Error(404, 'NoSuchKey'),
      () => s3Error(412, 'PreconditionFailed'), () => document(),
    ]);
    await expect(storage.putImmutable(reference(), original)).rejects.toMatchObject(unavailable);
    expect(handle).toHaveBeenCalledTimes(2);
    await expect(storage.putImmutable(reference(), original)).resolves.toBeUndefined();
    expect(handle.mock.calls.map(([request]) => request.method)).toEqual(['PUT', 'GET', 'PUT', 'GET']);
    expect(new Set(handle.mock.calls.map(([request]) => request.path)).size).toBe(1);
    for (const [request] of handle.mock.calls.filter(([request]) => request.method === 'PUT'))
      expect(request.headers['if-none-match']).toBe('*');
  });

  it.each([200, 412])('detects mismatched bytes after PUT %s even with matching metadata', async status => {
    const { storage, handle } = harness([() => status === 200 ? response() : s3Error(status, 'PreconditionFailed'),
      () => document(Buffer.alloc(original.length))]);
    await expect(storage.putImmutable(reference(), original)).rejects.toMatchObject(mismatch);
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it.each([301, 400, 401, 403])('does not follow redirects or retry definitive PUT %s failures', async status => {
    const { storage, handle } = harness([() => s3Error(status, 'AccessDenied')]);
    const error = await storage.putImmutable(reference(), original).catch(error => error);
    expect(error).toMatchObject(unavailable);
    expect(String(error)).not.toContain('PRIVATE-S3-DIAGNOSTIC');
    expect(error.cause).toBeUndefined();
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it.each<Record<string, string>>([
    { 'content-length': '0' }, { 'content-length': String(MAX_CONSENT_FILE_BYTES + 1) },
    { 'content-type': 'text/html' }, { 'x-amz-meta-sha256': '0'.repeat(64) },
  ])('destroys the stream immediately when object metadata disagrees', async headers => {
    const reply = document(original, reference(), headers);
    const stream = reply.body as Readable;
    const { storage } = harness([() => reply]);
    await expect(storage.readVerified(reference())).rejects.toMatchObject(mismatch);
    expect(stream.destroyed).toBe(true);
    expect(stream.readableDidRead).toBe(false);
  });

  it('does not trust missing metadata as evidence', async () => {
    const reply = document();
    delete reply.headers['x-amz-meta-sha256'];
    const { storage } = harness([() => reply]);
    await expect(storage.readVerified(reference())).rejects.toMatchObject(mismatch);
  });

  it.each([original.subarray(1), Buffer.concat([original, Buffer.from('x')]), Buffer.alloc(original.length)])(
    'checks streamed length/hash independently of Content-Length and metadata', async bytes => {
      const reply = document(bytes);
      const { storage } = harness([() => reply]);
      await expect(storage.readVerified(reference())).rejects.toMatchObject(mismatch);
      expect((reply.body as Readable).destroyed).toBe(true);
    });

  it('accepts exactly 10 MiB streamed in chunks and rejects an extra chunk without returning partial data', async () => {
    const bytes = Buffer.alloc(MAX_CONSENT_FILE_BYTES, 7);
    const expected = describeConsentEvidence(recordId, bytes, 'image/png');
    const reply = document(bytes, expected);
    reply.body = Readable.from([bytes.subarray(0, 5_000_000), bytes.subarray(5_000_000)]);
    const excessive = document(bytes, expected);
    excessive.body = Readable.from([bytes, Buffer.from('x')]);
    const { storage } = harness([() => reply, () => excessive]);
    expect((await storage.readVerified(expected)).equals(bytes)).toBe(true);
    await expect(storage.readVerified(expected)).rejects.toMatchObject(mismatch);
    expect((excessive.body as Readable).destroyed).toBe(true);
  });

  it('maps interrupted stream errors to unavailable and does not leak their diagnostics', async () => {
    const stream = Readable.from((async function* () { yield original.subarray(0, 2); throw new Error('PRIVATE-STREAM-DETAIL'); })());
    const { storage } = harness([() => ({ ...document(), body: stream })]);
    const error = await storage.readVerified(reference()).catch(error => error);
    expect(error).toMatchObject(unavailable);
    expect(String(error)).not.toContain('PRIVATE-STREAM-DETAIL');
    expect(error.cause).toBeUndefined();
    expect(stream.destroyed).toBe(true);
  });

  it('rejects mismatched local bytes and malformed references before any request', async () => {
    const { storage, handle } = harness([]);
    for (const changes of [{ objectKey: '../another' }, { sha256: '0'.repeat(64) }, { byteSize: 0 },
      { byteSize: MAX_CONSENT_FILE_BYTES + 1 }, { mediaType: 'text/html' }]) {
      await expect(storage.putImmutable({ ...reference(), ...changes } as ConsentEvidence, original)).rejects.toMatchObject(mismatch);
    }
    await expect(storage.putImmutable(reference(), original.subarray(1))).rejects.toMatchObject(mismatch);
    expect(handle).not.toHaveBeenCalled();
  });

  it('owns bytes and the expected descriptor while awaiting the SDK', async () => {
    const bytes = Buffer.from(original);
    const expected = reference();
    const { storage, handle } = harness([() => {
      bytes.fill(0); expected.sha256 = '0'.repeat(64);
      return response();
    }, () => document()]);
    await expect(storage.putImmutable(expected, bytes)).resolves.toBeUndefined();
    expect(handle).toHaveBeenCalledTimes(2);
    expect(handle.mock.calls[0]![0].body).toEqual(original);
  });

  it('does not issue requests for a cancelled operation', async () => {
    const { storage, handle } = harness([]);
    const signal = AbortSignal.abort(new Error('PRIVATE-CANCELLATION'));
    await expect(storage.putImmutable(reference(), original, signal)).rejects.toMatchObject(unavailable);
    await expect(storage.readVerified(reference(), signal)).rejects.toMatchObject(unavailable);
    expect(handle).not.toHaveBeenCalled();
  });

  it('applies one total deadline across PUT and verification, preserving uncertainty after an abort', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const { storage, handle } = harness([() => { controller.abort(); return response(); }]);
    await expect(storage.putImmutable(reference(), original)).rejects.toMatchObject(unavailable);
    expect(timeout).toHaveBeenCalledExactlyOnceWith(30_000);
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('destroys a blocked response stream on cancellation instead of waiting for another chunk', async () => {
    const controller = new AbortController();
    let started!: () => void;
    const reading = new Promise<void>(resolve => { started = resolve; });
    const stream = new Readable({ read() { started(); } });
    const { storage } = harness([() => ({ ...document(), body: stream })]);
    const pending = storage.readVerified(reference(), controller.signal);
    const assertion = expect(pending).rejects.toMatchObject(unavailable);
    await reading;
    controller.abort();
    await assertion;
    expect(stream.destroyed).toBe(true);
  });

  it('destroys a response arriving after cancellation', async () => {
    const controller = new AbortController();
    const reply = document();
    const { storage } = harness([() => { controller.abort(); return reply; }]);
    await expect(storage.readVerified(reference(), controller.signal)).rejects.toMatchObject(unavailable);
    expect((reply.body as Readable).destroyed).toBe(true);
  });
});
