import { z } from 'zod';
import { invalidNote, type NoteFieldError } from './notes.errors.js';
import { invalidInput, notFound } from '../shared/academic.errors.js';

export const SUBJECTS = ['LENGUAJE', 'MATEMATICAS'] as const;
export type Subject = (typeof SUBJECTS)[number];

// Escala 1.0–5.0 con un decimal y punto como separador (D-02): 1–4 con decimal opcional, o 5 / 5.0.
const SCORE = /^(?:[1-4](?:\.[0-9])?|5(?:\.0)?)$/;

function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalidInput();
  return input as Record<string, unknown>;
}

export function noteUuid(value: string) {
  if (!z.uuid().safeParse(value).success) throw notFound();
  return value;
}

export function scoreProblem(value: unknown): NoteFieldError['reason'] | null {
  if (value == null || (typeof value === 'string' && !value.trim())) return 'required';
  if (typeof value !== 'string') return 'invalid_format';
  if (SCORE.test(value)) return null;
  if (/^[0-9]+\.[0-9]{2,}$/.test(value)) return 'too_many_decimals';
  if (/^[0-9]+(?:\.[0-9])?$/.test(value)) return 'out_of_range';
  return 'invalid_format';
}

// Normaliza a un decimal («4» → «4.0»).
export function normalizeScore(value: string) {
  return value.includes('.') ? value : `${value}.0`;
}

function scoreOf(data: Record<string, unknown>, errors: NoteFieldError[]) {
  const problem = scoreProblem(data.score);
  if (problem) { errors.push({ field: 'score', reason: problem }); return undefined; }
  return normalizeScore(data.score as string);
}

export function parseNoteCreate(input: unknown) {
  const data = object(input);
  if (Object.keys(data).some((key) => !['subject', 'term', 'score'].includes(key))) throw invalidInput();
  const errors: NoteFieldError[] = [];
  let subject: Subject | undefined;
  if (data.subject == null) errors.push({ field: 'subject', reason: 'required' });
  else if (!SUBJECTS.includes(data.subject as Subject)) errors.push({ field: 'subject', reason: 'invalid_format' });
  else subject = data.subject as Subject;
  let term: number | undefined;
  if (data.term == null) errors.push({ field: 'term', reason: 'required' });
  else if (typeof data.term !== 'number' || !Number.isInteger(data.term)) errors.push({ field: 'term', reason: 'invalid_format' });
  else if (data.term < 1 || data.term > 4) errors.push({ field: 'term', reason: 'out_of_range' });
  else term = data.term;
  const score = scoreOf(data, errors);
  if (errors.length) throw invalidNote(errors);
  return { subject: subject!, term: term!, score: score! };
}

export function parseNoteUpdate(input: unknown) {
  const data = object(input);
  if (Object.keys(data).some((key) => !['score', 'expectedVersion'].includes(key))) throw invalidInput();
  const errors: NoteFieldError[] = [];
  const score = scoreOf(data, errors);
  const version = data.expectedVersion;
  if (version == null) errors.push({ field: 'version', reason: 'required' });
  else if (typeof version !== 'number' || !Number.isInteger(version) || version < 1)
    errors.push({ field: 'version', reason: 'invalid_format' });
  if (errors.length) throw invalidNote(errors);
  return { score: score!, expectedVersion: version as number };
}

// Cualquier parámetro de consulta se rechaza (el router no depende del catch-all de estudiantes).
export function rejectQuery(url: string) {
  if (new URL(url).searchParams.size) throw invalidInput();
}
