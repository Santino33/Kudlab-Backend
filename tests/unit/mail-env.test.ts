import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const smtp = () => ({ ...process.env, NODE_ENV: 'production', MAIL_MODE: 'smtp', MAIL_HOST: 'smtp.gmail.com',
  MAIL_PORT: '587', MAIL_USER: 'sender@gmail.com', MAIL_PASSWORD: 'private-app-password', MAIL_FROM: 'sender@gmail.com',
  EMAIL_CHANGE_BASE_URL: 'http://localhost:5173/change-email' });

describe('mail configuration', () => {
  it('accepts SMTP with default port and preserves password', () => {
    const { MAIL_PORT: _port, ...source } = smtp();
    expect(loadEnv({ ...source, MAIL_PASSWORD: ' space-is-significant ' })).toMatchObject({ MAIL_PORT: 587,
      MAIL_PASSWORD: ' space-is-significant ', EMAIL_CHANGE_BASE_URL: 'http://localhost:5173/change-email' });
  });
  it.each(['MAIL_HOST', 'MAIL_USER', 'MAIL_PASSWORD', 'MAIL_FROM'] as const)('rejects missing/blank %s', (key) => {
    for (const value of [undefined, '', '   ']) expect(() => loadEnv({ ...smtp(), [key]: value })).toThrow(key);
  });
  it.each(['0', '-1', '65536', '1.5', 'bad'])('rejects port %s', (MAIL_PORT) => {
    expect(() => loadEnv({ ...smtp(), MAIL_PORT })).toThrow('MAIL_PORT');
  });
  it.each(['127.0.0.1', 'https://smtp.gmail.com', 'smtp.gmail.com\r\n', 'smtp gmail.com'])('rejects host %j', (MAIL_HOST) => {
    expect(() => loadEnv({ ...smtp(), MAIL_HOST })).toThrow('MAIL_HOST');
  });
  it.each(['INVITATION_BASE_URL', 'EMAIL_CHANGE_BASE_URL', 'RESET_BASE_URL'] as const)('validates public %s', (key) => {
    for (const value of ['https://other.example/action', 'http://evil.example/action', 'http://localhost:5173/action?token=private',
      'http://localhost:5173/action#private', 'http://user:private@localhost:5173/action', undefined]) {
      expect(() => loadEnv({ ...smtp(), [key]: value })).toThrow(key);
    }
  });
  it('separates invitation and email change screens', () => {
    expect(() => loadEnv({ ...smtp(), EMAIL_CHANGE_BASE_URL: process.env.INVITATION_BASE_URL })).toThrow('EMAIL_CHANGE_BASE_URL');
  });
  it('uses supplied NODE_ENV, not the ambient test environment', () => {
    expect(() => loadEnv({ ...smtp(), NODE_ENV: 'production', MAIL_MODE: 'capture' })).toThrow('MAIL_MODE');
    expect(loadEnv({ ...smtp(), NODE_ENV: 'test', MAIL_MODE: 'capture' }).MAIL_MODE).toBe('capture');
  });
  it('does not reflect invalid values in errors', () => {
    const secret = 'SENSITIVE-SENTINEL';
    try { loadEnv({ ...smtp(), MAIL_FROM: secret, MAIL_PORT: secret, RESET_BASE_URL: secret }); }
    catch (error) { expect(String(error)).not.toContain(secret); expect(String(error)).toContain('MAIL_FROM'); return; }
    throw new Error('Invalid settings accepted');
  });
  it.each(['SPA_ORIGIN', 'BETTER_AUTH_URL', 'INVITATION_BASE_URL', 'RESET_BASE_URL', 'EMAIL_CHANGE_BASE_URL'] as const)('never leaks malformed URL values in %s', (key) => {
    try { loadEnv({ ...smtp(), [key]: 'PRIVATE-URL-SENTINEL' }); }
    catch (error) { expect(String(error)).toContain(key); expect(String(error)).not.toContain('PRIVATE-URL-SENTINEL'); return; }
    throw new Error('Invalid URL accepted');
  });
});
