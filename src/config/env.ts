import { z } from 'zod';
import { isIP } from 'node:net';

const controls = /[\u0000-\u001f\u007f]/;
const publicUrl = z.string().url().refine((value) => !controls.test(value) && value === value.trim());

const url = z.string().url().refine((value) => {
  try {
    const parsed = new URL(value);
    return !controls.test(value) && value === value.trim() &&
      (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) &&
      !parsed.username && !parsed.password && !parsed.search && !parsed.hash && parsed.pathname === '/';
  } catch { return false; }
}, 'Debe ser un origen HTTPS (o localhost HTTP) sin ruta ni credenciales');

const schema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.string().url().startsWith('postgres'),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: url,
  SPA_ORIGIN: url,
  INVITATION_BASE_URL: publicUrl,
  EMAIL_CHANGE_BASE_URL: publicUrl,
  RESET_BASE_URL: publicUrl,
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
  const issue = (key: string) => ctx.addIssue({ code: 'custom', path: [key], message: 'Configuración inválida' });
  if (config.MAIL_MODE === 'capture' && config.NODE_ENV !== 'test') issue('MAIL_MODE');
  if (config.MAIL_MODE === 'smtp') {
    for (const key of ['MAIL_HOST', 'MAIL_USER', 'MAIL_PASSWORD', 'MAIL_FROM'] as const)
      if (!config[key]?.trim()) issue(key);
    const host = config.MAIL_HOST;
    if (host && (isIP(host) || host.length > 253 || !host.split('.').every((label) => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label)))) issue('MAIL_HOST');
    if (config.MAIL_USER && controls.test(config.MAIL_USER)) issue('MAIL_USER');
  }
  if (config.MAIL_FROM && controls.test(config.MAIL_FROM)) issue('MAIL_FROM');
  let spaOrigin: string;
  try { spaOrigin = new URL(config.SPA_ORIGIN).origin; } catch { return; } // The field schema already reports SPA_ORIGIN.
  for (const key of ['INVITATION_BASE_URL', 'EMAIL_CHANGE_BASE_URL', 'RESET_BASE_URL'] as const) {
    let target: URL;
    try { target = new URL(config[key]); } catch { issue(key); continue; }
    if (target.origin !== spaOrigin || target.username || target.password || target.search || target.hash ||
      !(target.protocol === 'https:' || (target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname)))) issue(key);
  }
  if (config.INVITATION_BASE_URL === config.EMAIL_CHANGE_BASE_URL) issue('EMAIL_CHANGE_BASE_URL');
});

export class ConfigurationError extends Error {
  constructor(fields: string[]) { super(`Configuración inválida: ${fields.join(', ')}. Revise los ajustes indicados.`); }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) throw new ConfigurationError([...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? 'entorno')))]);
  return result.data;
}

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
