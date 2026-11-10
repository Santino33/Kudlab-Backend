import { createHash } from 'node:crypto';

// Cursor opaco ligado al estudiante y a los filtros: un cursor de otra consulta se rechaza (400).
export type CursorFilter = { studentId: string; taskId?: string; metricCode?: string; scope?: string; from?: string; to?: string };
export type CursorPosition = { at: Date; id: string };
export class InvalidCursorError extends Error { readonly code = 'INVALID_INPUT'; constructor() { super('Cursor no válido.'); this.name = 'InvalidCursorError'; } }

const fingerprint = (f: CursorFilter) => createHash('sha256').update(JSON.stringify([f.studentId, f.taskId ?? null, f.metricCode ?? null, f.scope ?? null, f.from ?? null, f.to ?? null])).digest('hex').slice(0, 16);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function encodeCursor(filter: CursorFilter, position: CursorPosition): string {
  return Buffer.from(JSON.stringify({ v: 1, f: fingerprint(filter), at: position.at.toISOString(), id: position.id })).toString('base64url');
}
export function decodeCursor(value: string, filter: CursorFilter): CursorPosition {
  try {
    const raw = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { v?: unknown; f?: unknown; at?: unknown; id?: unknown };
    if (raw.v !== 1 || raw.f !== fingerprint(filter) || typeof raw.id !== 'string' || !UUID.test(raw.id) || typeof raw.at !== 'string') throw new InvalidCursorError();
    const at = new Date(raw.at);
    if (Number.isNaN(at.getTime()) || at.toISOString() !== raw.at) throw new InvalidCursorError();
    return { at, id: raw.id };
  } catch (error) { throw error instanceof InvalidCursorError ? error : new InvalidCursorError(); }
}
