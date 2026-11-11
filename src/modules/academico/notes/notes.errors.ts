import type { Context } from 'hono';
import { academicFail } from '../shared/academic.errors.js';

export type NoteField = 'subject' | 'term' | 'score' | 'note' | 'student' | 'version';
export type NoteReason =
  | 'required' | 'invalid_format' | 'out_of_range' | 'too_many_decimals'
  | 'already_exists' | 'inactive' | 'stale';
export type NoteFieldError = { field: NoteField; reason: NoteReason };

// Error propio: `fields` es un arreglo cerrado [{ field, reason }] (MSG-integrador-006).
export class NotesError extends Error {
  constructor(public status: 400 | 409, public code: 'INVALID_INPUT' | 'CONFLICT', message: string,
    public fields: NoteFieldError[]) { super(message); }
}
export const invalidNote = (fields: NoteFieldError[]) => new NotesError(400, 'INVALID_INPUT', 'Datos inválidos', fields);
export const noteConflict = (field: NoteField, reason: NoteReason) =>
  new NotesError(409, 'CONFLICT', 'Conflicto con el estado actual', [{ field, reason }]);

// Delega en academicFail todo lo que no es un NotesError (404, 401/403, 503 y demás).
export function notesFail(c: Context, error: unknown) {
  if (error instanceof NotesError)
    return c.json({ code: error.code, message: error.message, fields: error.fields }, error.status);
  return academicFail(c, error);
}
