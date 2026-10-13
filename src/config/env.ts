import { z } from 'zod';

const url = z.string().url().refine((value) => {
  const parsed = new URL(value);
  return (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) && !parsed.username && !parsed.password && parsed.pathname === '/';
}, 'Debe ser un origen HTTPS (o localhost HTTP) sin ruta ni credenciales');

const schema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgres'),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: url,
  SPA_ORIGIN: url,
  INVITATION_BASE_URL: z.string().url(),
  MAIL_MODE: z.enum(['smtp', 'capture']).default('smtp'),
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  MAIL_USER: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().email().optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().optional(),
  BOOTSTRAP_ADMIN_EMAIL: z.string().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().optional(),
}).superRefine((config, ctx) => {
  if (config.MAIL_MODE === 'capture' && process.env.NODE_ENV !== 'test') ctx.addIssue({ code: 'custom', message: 'Captura de correo solo en pruebas' });
  if (config.MAIL_MODE === 'smtp' && ![config.MAIL_HOST, config.MAIL_USER, config.MAIL_PASSWORD, config.MAIL_FROM].every(Boolean)) ctx.addIssue({ code: 'custom', message: 'Proveedor de correo incompleto' });
});

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  return schema.parse(source);
}

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
