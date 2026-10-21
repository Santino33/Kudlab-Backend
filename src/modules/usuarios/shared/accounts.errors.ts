import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError, type ZodType } from 'zod';

type ProfileField = 'name' | 'email' | 'role' | 'password';
type FieldError = { field: ProfileField; reason: string };

const fieldReasons: Record<ProfileField, string> = {
  name: 'Ingrese un nombre completo no vacío',
  email: 'Ingrese un correo institucional válido terminado en .edu.co',
  role: 'Seleccione el rol Docente',
  password: 'Use al menos 8 caracteres, una mayúscula, una minúscula y un número',
};

export class AccountError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 410 | 503, public code: string, message: string,
    public fields?: FieldError[]) { super(message); }
}

// Only call this after authorizing an administrator, or after verifying an invitation token.
export function parseProfileInput<T>(schema: ZodType<T>, input: unknown, field?: ProfileField): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields = [...new Set(result.error.issues.map((issue) => field ?? issue.path[0])
    .filter((name): name is ProfileField => typeof name === 'string' && name in fieldReasons))]
    .map((name) => ({ field: name, reason: fieldReasons[name] }));
  throw new AccountError(400, 'INVALID_INPUT', 'Corrija los datos indicados', fields.length ? fields : undefined);
}

export function fail(c: Context, error: unknown) {
  if (error instanceof AccountError) return c.json({ code: error.code, message: error.message,
    ...(error.fields ? { fields: error.fields } : {}) }, error.status);
  if (error instanceof ZodError || error instanceof SyntaxError) return c.json({ code: 'INVALID_INPUT', message: 'Solicitud inválida' }, 400);
  const cause = error instanceof Error && 'cause' in error ? error.cause : error;
  if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505') return c.json({ code: 'CONFLICT', message: 'El recurso ya existe' }, 409);
  if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '22P02') return c.json({ code: 'NOT_FOUND', message: 'Recurso no encontrado' }, 404);
  return c.json({ code: 'UNAVAILABLE', message: 'Operación no confirmada' }, 503 as ContentfulStatusCode);
}
