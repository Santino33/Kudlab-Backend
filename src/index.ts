import { serve } from '@hono/node-server';
import { app } from './app.js';
import { bootstrapAdmin } from './scripts/bootstrap-admin.js';

await bootstrapAdmin();
serve({ fetch: app.fetch, port: Number(process.env.PORT || 3000) });
