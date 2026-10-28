// Test-runner composition only. Never imported by src/index.ts or exposed as an API switch.
import './setup.js';
import { serve } from '@hono/node-server';
import { assertTestDatabase } from '../src/modules/academico/shared/participation.js';
assertTestDatabase();
const { reset } = await import('./helpers.js');
const { gameFixture, testGameApp, gameDependencies } = await import('./game-fixture.js');
const { startProcessor } = await import('../src/modules/evolucion/processor.js');
await reset();
await gameFixture();
const stop = startProcessor(gameDependencies);
const { startAccessCleanup } = await import('../src/modules/tareas/runtime/access-limit.js');
const stopCleanup = startAccessCleanup();
const server = serve({ fetch: testGameApp().fetch, port: Number(process.env.PORT ?? 4300), hostname: '127.0.0.1' });
process.on('SIGTERM', () => { stop(); stopCleanup(); server.close(); void import('../src/db/client.js').then(({ pool }) => pool.end()); });
console.log('J02_SYNTHETIC_TEST_RUNNER_READY');
