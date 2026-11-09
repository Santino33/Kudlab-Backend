import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { GetObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { z } from 'zod';

export const MAX_CONSENT_FILE_BYTES = 10 * 1024 * 1024;
const storageTimeoutMs = 30_000;
const evidenceSchema = z.object({
  objectKey: z.string().regex(/^consents\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/),
  mediaType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  byteSize: z.number().int().min(1).max(MAX_CONSENT_FILE_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type ConsentEvidence = z.infer<typeof evidenceSchema>;

export class ConsentStorageError extends Error {
  constructor(readonly code: 'UNAVAILABLE' | 'EVIDENCE_MISMATCH') {
    super(code === 'UNAVAILABLE' ? 'No se pudo comprobar el almacenamiento' : 'La evidencia no coincide');
    this.name = 'ConsentStorageError';
  }
}

const mismatch = () => new ConsentStorageError('EVIDENCE_MISMATCH');
const unavailable = () => new ConsentStorageError('UNAVAILABLE');
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sanitized = (error: unknown) => error instanceof ConsentStorageError ? error : unavailable();
function evidence(value: ConsentEvidence): ConsentEvidence {
  const parsed = evidenceSchema.safeParse(value);
  if (!parsed.success) throw mismatch();
  return parsed.data;
}

// The caller must validate the complete original document before reserving or storing it.
// This descriptor binds bytes to a server-generated record UUID; it does not validate a file format.
export function describeConsentEvidence(recordId: string, bytes: Uint8Array, mediaType: ConsentEvidence['mediaType']): ConsentEvidence {
  return evidence({ objectKey: `consents/${recordId}`, mediaType, byteSize: bytes.byteLength, sha256: digest(bytes) });
}

const credential = z.string().regex(/^[A-Za-z0-9/+_=.-]{16,512}$/);
const configuration = z.object({
  CONSENT_STORAGE_ENDPOINT: z.string().regex(/^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com\/?$/),
  CONSENT_STORAGE_BUCKET: z.string().min(3).max(63).regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  CONSENT_STORAGE_ACCESS_KEY_ID: credential,
  CONSENT_STORAGE_SECRET_ACCESS_KEY: credential,
});

function deadline(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(storageTimeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function mayHaveObject(error: unknown) {
  const status = (error as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;
  return status === undefined || [409, 412, 429].includes(status) || status >= 500;
}

export function createConsentStorage(source: NodeJS.ProcessEnv = process.env, requestHandler?: S3ClientConfig['requestHandler']) {
  const parsed = configuration.safeParse(source);
  const config = parsed.success ? parsed.data : undefined;
  // Missing/invalid storage configuration disables this adapter, not the rest of the API.
  const client = config ? new S3Client({
    endpoint: config.CONSENT_STORAGE_ENDPOINT, region: 'auto', forcePathStyle: true,
    credentials: { accessKeyId: config.CONSENT_STORAGE_ACCESS_KEY_ID, secretAccessKey: config.CONSENT_STORAGE_SECRET_ACCESS_KEY },
    maxAttempts: 1, followRegionRedirects: false,
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
    requestHandler: requestHandler ?? { connectionTimeout: 10_000, requestTimeout: storageTimeoutMs, throwOnRequestTimeout: true },
  }) : undefined;

  async function read(expected: ConsentEvidence, signal: AbortSignal): Promise<Buffer> {
    if (!client || !config) throw unavailable();
    signal.throwIfAborted();
    const response = await client.send(new GetObjectCommand({
      Bucket: config.CONSENT_STORAGE_BUCKET, Key: expected.objectKey,
    }), { abortSignal: signal });
    const body = response.Body;
    if (!(body instanceof Readable)) throw unavailable();
    const abort = () => body.destroy();
    signal.addEventListener('abort', abort, { once: true });
    try {
      signal.throwIfAborted();
      if (response.ContentLength !== expected.byteSize || response.ContentType !== expected.mediaType ||
        response.Metadata?.sha256 !== expected.sha256) throw mismatch();
      const bytes = Buffer.alloc(expected.byteSize);
      let offset = 0;
      for await (const chunk of body) {
        signal.throwIfAborted();
        if (!(chunk instanceof Uint8Array) || offset + chunk.byteLength > bytes.length) throw mismatch();
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      signal.throwIfAborted();
      if (offset !== expected.byteSize || digest(bytes) !== expected.sha256) throw mismatch();
      return bytes;
    } finally {
      signal.removeEventListener('abort', abort);
      body.destroy();
    }
  }

  return {
    async putImmutable(input: ConsentEvidence, original: Uint8Array, signal?: AbortSignal): Promise<void> {
      try {
        const expected = evidence(input);
        if (original.byteLength !== expected.byteSize) throw mismatch();
        // Own the buffer so a caller cannot change bytes while the SDK is awaiting I/O.
        const bytes = Buffer.from(original);
        if (digest(bytes) !== expected.sha256) throw mismatch();
        if (!client || !config) throw unavailable();
        const operationSignal = deadline(signal);
        operationSignal.throwIfAborted();
        try {
          await client.send(new PutObjectCommand({
            Bucket: config.CONSENT_STORAGE_BUCKET, Key: expected.objectKey, Body: bytes,
            ContentLength: expected.byteSize, ContentType: expected.mediaType,
            Metadata: { sha256: expected.sha256 }, IfNoneMatch: '*',
          }), { abortSignal: operationSignal });
        } catch (error) {
          operationSignal.throwIfAborted();
          if (!mayHaveObject(error)) throw unavailable();
          // A lost reply or precondition failure is resolved only by reading the exact bytes.
        }
        await read(expected, operationSignal);
      } catch (error) { throw sanitized(error); }
    },
    async readVerified(input: ConsentEvidence, signal?: AbortSignal): Promise<Buffer> {
      try { return await read(evidence(input), deadline(signal)); }
      catch (error) { throw sanitized(error); }
    },
    close() { client?.destroy(); },
  };
}
