import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';
import { CODE_ALPHABET, newCode } from '../../src/modules/tareas/runtime/access-security.js';
describe('J03 dedicated configuration and code namespace', () => {
  it('requires explicit independent lookup/IP keys and valid versioned AEAD keys', () => {
    expect(loadEnv({ ...process.env, GAME_ACCESS_ENABLED: 'false' }).GAME_ACCESS_ENABLED).toBe(false);
    const settings = { ...process.env, GAME_ACCESS_ENABLED: 'true', GAME_RUNTIME_ORIGIN: 'http://127.0.0.1:4183', GAME_GRANT_KEYS: JSON.stringify({ g: 'ab'.repeat(32) }), GAME_ACTIVE_KEY_ID: 'g', GAME_CURSOR_KEY: 'cd'.repeat(32), GAME_ACCESS_LOOKUP_KEY: '12'.repeat(32), GAME_ACCESS_IP_KEY: '34'.repeat(32), GAME_ACCESS_KEYS: JSON.stringify({ c: 'ef'.repeat(32) }), GAME_ACCESS_ACTIVE_KEY_ID: 'c' };
    expect(loadEnv(settings).GAME_ACCESS_ENABLED).toBe(true);
    expect(() => loadEnv({ ...settings, GAME_ACCESS_IP_KEY: settings.GAME_ACCESS_LOOKUP_KEY })).toThrow();
    expect(() => loadEnv({ ...settings, GAME_ACCESS_KEYS: '{}' })).toThrow();
    expect(() => loadEnv({ ...settings, GAME_ACCESS_KEYS: JSON.stringify({ c: 'weak' }) })).toThrow();
    expect(() => loadEnv({ ...settings, GAME_ACCESS_ACTIVE_KEY_ID: 'missing' })).toThrow();
    expect(() => loadEnv({ ...settings, GAME_ACCESS_KEYS: JSON.stringify({ c: settings.GAME_ACCESS_LOOKUP_KEY }) })).toThrow();
    expect(() => loadEnv({ ...settings, GAME_ACCESS_LOOKUP_KEY: settings.GAME_CURSOR_KEY })).toThrow();
  });
  it('uses exactly five symbols from the approved 32-symbol alphabet, not a counter or student ID', () => {
    expect(CODE_ALPHABET).toHaveLength(32); const codes = Array.from({ length: 1000 }, newCode);
    expect(codes.every(c => c.length === 5 && [...c].every(s => CODE_ALPHABET.includes(s)))).toBe(true);
    // Sanity check, not a proof/certification of randomness or short-code security.
    expect(new Set(codes).size).toBeGreaterThan(990);
  });
});
