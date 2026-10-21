import { z } from 'zod';

export const institutionalEmail = z.email().transform((v) => v.trim().toLowerCase()).refine((v) => v.split('@')[1]?.endsWith('.edu.co') === true, 'Se requiere correo .edu.co');
export const nameSchema = z.string().trim().min(1).max(200);
export const createAccountSchema = z.strictObject({ name: nameSchema, email: institutionalEmail, role: z.literal('TEACHER') });
export const updateAccountSchema = z.strictObject({ name: nameSchema.optional(), email: institutionalEmail.optional() }).refine((x) => x.name !== undefined || x.email !== undefined);
export const passwordSchema = z.string().min(8).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/);
