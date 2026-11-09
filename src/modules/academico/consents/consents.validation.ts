import { z } from 'zod';

type MetadataField = 'metadata' | 'requestId' | 'expectedVersion' | 'signedOn' | 'receivedOn';
type MetadataReason = 'required' | 'invalid_format' | 'future_date' | 'date_order';
export class ConsentInputError extends Error {
  readonly status = 400;
  readonly code = 'INVALID_INPUT';
  constructor(readonly fields: { field: MetadataField; reason: MetadataReason }[]) {
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
