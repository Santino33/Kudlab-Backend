import type { Context } from 'hono';
import { academicFail } from '../../academico/shared/academic.errors.js';

export type AnnotationFieldError =
  | { field: 'text'; reason: 'TEXT_REQUIRED' | 'TEXT_TOO_LONG' }
  | { field: 'operation'; reason: 'STUDENT_INACTIVE' | 'NOT_AUTHOR' };

export class AnnotationError extends Error {
  constructor(public status: 400 | 409 | 413, public code: 'INVALID_INPUT' | 'CONFLICT',
    public fields?: AnnotationFieldError[]) { super('No se pudo completar la operación de anotaciones'); }
}

export function annotationConflict(reason: 'STUDENT_INACTIVE' | 'NOT_AUTHOR') {
  return new AnnotationError(409, 'CONFLICT', [{ field: 'operation', reason }]);
}

export function annotationsFail(c: Context, error: unknown) {
  if (error instanceof AnnotationError) return c.json({ code: error.code, message: error.message,
    ...(error.fields ? { fields: error.fields } : {}) }, error.status);
  return academicFail(c, error);
}
