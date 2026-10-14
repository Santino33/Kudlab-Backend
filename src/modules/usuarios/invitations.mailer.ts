import nodemailer from 'nodemailer';
import { loadEnv } from '../../config/env.js';

export type Mailer = (to: string, url: string) => Promise<void>;
export const capturedMail: { to: string; url: string }[] = [];

export function makeMailer(subject = 'Acceso a Kudlab'): Mailer {
  const env = loadEnv();
  if (env.MAIL_MODE === 'capture') return async (to, url) => { capturedMail.push({ to, url }); };
  const transport = nodemailer.createTransport({ host: env.MAIL_HOST, port: env.MAIL_PORT,
    secure: env.MAIL_PORT === 465, auth: { user: env.MAIL_USER, pass: env.MAIL_PASSWORD } });
  return async (to, url) => {
    const result = await transport.sendMail({ from: env.MAIL_FROM, to, subject, text: `Enlace de verificación: ${url}` });
    if (!result.accepted.includes(to)) throw new Error('Entrega no confirmada');
  };
}
