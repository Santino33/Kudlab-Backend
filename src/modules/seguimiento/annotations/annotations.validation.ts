import { z } from 'zod';
import { invalidInput, notFound } from '../../academico/shared/academic.errors.js';
import { AnnotationError } from './annotations.errors.js';

export function annotationUuid(value: string) {
  if (!z.uuid().safeParse(value).success) throw notFound();
  return value;
}

function object(input: unknown, keys: string[]) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalidInput();
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(key => !keys.includes(key))) throw invalidInput();
  return data;
}

export function annotationText(value: unknown) {
  if (typeof value !== 'string' || !value.trim())
    throw new AnnotationError(400, 'INVALID_INPUT', [{ field: 'text', reason: 'TEXT_REQUIRED' }]);
  // Count Unicode code points, like PostgreSQL char_length, not UTF-16 units.
  if ([...value].length > 1000)
    throw new AnnotationError(400, 'INVALID_INPUT', [{ field: 'text', reason: 'TEXT_TOO_LONG' }]);
  if (value.includes('\0') || /[\uD800-\uDFFF]/u.test(value)) throw invalidInput();
  return value;
}

export function parseAnnotationCreate(input: unknown) {
  const data = object(input, ['studentId', 'text']);
  if (typeof data.studentId !== 'string') throw invalidInput();
  return { studentId: annotationUuid(data.studentId), text: annotationText(data.text) };
}

export function parseAnnotationUpdate(input: unknown) {
  return { text: annotationText(object(input, ['text']).text) };
}

export type AnnotationCursor = { studentId: string; createdAt: string; id: string };
export function encodeAnnotationCursor(cursor: AnnotationCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function parseAnnotationQuery(url: string) {
  const query = new URL(url).searchParams;
  if ([...query.keys()].some(key => !['studentId', 'limit', 'cursor'].includes(key) || query.getAll(key).length !== 1)) throw invalidInput();
  const studentId = query.get('studentId');
  if (!studentId) throw invalidInput();
  annotationUuid(studentId);
  const rawLimit = query.get('limit') ?? '25';
  if (!/^(?:[1-9][0-9]?|100)$/.test(rawLimit)) throw invalidInput();
  let cursor: AnnotationCursor | undefined;
  const encoded = query.get('cursor');
  if (encoded !== null) {
    if (!encoded || encoded.length > 512 || !/^[\w-]+$/.test(encoded)) throw invalidInput();
    try {
      const data = object(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')), ['studentId', 'createdAt', 'id']);
      if (data.studentId !== studentId || typeof data.id !== 'string' || !z.uuid().safeParse(data.id).success ||
        typeof data.createdAt !== 'string' || !z.iso.datetime().safeParse(data.createdAt).success || !Number.isFinite(Date.parse(data.createdAt))) throw invalidInput();
      cursor = data as AnnotationCursor;
    } catch { throw invalidInput(); }
  }
  return { studentId, limit: Number(rawLimit), cursor };
}

export function rejectAnnotationQuery(url: string) {
  if (new URL(url).searchParams.size) throw invalidInput();
}
