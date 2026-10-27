import type { Context } from 'hono';

export type AcademicField = 'groupId' | 'studentCode' | 'firstName' | 'lastName' | 'name' | 'grade' | 'schoolYear' | 'teacherId';
export class AcademicError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 503, public code: string, message: string,
    public fields?: Partial<Record<AcademicField, string>>) { super(message); }
}
export const notFound = () => new AcademicError(404, 'NOT_FOUND', 'Recurso no encontrado');
export const forbidden = () => new AcademicError(403, 'FORBIDDEN', 'Acceso denegado');
export const unauthenticated = () => new AcademicError(401, 'UNAUTHENTICATED', 'Sesión requerida');
export const invalidInput = () => new AcademicError(400, 'INVALID_INPUT', 'Datos inválidos');

export function academicFail(c: Context, error: unknown) {
  if (error instanceof AcademicError) return c.json({ code: error.code, message: error.message,
    ...(error.fields ? { fields: error.fields } : {}) }, error.status);
  if (error instanceof SyntaxError) return c.json({ code: 'INVALID_INPUT', message: 'Datos inválidos' }, 400);
  const cause = error instanceof Error && 'cause' in error ? error.cause : error;
  if (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505' &&
    'constraint' in cause && cause.constraint === 'students_code_unique')
    return c.json({ code: 'CONFLICT', message: 'Código de estudiante no disponible' }, 409);
  return c.json({ code: 'UNAVAILABLE', message: 'Servicio no disponible' }, 503);
}
