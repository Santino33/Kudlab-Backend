import { serve } from '@hono/node-server';
import { loadEnv } from './config/env.js';

// Validate before importing modules that initialize database/auth or performing writes.
loadEnv();
const { app } = await import('./app.js');
const { bootstrapAdmin } = await import('./scripts/bootstrap-admin.js');

await bootstrapAdmin();
const { startProcessor } = await import('./modules/evolucion/processor.js');
startProcessor();
if (loadEnv().GAME_ACCESS_ENABLED) {
  const { startAccessCleanup } = await import('./modules/tareas/runtime/access-limit.js'); startAccessCleanup();
}
serve({ fetch: app.fetch, port: Number(process.env.PORT || 3000) });
