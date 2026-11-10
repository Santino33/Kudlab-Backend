import { createHash } from 'node:crypto';
import { z } from 'zod';
import { observationInvalid, type ObservationField, type ObservationIssue } from './observations.errors.js';

export const behaviors = ['ATTENTION', 'FOLLOWING_INSTRUCTIONS'] as const;
export const frequencies = ['NEVER', 'SOMETIMES', 'ALMOST_ALWAYS', 'ALWAYS'] as const;
export const areas = ['LANGUAGE_READING', 'MATHEMATICS'] as const;
const integer = z.number().int().min(-2147483648).max(2147483647);
// PostgreSQL date has no year zero; reject it at the boundary, not as a database outage.
const calendarDate = z.iso.date().refine(value => !value.startsWith('0000-'));
const values = {
  behavior: z.enum(behaviors), frequency: z.enum(frequencies), area: z.enum(areas).nullable().optional().transform(v => v ?? null),
  observedOn: calendarDate, schoolYear: integer, term: z.number().int().min(1).max(4),
};
export const observationValues = z.strictObject(values);
const uuid = z.uuid().transform(value => value.toLowerCase());
const createSchema = z.strictObject({ requestId: uuid, groupId: uuid.optional(), ...values });
const correctSchema = createSchema.extend({ expectedVersion: integer.positive() });
export type ObservationInput = z.infer<typeof createSchema>;
export type CorrectionInput = z.infer<typeof correctSchema>;
export function bogotaToday(at: Date) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  const get = (name: string) => parts.find(p => p.type === name)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function validateObservedOn(value: string, at: Date) {
  if (value > bogotaToday(at)) throw observationInvalid([{ field: 'observedOn', reason: 'future_date' }]);
}
export function parseObservation(value: unknown, correction = false, at = new Date()): ObservationInput | CorrectionInput {
  const result = (correction ? correctSchema : createSchema).safeParse(value);
  if (!result.success) {
    const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const fields: ObservationIssue[] = result.error.issues.map(issue => {
      if (issue.code === 'unrecognized_keys' || !issue.path.length) return { field: 'observation', reason: 'not_allowed' };
      const field = issue.path[0] as ObservationField;
      const reason = raw[field] === undefined && !['area', 'groupId'].includes(field) ? 'required' :
        ['behavior', 'frequency', 'term', 'area'].includes(field) ? 'not_allowed' : 'invalid_format';
      return { field, reason };
    });
    throw observationInvalid(fields);
  }
  validateObservedOn(result.data.observedOn, at);
  return result.data;
}
export async function readObservation(request: Request, correction = false) {
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw observationInvalid();
  const reader = request.body?.getReader();
  if (!reader) throw observationInvalid();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw observationInvalid(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw observationInvalid(); }
  return parseObservation(body, correction);
}
export function observationFingerprint(studentId: string, input: ObservationInput | CorrectionInput, observationId?: string) {
  return createHash('sha256').update(JSON.stringify([observationId ? 'CORRECT' : 'CREATE', studentId, observationId ?? null,
    'expectedVersion' in input ? input.expectedVersion : null, input.groupId ?? null, input.behavior, input.frequency,
    input.area ?? null, input.observedOn, input.schoolYear, input.term])).digest('hex');
}

const numericQuery = <T extends z.ZodType<number, number>>(schema: T) => z.string().regex(/^-?\d+$/).transform(Number).pipe(schema);
const listSchema = z.strictObject({
  schoolYear: numericQuery(integer).optional(), term: numericQuery(z.number().int().min(1).max(4)).optional(),
  behavior: z.enum(behaviors).optional(), area: z.enum([...areas, 'UNSPECIFIED']).optional(),
  observedFrom: calendarDate.optional(), observedTo: calendarDate.optional(),
  cursor: z.string().regex(/^[\w-]{1,2048}$/).optional(), limit: numericQuery(z.number().int().min(1).max(100)).optional(),
});
export type ObservationQuery = z.infer<typeof listSchema>;
export function parseObservationQuery(params: URLSearchParams, revisions = false): ObservationQuery {
  const allowed = revisions ? ['limit', 'cursor'] : Object.keys(listSchema.shape);
  if ([...params.keys()].some(k => !allowed.includes(k) || params.getAll(k).length !== 1)) throw observationInvalid();
  const result = listSchema.safeParse(Object.fromEntries(params));
  if (!result.success) throw observationInvalid();
  if (result.data.observedFrom && result.data.observedTo && result.data.observedFrom > result.data.observedTo) throw observationInvalid();
  return result.data;
}
