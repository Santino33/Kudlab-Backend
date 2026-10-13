import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

export class AccountError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 410 | 503, public code: string, message: string) { super(message); }
}

export function fail(c: Context, error: unknown) {
  if (error instanceof AccountError) return c.json({ code: error.code, message: error.message }, error.status);
  if (error instanceof ZodError || error instanceof SyntaxError) return c.json({ code: 'INVALID_INPUT', message: 'Solicitud inválida' }, 400);
  const cause = error instanceof Error && 'cause' in error ? error.cause : error;
  if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '23505') return c.json({ code: 'CONFLICT', message: 'El recurso ya existe' }, 409);
  if (typeof cause === 'object' && cause !== null && 'code' in cause && cause.code === '22P02') return c.json({ code: 'NOT_FOUND', message: 'Recurso no encontrado' }, 404);
  return c.json({ code: 'UNAVAILABLE', message: 'Operación no confirmada' }, 503 as ContentfulStatusCode);
}
