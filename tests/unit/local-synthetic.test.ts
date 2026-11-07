import { afterEach, expect, it, vi } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { startupGameDependencies } from '../../src/config/local-synthetic.js';
import { assertTestDatabase, participationProvider, syntheticEnabled, syntheticStudentActivation } from '../../src/modules/academico/shared/participation.js';

const local = () => ({ ...process.env, NODE_ENV: 'development', DATABASE_URL: 'postgres://kudlab:synthetic@postgres:5432/kudlab_local',
  KUDLAB_LOCAL_SYNTHETIC_ENABLED: 'true', KUDLAB_LOCAL_SYNTHETIC_DATA_CONFIRMED: 'true',
  GAME_RUNTIME_ORIGIN: 'http://127.0.0.1:4178', GAME_GRANT_KEYS: JSON.stringify({ local: 'ab'.repeat(32) }), GAME_ACTIVE_KEY_ID: 'local', GAME_CURSOR_KEY: 'cd'.repeat(32),
  MAIL_MODE: 'smtp', MAIL_HOST: 'smtp.invalid', MAIL_USER: 'synthetic', MAIL_PASSWORD: 'synthetic', MAIL_FROM: 'test@example.invalid' });
afterEach(() => vi.unstubAllEnvs());
function useLocal() { for (const [key, value] of Object.entries(local())) vi.stubEnv(key, value); }

it('CA-01/02/06: opt-in requires local development and an explicit synthetic-data declaration', () => {
  expect(loadEnv(local()).KUDLAB_LOCAL_SYNTHETIC_ENABLED).toBe(true);
  for (const patch of [ { NODE_ENV: 'production' }, { NODE_ENV: 'test' }, { NODE_ENV: undefined },
    { KUDLAB_LOCAL_SYNTHETIC_DATA_CONFIRMED: undefined }, { KUDLAB_LOCAL_SYNTHETIC_DATA_CONFIRMED: 'false' },
    { DATABASE_URL: 'postgres://localhost/school' }, { DATABASE_URL: 'postgres://remote.example/kudlab_local' },
    { DATABASE_URL: 'postgres://localhost/kudlab_local?host=remote.example' }, { GAME_RUNTIME_ORIGIN: 'https://play.example' },
    { SPA_ORIGIN: 'https://teacher.example' }, { BETTER_AUTH_URL: 'https://api.example' } ])
    expect(() => loadEnv({ ...local(), ...patch })).toThrow('Configuración inválida');
});
it('CA-01/02/06: the same validated policy activates new students, participation and calculation without relaxing tests', async () => {
  useLocal();
  const deps = startupGameDependencies();
  expect(deps).toEqual({ localSynthetic: true });
  expect(syntheticStudentActivation(deps)).toBe(true);
  expect(syntheticEnabled(deps)).toBe(true);
  expect(() => assertTestDatabase()).toThrow('ISOLATED_TEST_DATABASE');
  expect(() => syntheticEnabled({ ...deps, testActiveStudents: true })).toThrow('ISOLATED_TEST_DATABASE');
  const provider = participationProvider(deps);
  vi.stubEnv('KUDLAB_LOCAL_SYNTHETIC_ENABLED', 'false');
  expect(startupGameDependencies()).toEqual({});
  expect(syntheticStudentActivation({})).toBe(false);
  expect(syntheticEnabled({})).toBe(false);
  await expect(provider({} as never, 'synthetic-id', new Date())).rejects.toThrow('LOCAL_SYNTHETIC_MODE_REQUIRED');
});
it('CA-03: local participation denies missing and inactive students; references are explicitly synthetic', async () => {
  useLocal();
  const at = new Date(), provider = participationProvider(startupGameDependencies());
  for (const student of [undefined, { isActive: false }, { isActive: true }]) {
    const tx = { select: () => ({ from: () => ({ where: async () => student ? [student] : [] }) }) };
    const result = await provider(tx as never, 'synthetic-id', at);
    expect(result).toEqual(student?.isActive ? { status: 'ALLOWED', authorizationReference: 'SYNTHETIC-LOCAL:synthetic-id', validUntil: new Date(at.getTime() + 86400000) } : { status: 'DENIED' });
  }
});
