import nodemailer from 'nodemailer';
import { z } from 'zod';
import { loadEnv } from '../../../config/env.js';

const purposeSchema = z.enum(['invitation', 'email-change', 'password-recovery']);
export type MailPurpose = z.infer<typeof purposeSchema>;
type Category = 'validation' | 'configuration' | 'dns' | 'connection' | 'tls' | 'auth' | 'recipient' | 'message' |
  'timeout' | 'network' | 'inconsistent' | 'persistence';
export type MailOutcome = { outcome: 'accepted' | 'rejected' | 'unknown'; category?: Category };
export type MailRequest = { purpose: MailPurpose; operationId: string; to: string; url: string };
const controls = /[\u0000-\u001f\u007f]/;
const inputSchema = z.object({ purpose: purposeSchema, operationId: z.uuid(),
  to: z.email().refine((v) => !controls.test(v) && v.split('@')[1]!.toLowerCase().endsWith('.edu.co')),
  url: z.string().url().refine((v) => !controls.test(v)) });
const content = {
  invitation: { subject: 'Activa tu cuenta de Kudlab', action: 'Para activar tu cuenta, abre este enlace y establece tu contraseña.' },
  'email-change': { subject: 'Confirma tu cambio de correo en Kudlab', action: 'Para confirmar tu nuevo correo, abre este enlace.' },
  'password-recovery': { subject: 'Recupera tu acceso a Kudlab', action: 'Para recuperar tu acceso, abre este enlace y establece una nueva contraseña.' },
} as const;
export const capturedMail: (MailRequest & { from: { name: string; address: string }; subject: string; text: string })[] = [];

export function recordMailDiagnostic(request: Pick<MailRequest, 'purpose' | 'operationId'>, result: MailOutcome) {
  // Construct an allowlist; never serialize provider error/info, addresses or message content.
  if (!purposeSchema.safeParse(request.purpose).success || !z.uuid().safeParse(request.operationId).success) return;
  try { console.info(JSON.stringify({ event: 'mail_attempt', occurredAt: new Date().toISOString(),
    operationId: request.operationId, purpose: request.purpose, outcome: result.outcome,
    ...(result.category ? { category: result.category } : {}) })); }
  catch { /* Diagnostic failure cannot change transport evidence or trigger another send. */ }
}

function failure(error: unknown): MailOutcome {
  const e = (typeof error === 'object' && error !== null ? error : {}) as Record<string, unknown>;
  const command = typeof e.command === 'string' ? e.command : '';
  const negative = typeof e.responseCode === 'number' && e.responseCode >= 400 && e.responseCode < 600;
  if (negative && /^(AUTH|MAIL FROM|RCPT TO|DATA)(?:\s|$)/.test(command)) {
    return { outcome: 'rejected', category: command.startsWith('AUTH') ? 'auth' : command.startsWith('RCPT') ? 'recipient' : 'message' };
  }
  // These codes prove a failure before message transmission. Generic socket/CONN errors do NOT.
  if (e.code === 'EDNS') return { outcome: 'rejected', category: 'dns' };
  if (e.code === 'ECONNREFUSED' || (e.code === 'ESOCKET' && e.errno === 'ECONNREFUSED')) return { outcome: 'rejected', category: 'connection' };
  if (e.code === 'ETLS' || ['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
    'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(String(e.code)))
    return { outcome: 'rejected', category: 'tls' };
  return { outcome: 'unknown', category: e.code === 'ETIMEDOUT' ? 'timeout' : 'network' };
}

export async function sendTransactionalMail(input: MailRequest): Promise<MailOutcome> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    const result: MailOutcome = { outcome: 'rejected', category: 'validation' };
    recordMailDiagnostic(input, result); return result;
  }
  const request = parsed.data;
  let env: ReturnType<typeof loadEnv>;
  try { env = loadEnv(); } catch {
    const result: MailOutcome = { outcome: 'rejected', category: 'configuration' };
    recordMailDiagnostic(request, result); return result;
  }
  const base = { invitation: env.INVITATION_BASE_URL, 'email-change': env.EMAIL_CHANGE_BASE_URL, 'password-recovery': env.RESET_BASE_URL }[request.purpose];
  const target = new URL(request.url);
  const baseUrl = new URL(base);
  const token = target.searchParams.get('token');
  if (target.origin !== baseUrl.origin || target.pathname !== baseUrl.pathname || target.username || target.password || target.hash ||
      !token || [...target.searchParams.keys()].length !== 1 || !target.searchParams.has('token')) {
    const result: MailOutcome = { outcome: 'rejected', category: 'validation' };
    recordMailDiagnostic(request, result); return result;
  }
  const message = { ...request, from: { name: 'Kudlab', address: env.MAIL_FROM ?? 'test-only@pilot.edu.co' },
    subject: content[request.purpose].subject,
    text: `Kudlab\n\n${content[request.purpose].action}\n${request.url}\n\nSi no reconoces esta solicitud, ignora este mensaje.` };
  let result: MailOutcome;
  if (env.MAIL_MODE === 'capture') {
    capturedMail.push(message); result = { outcome: 'accepted' };
  } else {
    const transport = nodemailer.createTransport({ host: env.MAIL_HOST, port: env.MAIL_PORT, secure: env.MAIL_PORT === 465,
      requireTLS: true, auth: { user: env.MAIL_USER, pass: env.MAIL_PASSWORD },
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true }, pool: false,
      dnsTimeout: 30000, connectionTimeout: 30000, greetingTimeout: 30000, socketTimeout: 600000,
      logger: false, debug: false, transactionLog: false, disableFileAccess: true, disableUrlAccess: true });
    try {
      const info = await transport.sendMail({ from: message.from, to: { name: '', address: request.to }, subject: message.subject,
        text: message.text, envelope: { from: message.from.address, to: [request.to] } });
      const accepted = info.accepted?.includes(request.to) === true;
      const rejected = info.rejected?.includes(request.to) === true;
      result = accepted && !rejected ? { outcome: 'accepted' } : rejected && !accepted ? { outcome: 'rejected', category: 'recipient' } :
        { outcome: 'unknown', category: 'inconsistent' };
    } catch (error) { result = failure(error); }
    finally { transport.close(); }
  }
  recordMailDiagnostic(request, result);
  return result;
}
