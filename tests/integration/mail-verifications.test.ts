import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../src/db/client.js';
import { emailChanges } from '../../src/db/schema/accounts.js';
import { passwordRecoveryVerifications } from '../../src/db/schema/authentication.js';
import { capturedMail } from '../../src/modules/usuarios/shared/transactional-mail.js';
import { inviteTeacher, request, reset } from '../helpers.js';
import { startSmtp } from '../fixtures/smtp/server.js';

describe('transactional verification content and lifecycle', () => {
  beforeEach(reset);
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  it('uses distinct purposes, correct recipients and real operation IDs', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    capturedMail.length = 0;
    expect((await request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: 'new@pilot.edu.co' }, teacher)).status).toBe(403);
    expect(capturedMail).toHaveLength(0);
    expect((await request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: 'new@pilot.edu.co' }, admin)).status).toBe(200);
    const change = capturedMail.at(-1)!;
    const [storedChange] = await db.select().from(emailChanges).where(eq(emailChanges.accountId, account.id));
    expect(change).toMatchObject({ purpose: 'email-change', to: 'new@pilot.edu.co', operationId: storedChange!.id,
      subject: 'Confirma tu cambio de correo en Kudlab' });
    expect(new URL(change.url).pathname).toBe('/change-email');
    const pending = await (await request(`/api/v1/accounts/${account.id}`, 'GET', undefined, admin)).json();
    expect(pending.email).toBe('teacher@pilot.edu.co');
    expect((await request('/api/v1/auth/password-recovery/request', 'POST', { email: 'teacher@pilot.edu.co' })).status).toBe(202);
    const recovery = capturedMail.at(-1)!;
    const [storedRecovery] = await db.select().from(passwordRecoveryVerifications).where(eq(passwordRecoveryVerifications.accountId, account.id));
    expect(recovery).toMatchObject({ purpose: 'password-recovery', to: 'teacher@pilot.edu.co', operationId: storedRecovery!.id,
      subject: 'Recupera tu acceso a Kudlab' });
    expect(new URL(recovery.url).pathname).toBe('/reset-password');
    expect(capturedMail).toHaveLength(2);
    expect((await request('/api/v1/account-email-changes/confirm', 'POST', { token: new URL(change.url).searchParams.get('token') })).status).toBe(200);
    expect((await request('/api/v1/account-email-changes/confirm', 'POST', { token: new URL(change.url).searchParams.get('token') })).status).toBe(410);
    expect((await request('/api/v1/auth/password-recovery/confirm', 'POST', { token: new URL(recovery.url).searchParams.get('token'), newPassword: 'ChangedPass123' })).status).toBe(410);
  });
  it.each(['accept', 'reject-data', 'disconnect-data'] as const)('handles real TLS SMTP %s in both verification flows', async (mode) => {
    const { account, admin } = await inviteTeacher();
    const server = await startSmtp(mode);
    const original = nodemailer.createTransport.bind(nodemailer);
    vi.spyOn(nodemailer, 'createTransport').mockImplementation((options) => original(server.trust(options)));
    for (const [key, value] of Object.entries(server.env)) vi.stubEnv(key, value);
    try {
      const change = await request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: 'new@pilot.edu.co' }, admin);
      expect(change.status).toBe(mode === 'accept' ? 200 : 503);
      if (mode !== 'accept') expect((await change.json()).code).toBe(mode === 'reject-data' ? 'DELIVERY_FAILED' : 'DELIVERY_STATUS_UNKNOWN');
      const recovery = await request('/api/v1/auth/password-recovery/request', 'POST', { email: 'teacher@pilot.edu.co' });
      expect(recovery.status).toBe(202);
      expect(await recovery.json()).toEqual({ message: 'Si corresponde, recibirás instrucciones en tu correo.' });
      expect(server.messages).toHaveLength(2); expect(server.attempts).toBe(2);
    } finally { await server.close(); }
  });
});
