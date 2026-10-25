import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturedMail, sendTransactionalMail, type MailRequest } from '../../src/modules/usuarios/shared/transactional-mail.js';

const request = (changes: Partial<MailRequest> = {}): MailRequest => ({ purpose: 'invitation', operationId: randomUUID(),
  to: 'teacher@pilot.edu.co', url: 'http://localhost:5173/accept?token=fictitious', ...changes });
const smtp = () => { vi.stubEnv('MAIL_MODE', 'smtp'); vi.stubEnv('MAIL_HOST', 'smtp.gmail.com'); vi.stubEnv('MAIL_USER', 'sender@gmail.com');
  vi.stubEnv('MAIL_PASSWORD', 'private'); vi.stubEnv('MAIL_FROM', 'sender@gmail.com'); };
const stubTransport = () => {
  const sendMail = vi.fn().mockResolvedValue({ accepted: ['teacher@pilot.edu.co'], rejected: [] });
  vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail, close: vi.fn() } as unknown as ReturnType<typeof nodemailer.createTransport>);
  return sendMail;
};
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); capturedMail.length = 0; });

describe('transactional mail', () => {
  it.each([
    ['invitation', '/accept', 'Activa tu cuenta de Kudlab'],
    ['email-change', '/change-email', 'Confirma tu cambio de correo en Kudlab'],
    ['password-recovery', '/reset-password', 'Recupera tu acceso a Kudlab'],
  ] as const)('captures %s with the same plain-text content used by SMTP', async (purpose, path, subject) => {
    vi.spyOn(nodemailer, 'createTransport');
    const input = request({ purpose, url: `http://localhost:5173${path}?token=fictitious` });
    expect(await sendTransactionalMail(input)).toEqual({ outcome: 'accepted' });
    expect(capturedMail).toHaveLength(1);
    expect(capturedMail[0]).toMatchObject({ ...input, subject, from: { name: 'Kudlab', address: expect.any(String) } });
    expect(capturedMail[0]!.text).toContain(input.url);
    expect(capturedMail[0]!.text).toContain('ignora');
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
  it('requires a real UUID and a single institutional mailbox without controls', async () => {
    for (const changes of [{ operationId: 'token' }, { to: 'a@pilot.edu.co,b@pilot.edu.co' }, { to: 'a@pilot.edu.co\r\nBcc:x@y.edu.co' },
      { to: 'a@pilot.edu.co\0' }, { purpose: 'marketing' }, { url: 'https://evil.example/?token=x' },
      { url: 'http://localhost:5173/reset-password?token=x' }, { url: 'http://localhost:5173/accept?token=x&other=1' }]) {
      const result = await sendTransactionalMail(request(changes as Partial<MailRequest>));
      expect(result).toEqual({ outcome: 'rejected', category: 'validation' });
    }
    expect(capturedMail).toHaveLength(0);
  });
  it('uses strict TLS and a single addressed envelope in SMTP mode', async () => {
    smtp(); const sendMail = stubTransport();
    expect(await sendTransactionalMail(request())).toEqual({ outcome: 'accepted' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: false, requireTLS: true,
      pool: false, logger: false, debug: false, transactionLog: false, dnsTimeout: 30000, connectionTimeout: 30000,
      greetingTimeout: 30000, socketTimeout: 600000, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      disableFileAccess: true, disableUrlAccess: true }));
    expect(sendMail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ to: { address: 'teacher@pilot.edu.co', name: '' },
      envelope: { from: 'sender@gmail.com', to: ['teacher@pilot.edu.co'] }, from: { name: 'Kudlab', address: 'sender@gmail.com' } }));
  });
  it('selects implicit TLS for 465', async () => {
    smtp(); vi.stubEnv('MAIL_PORT', '465'); stubTransport(); await sendTransactionalMail(request());
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ secure: true }));
  });
  it.each([
    [{ accepted: ['teacher@pilot.edu.co'], rejected: [] }, 'accepted'],
    [{ accepted: [], rejected: ['teacher@pilot.edu.co'] }, 'rejected'],
    [{ accepted: [], rejected: [] }, 'unknown'],
    [{ accepted: ['teacher@pilot.edu.co'], rejected: ['teacher@pilot.edu.co'] }, 'unknown'],
  ])('classifies SMTP evidence without delivery claims', async (info, expected) => {
    smtp(); stubTransport().mockResolvedValue(info);
    expect((await sendTransactionalMail(request())).outcome).toBe(expected);
  });
  it.each([
    [{ code: 'EAUTH', command: 'AUTH PLAIN', responseCode: 535 }, 'rejected'],
    [{ code: 'EENVELOPE', command: 'RCPT TO', responseCode: 550 }, 'rejected'],
    [{ code: 'EMESSAGE', command: 'DATA', responseCode: 451 }, 'rejected'],
    [{ code: 'ESOCKET', command: 'CONN' }, 'unknown'],
    [{ code: 'ETIMEDOUT', command: 'CONN' }, 'unknown'],
    [{ code: 'EMESSAGE', command: 'DATA', responseCode: 354 }, 'unknown'],
  ])('classifies errors conservatively and does not retry', async (error, expected) => {
    smtp(); const send = stubTransport().mockRejectedValue(Object.assign(new Error('do not log this'), error));
    expect((await sendTransactionalMail(request())).outcome).toBe(expected); expect(send).toHaveBeenCalledTimes(1);
  });
});
