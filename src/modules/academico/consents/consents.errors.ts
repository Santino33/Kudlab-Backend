import type { Context } from 'hono';
import { AcademicError } from '../shared/academic.errors.js';
import { ConsentInputError } from './consents.validation.js';
import { ConsentStorageError } from './consent-storage.js';

export type ConsentConflict = 'STALE_VERSION' | 'REQUEST_REUSED' | 'NOT_CURRENT' | 'EVIDENCE_MISMATCH';
export class ConsentError extends Error {
  constructor(readonly status: 400 | 404 | 409 | 415 | 503, readonly code: 'INVALID_INPUT' | 'NOT_FOUND' | 'CONFLICT' | 'UNAVAILABLE',
    readonly fields?: { field: string; reason: string }[]) { super(code); }
}
export const consentConflict = (reason: ConsentConflict) => new ConsentError(409, 'CONFLICT', [{ field: 'operation', reason }]);
export const consentUnavailable = () => new ConsentError(503, 'UNAVAILABLE');
export function consentFail(c: Context, error: unknown) {
  if (error instanceof ConsentInputError) return c.json({ code: error.code, fields: error.fields }, error.status);
  if (error instanceof ConsentError) return c.json({ code: error.code, ...(error.fields ? { fields: error.fields } : {}) }, error.status);
  if (error instanceof AcademicError) return c.json({ code: error.code }, error.status);
  if (error instanceof ConsentStorageError && error.code === 'EVIDENCE_MISMATCH') return consentFail(c, consentConflict('EVIDENCE_MISMATCH'));
  return c.json({ code: 'UNAVAILABLE' }, 503);
}
