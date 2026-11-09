import { z } from 'zod';
import { MAX_CONSENT_FILE_BYTES } from './consent-storage.js';

type MetadataField = 'metadata' | 'requestId' | 'expectedVersion' | 'signedOn' | 'receivedOn' | 'file';
type MetadataReason = 'required' | 'invalid_format' | 'future_date' | 'date_order' | 'too_large';
export class ConsentInputError extends Error {
  readonly code = 'INVALID_INPUT';
  constructor(readonly fields: { field: MetadataField; reason: MetadataReason }[], readonly status: 400 | 413 = 400) {
    super('Datos de consentimiento inválidos');
    this.name = 'ConsentInputError';
  }
}
const invalid = (field: MetadataField, reason: MetadataReason = 'invalid_format') =>
  new ConsentInputError([{ field, reason }]);
const metadataSchema = z.strictObject({ requestId: z.uuid(), expectedVersion: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  signedOn: z.string(), receivedOn: z.string() });
const dateFormatter = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' });
function realDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// The caller supplies server time; payload fields cannot override it or the author.
export function parseConsentMetadata(input: unknown, now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error('Reloj de servidor no disponible');
  const parsed = metadataSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.issues.map(issue => {
      const key = issue.path[0];
      const field: MetadataField = key === 'requestId' || key === 'expectedVersion' || key === 'signedOn' || key === 'receivedOn' ? key : 'metadata';
      return { field, reason: 'invalid_format' as const };
    });
    throw new ConsentInputError(fields);
  }
  const data = parsed.data;
  const parts = dateFormatter.formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  const today = `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
  for (const field of ['signedOn', 'receivedOn'] as const) {
    if (!data[field]) throw invalid(field, 'required');
    if (!realDate(data[field])) throw invalid(field);
    if (data[field] > today) throw invalid(field, 'future_date');
  }
  if (data.signedOn > data.receivedOn) throw invalid('signedOn', 'date_order');
  return data;
}

// Transport must bound the raw body before parsing FormData; this only checks the parsed parts.
// MIME/name are untrusted: the structural validator must still validate the original file bytes.
export function parseConsentForm(form: FormData, now: Date) {
  if ([...form.keys()].some(key => key !== 'file' && key !== 'metadata')) throw invalid('metadata');
  const files = form.getAll('file'), metadata = form.getAll('metadata');
  if (files.length !== 1 || !(files[0] instanceof File)) throw invalid('file');
  if (metadata.length !== 1 || typeof metadata[0] !== 'string') throw invalid('metadata');
  const file = files[0];
  if (!file.size) throw invalid('file', 'required');
  if (file.size > MAX_CONSENT_FILE_BYTES) throw new ConsentInputError([{ field: 'file', reason: 'too_large' }], 413);
  let input: unknown;
  try { input = JSON.parse(metadata[0]); } catch { throw invalid('metadata'); }
  return { file, metadata: parseConsentMetadata(input, now) };
}
