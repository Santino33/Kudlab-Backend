import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { calculate } from '../../src/modules/evolucion/tg01.js';
import { canonical, hash, envelopeSchema, type Envelope, type Trial } from '../../src/modules/tareas/runtime/contract.js';
import { participationProvider } from '../../src/modules/academico/shared/participation.js';
import { loadEnv } from '../../src/config/env.js';

const trial = (result: Trial['result'], n: number, rt = 300): Trial => ({ trial: n, stimulus: ['false_alarm', 'correct_rejection'].includes(result) ? 'moon' : 'star', spawnedAtMs: n * 1000 - 50,
  presentedAtMs: n * 1000, respondedAtMs: ['hit', 'false_alarm'].includes(result) ? n * 1000 + rt : null, closedAtMs: n * 1000 + rt,
  result, segment: 1, closureReason: ['hit', 'false_alarm'].includes(result) ? 'response' : result === 'not_evaluated' ? 'interruption' : 'window_elapsed',
  responseWindowCompleted: ['miss', 'correct_rejection'].includes(result), responseDevice: ['hit', 'false_alarm'].includes(result) ? 'mouse' : null, geometry: { lane: 2, x: 240, size: 90 } });
function evidence(events: Trial[] = []): Envelope {
  return { contractVersion: '1.0', sessionId: '10000000-0000-4000-8000-000000000001', submissionId: '20000000-0000-4000-8000-000000000001',
    taskId: 'TG-01', publishedVersionId: '30000000-0000-4000-8000-000000000001', configVersion: 1, configurationHash: 'a'.repeat(64), gameBuildId: 'tg01-reference-rebuild-1',
    state: 'interrupted', terminationReason: 'user_exit', clock: { id: '40000000-0000-4000-8000-000000000001', timeOriginUnixMs: 1 }, timing: { startedAtMs: 0, finishedAtMs: 30000, lastCheckpointAtMs: 30000 },
    device: { viewportWidth: 1280, viewportHeight: 800, stageScale: 1, touchCapable: false }, events, incidents: [] };
}
it('75/25/50, median 500, population SD/CV; truncation never becomes an omission', () => {
  const e = evidence([trial('hit', 1, 300), trial('hit', 2, 500), trial('hit', 3, 700), trial('miss', 4), trial('false_alarm', 5), trial('correct_rejection', 6), trial('not_evaluated', 7)]);
  envelopeSchema.parse(e);
  const result = calculate(e, true), values = Object.fromEntries(result.indicators.filter(i => i.scope === 'SESSION').map(i => [i.metricCode, i.value!]));
  expect(values.accuracy_pct).toBe(75); expect(values.omission_rate_pct).toBe(25); expect(values.commission_rate_pct).toBe(50);
  expect(values.median_reaction_time_ms).toBe(500); expect(values.rt_sd_ms).toBeCloseTo(163.299316, 6); expect(values.rt_cv_pct).toBeCloseTo(32.659863, 6);
  expect(result.summary).toEqual({ observed: 7, included: 6, excluded: 1 });
});
it('zero denominators, one RT, zero mean and method approval have explicit nonnumeric reasons', () => {
  expect(calculate(evidence(), true).indicators.every(i => i.value === null)).toBe(true);
  const one = calculate(evidence([trial('hit', 1)]), true);
  expect(one.indicators.find(i => i.scope === 'SESSION' && i.metricCode === 'rt_sd_ms')?.unavailabilityReason).toBe('INSUFFICIENT_RT_FOR_VARIABILITY');
  const zero = calculate(evidence([trial('hit', 1, 0), trial('hit', 2, 0)]), true);
  expect(zero.indicators.find(i => i.scope === 'SESSION' && i.metricCode === 'rt_cv_pct')?.unavailabilityReason).toBe('ZERO_MEAN_RT');
  expect(calculate(evidence(), false).indicators.every(i => i.unavailabilityReason === 'METHOD_NOT_APPROVED')).toBe(true);
  expect(one.indicators.filter(i => i.scope === 'SEGMENT_2').every(i => i.unavailabilityReason === 'SEGMENT_NOT_REACHED')).toBe(true);
});
it('technical overlap excludes only affected trials; network/context never corrupt response time', () => {
  const e = evidence([trial('hit', 1), trial('hit', 2)]);
  e.incidents = [{ sequence: 1, type: 'focus_lost', clockId: e.clock.id, atMs: 1100, endedAtMs: 1200, recordedAtClient: null, category: 'CONTEXT_ONLY' }];
  const result = calculate(e, true); expect(result.decisions.map(i => i.included)).toEqual([false, true]);
  e.incidents[0]!.endedAtMs = null;
  expect(calculate(e, true).indicators.find(i => i.scope === 'SESSION' && i.metricCode === 'accuracy_pct')?.unavailabilityReason).toBe('TECHNICAL_EXCLUSION');
  e.incidents[0]!.type = 'network_lost'; expect(calculate(e, true).decisions.every(i => i.included)).toBe(true);
});
it('shared artefact hashes and RFC 8785 vectors are deterministic', () => {
  const dir = new URL('../../contract/runtime-1.1.0/', import.meta.url), manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8'));
  for (const [name, digest] of Object.entries(manifest.files)) expect(createHash('sha256').update(readFileSync(new URL(name, dir))).digest('hex')).toBe(digest);
  for (const vector of JSON.parse(readFileSync(new URL('canonical-vectors.json', dir), 'utf8'))) expect(hash(vector.value)).toBe(vector.sha256);
  expect(canonical({ z: 1, a: -0 })).toBe('{"a":0,"z":1}'); expect(() => canonical(NaN)).toThrow();
});
it('synthetic academic provider cannot be injected outside the named isolated test database', () => {
  const before = process.env.DATABASE_URL;
  try { process.env.DATABASE_URL = 'postgres://localhost/school'; expect(() => participationProvider({ testParticipation: async () => ({ status: 'UNAVAILABLE' }) })).toThrow('SYNTHETIC_PARTICIPATION'); }
  finally { process.env.DATABASE_URL = before; }
});
it('optional game settings preserve existing deployments; configured games require independent origins and keys', () => {
  const empty = { ...process.env, GAME_RUNTIME_ORIGIN: '', GAME_GRANT_KEYS: '', GAME_ACTIVE_KEY_ID: '', GAME_CURSOR_KEY: '' };
  expect(loadEnv(empty).GAME_RUNTIME_ORIGIN).toBeUndefined();
  expect(() => loadEnv({ ...empty, GAME_RUNTIME_ORIGIN: 'not-an-origin' })).toThrow('Configuración inválida');
  expect(() => loadEnv({ ...empty, GAME_RUNTIME_ORIGIN: process.env.SPA_ORIGIN })).toThrow('Configuración inválida');
});
