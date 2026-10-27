import { z } from 'zod';
import { AcademicError, invalidInput, notFound, type AcademicField } from '../shared/academic.errors.js';

export function groupId(value: string) {
  if (!z.uuid().safeParse(value).success) throw notFound();
  return value;
}
const text = (max: number) => z.string().trim().min(1).refine(value => [...value].length <= max, 'too_long').refine(value => !value.includes('\0'));
const profile = z.strictObject({ name: text(50), grade: text(20), schoolYear: z.number().int().min(-2147483648).max(2147483647), teacherId: z.uuid() });
const patch = profile.partial().extend({ confirmTransfer: z.literal(true).optional() });
export function parseGroup(input: unknown, partial = false) {
  const result = (partial ? patch : profile).safeParse(input);
  if (!result.success) {
    const fields: Partial<Record<AcademicField, string>> = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (field === 'name' || field === 'grade' || field === 'schoolYear' || field === 'teacherId')
        fields[field] = issue.message === 'too_long' ? 'too_long' : issue.code === 'too_small' ? 'required' : 'invalid_format';
    }
    throw new AcademicError(400, 'INVALID_INPUT', 'Datos inválidos', fields);
  }
  const parsed: z.infer<typeof patch> = result.data;
  if (partial && !['name', 'grade', 'schoolYear', 'teacherId'].some(key => key in parsed)) throw invalidInput();
  return parsed;
}
