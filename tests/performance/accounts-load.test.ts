import { expect, it } from 'vitest';
import { login, request, reset } from '../helpers.js';

it('mide p95 de 30 sesiones independientes contra la referencia documental de 2 s', async () => {
  await reset();
  const sessions = await Promise.all(Array.from({ length: 30 }, () => login()));
  const measurements = await Promise.all(sessions.map(async (headers) => {
    const start = performance.now();
    const response = await request('/api/v1/accounts', 'GET', undefined, headers);
    expect(response.status).toBe(200);
    return performance.now() - start;
  }));
  measurements.sort((a, b) => a - b);
  const p95 = measurements[Math.ceil(0.95 * measurements.length) - 1]!;
  console.info(`30 sesiones; GET /api/v1/accounts p95=${p95.toFixed(1)}ms; referencia de diseño ≤2000ms (no aprobada)`);
});
