import { spawn, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const cwd = new URL('../..', import.meta.url);
const settings = () => ({ ...process.env, NODE_ENV: 'production', MAIL_MODE: 'smtp', MAIL_HOST: 'localhost', MAIL_PORT: '1',
  MAIL_USER: 'sender@gmail.com', MAIL_PASSWORD: 'PRIVATE-STARTUP-PASSWORD', MAIL_FROM: 'sender@gmail.com', PORT: '0' });

describe('startup config gate', () => {
  it.each([
    ['MAIL_MODE', { MAIL_MODE: 'capture' }],
    ['MAIL_PASSWORD', { MAIL_PASSWORD: '' }],
    ['EMAIL_CHANGE_BASE_URL', { EMAIL_CHANGE_BASE_URL: 'https://private-sentinel.example/invalid' }],
  ])('stops before database/bootstrap/listen for invalid %s', (key, changes) => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd,
      env: { ...settings(), DATABASE_URL: 'postgres://nobody:PRIVATE-DB-PASSWORD@127.0.0.1:1/no_database', ...changes },
      encoding: 'utf8', timeout: 10000 });
    expect(result.error).toBeUndefined(); expect(result.status).not.toBe(0);
    const output = result.stdout + result.stderr;
    expect(output).toContain('Configuración inválida'); expect(output).toContain(key);
    for (const secret of ['PRIVATE-STARTUP-PASSWORD', 'PRIVATE-DB-PASSWORD', 'private-sentinel', 'ECONNREFUSED']) expect(output).not.toContain(secret);
  });
  it('starts with valid settings even when SMTP is unavailable', async () => {
    const child = spawn(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
      "await import('./src/index.ts'); console.log('STARTUP_READY');"], { cwd, env: settings(), stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Startup did not become ready')), 10000);
        const finish = (error?: Error) => { clearTimeout(timer); error ? reject(error) : resolve(); };
        child.on('error', finish);
        child.stderr.on('data', (chunk) => { output += chunk.toString(); });
        child.stdout.on('data', (chunk) => { output += chunk.toString(); if (output.includes('STARTUP_READY')) finish(); });
        child.once('exit', (code) => { if (!output.includes('STARTUP_READY')) finish(new Error(`Premature startup exit ${code}`)); });
      });
      expect(output).not.toContain('PRIVATE-STARTUP-PASSWORD');
    } finally { child.kill('SIGTERM'); await closed; }
  });
});
