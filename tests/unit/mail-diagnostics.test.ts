import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { capturedMail, sendTransactionalMail, type MailPurpose } from '../../src/modules/usuarios/shared/transactional-mail.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); capturedMail.length = 0; });
describe('mail privacy and diagnostics', () => {
  it.each(['invitation', 'email-change', 'password-recovery'] satisfies MailPurpose[])('logs allowlisted metadata for %s only', async (purpose) => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const send = vi.fn().mockRejectedValue(Object.assign(new Error('PRIVATE-BODY PRIVATE-PASSWORD private@pilot.edu.co'), {
      code: 'ESOCKET', command: 'CONN', response: 'PRIVATE-RESPONSE', token: 'PRIVATE-TOKEN',
    }));
    vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: send, close: vi.fn() } as unknown as ReturnType<typeof nodemailer.createTransport>);
    vi.stubEnv('MAIL_MODE', 'smtp'); vi.stubEnv('MAIL_HOST', 'smtp.gmail.com'); vi.stubEnv('MAIL_PORT', '587');
    vi.stubEnv('MAIL_USER', 'private@gmail.com'); vi.stubEnv('MAIL_PASSWORD', 'PRIVATE-PASSWORD'); vi.stubEnv('MAIL_FROM', 'private@gmail.com');
    const path = { invitation: 'accept', 'email-change': 'change-email', 'password-recovery': 'reset-password' }[purpose];
    const operationId = randomUUID();
    const result = await sendTransactionalMail({ purpose, operationId, to: 'private@pilot.edu.co', url: `http://localhost:5173/${path}?token=PRIVATE-TOKEN` });
    expect(result.outcome).toBe('unknown'); expect(send).toHaveBeenCalledOnce(); expect(log).toHaveBeenCalledOnce();
    const event = JSON.parse(log.mock.calls[0]![0] as string);
    expect(event).toEqual({ event: 'mail_attempt', purpose, operationId, occurredAt: expect.any(String), outcome: 'unknown', category: 'network' });
    expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
    const output = JSON.stringify(log.mock.calls);
    for (const value of ['PRIVATE-', 'private@', '?token=', 'http:', 'digest']) expect(output).not.toContain(value);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ logger: false, debug: false, transactionLog: false }));
  });
  it('sink failure does not change acceptance or cause another send', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => { throw new Error('sink unavailable'); });
    const create = vi.spyOn(nodemailer, 'createTransport');
    expect(await sendTransactionalMail({ purpose: 'invitation', operationId: randomUUID(), to: 'test@pilot.edu.co',
      url: 'http://localhost:5173/accept?token=fictitious' })).toEqual({ outcome: 'accepted' });
    expect(capturedMail).toHaveLength(1); expect(create).not.toHaveBeenCalled();
  });
  it('capture uses generated text without networking and can be cleared', async () => {
    const create = vi.spyOn(nodemailer, 'createTransport');
    await sendTransactionalMail({ purpose: 'email-change', operationId: randomUUID(), to: 'test@pilot.edu.co',
      url: 'http://localhost:5173/change-email?token=fictitious' });
    expect(capturedMail[0]!.subject).toBe('Confirma tu cambio de correo en Kudlab');
    expect(capturedMail[0]!.text).toContain('ignora este mensaje'); expect(create).not.toHaveBeenCalled();
    capturedMail.length = 0; expect(capturedMail).toHaveLength(0);
  });
});
