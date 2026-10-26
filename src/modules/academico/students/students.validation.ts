import { z } from 'zod';
import { AcademicError, invalidInput, notFound, type AcademicField } from '../shared/academic.errors.js';

export function studentId(value: string) {
  if (!z.uuid().safeParse(value).success) throw notFound();
  return value;
}
function object(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalidInput();
  return input as Record<string, unknown>;
}
export function createGroupId(input: unknown) {
  const value = object(input).groupId;
  if (!z.uuid().safeParse(value).success)
    throw new AcademicError(400, 'INVALID_INPUT', 'Datos inválidos', { groupId: value == null ? 'required' : 'invalid_format' });
  return value as string;
}
function names(input: Record<string, unknown>, partial: boolean) {
  const output: Partial<Record<'studentCode' | 'firstName' | 'lastName', string>> = {};
  const fields: Partial<Record<AcademicField, string>> = {};
  for (const field of ['studentCode', 'firstName', 'lastName'] as const) {
    if (partial && !(field in input)) continue;
    const value = input[field];
    if (value == null) { fields[field] = 'required'; continue; }
    if (typeof value !== 'string') { fields[field] = 'invalid_type'; continue; }
    const trimmed = value.trim();
    if (!trimmed) fields[field] = 'required';
    else if ([...trimmed].length > (field === 'studentCode' ? 50 : 100)) fields[field] = 'too_long';
    else if (trimmed.includes('\0')) fields[field] = 'invalid_format';
    else output[field] = trimmed;
  }
  if (Object.keys(fields).length) throw new AcademicError(400, 'INVALID_INPUT', 'Datos inválidos', fields);
  return output;
}
export function parseStudentCreate(input: unknown) {
  const data = object(input);
  if (Object.keys(data).some((key) => !['groupId', 'studentCode', 'firstName', 'lastName'].includes(key))) throw invalidInput();
  const groupId = createGroupId(data);
  const parsed = names(data, false) as { studentCode: string; firstName: string; lastName: string };
  return { groupId, ...parsed };
}

export function parseStudentPatch(input: unknown) {
  const data = object(input);
  if (!Object.keys(data).length || Object.keys(data).some((key) => !['studentCode', 'firstName', 'lastName'].includes(key))) throw invalidInput();
  return names(data, true);
}
