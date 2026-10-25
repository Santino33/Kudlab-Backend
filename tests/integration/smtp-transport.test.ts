import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import { sendTransactionalMail } from '../../src/modules/usuarios/shared/transactional-mail.js';
import { startSmtp } from '../fixtures/smtp/server.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe('strict local SMTP transport', () => {
  it.each([
    ['accept', false, true, false, 'accepted'],
    ['accept', true, true, false, 'accepted'],
    ['no-starttls', false, true, false, 'rejected'],
    ['accept', false, false, false, 'rejected'],
    ['accept', false, true, true, 'rejected'],
    ['reject-auth', false, true, false, 'rejected'],
    ['reject-recipient', false, true, false, 'rejected'],
    ['reject-data', false, true, false, 'rejected'],
    ['disconnect-data', false, true, false, 'unknown'],
  ] as const)('%s implicit=%s trusted=%s wrongName=%s -> %s', async (mode, implicit, trusted, wrongName, expected) => {
    const server = await startSmtp(mode, implicit);
    const create = nodemailer.createTransport.bind(nodemailer);
    vi.spyOn(nodemailer, 'createTransport').mockImplementation((input) => {
      const options = trusted ? server.trust(input) : input as SMTPTransport.Options;
      if (wrongName) options.tls = { ...options.tls, servername: 'not-localhost.example' };
      return create(options);
    });
    for (const [key, value] of Object.entries(server.env)) vi.stubEnv(key, value);
    try {
      const result = await sendTransactionalMail({ purpose: 'invitation', operationId: randomUUID(),
        to: 'test@pilot.edu.co', url: 'http://localhost:5173/accept?token=fictitious' });
      expect(result.outcome).toBe(expected);
      expect(server.attempts).toBeLessThanOrEqual(1);
      const transmitted = mode === 'accept' && trusted && !wrongName || mode === 'reject-data' || mode === 'disconnect-data';
      expect(server.messages).toHaveLength(transmitted ? 1 : 0);
      expect(nodemailer.createTransport).toHaveBeenCalledOnce();
    } finally { await server.close(); }
  });
});
