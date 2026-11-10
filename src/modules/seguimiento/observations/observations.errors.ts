import type { Context } from 'hono';
import { AcademicError } from '../../academico/shared/academic.errors.js';

export type ObservationConflict = 'STUDENT_INACTIVE' | 'CONSENT_REQUIRED' | 'AUTHOR_REQUIRED' |
  'CORRECTION_CLOSED' | 'STALE_VERSION' | 'REQUEST_MISMATCH';
export type ObservationField = 'behavior' | 'frequency' | 'area' | 'observedOn' | 'schoolYear' | 'term' |
  'requestId' | 'expectedVersion' | 'groupId' | 'observation' | 'cursor' | 'limit' | 'observedFrom' | 'observedTo';
export type ObservationIssue = { field: ObservationField; reason: 'required' | 'invalid_format' | 'not_allowed' | 'future_date' | ObservationConflict };
export class ObservationError extends Error {
  constructor(readonly status: 400 | 409 | 503, readonly code: 'INVALID_INPUT' | 'CONFLICT' | 'UNAVAILABLE',
    readonly fields?: ObservationIssue[]) { super(code); }
}
export const observationInvalid = (fields?: ObservationIssue[]) => new ObservationError(400, 'INVALID_INPUT', fields);
export const observationConflict = (reason: ObservationConflict) => new ObservationError(409, 'CONFLICT', [{ field: 'observation', reason }]);
export const observationUnavailable = () => new ObservationError(503, 'UNAVAILABLE');
export function observationFail(c: Context, error: unknown) {
  if (error instanceof ObservationError) return c.json({ code: error.code,
    message: error.status === 400 ? 'Datos inválidos' : error.status === 409 ? 'Operación no permitida' : 'Servicio no disponible',
    ...(error.fields ? { fields: error.fields } : {}) }, error.status);
  if (error instanceof AcademicError) return c.json({ code: error.code, message: error.message }, error.status);
  return c.json({ code: 'UNAVAILABLE', message: 'Servicio no disponible' }, 503);
}
