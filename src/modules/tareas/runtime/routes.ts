import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { z, ZodError } from 'zod';
import { academicActor } from '../../academico/shared/academic-auth.js';
import { AcademicError } from '../../academico/shared/academic.errors.js';
import type { GameDependencies } from '../../academico/shared/participation.js';
import { prepareActive, type AuthVariables } from '../../../auth/session-guard.js';
import { loadEnv } from '../../../config/env.js';
import { GameError } from './errors.js';
import { createGameService } from './service.js';
import { secret, uuid } from './contract.js';
import { runtimeSettings } from './security.js';
import { getConnInfo } from '@hono/node-server/conninfo';
import { accessLimit } from './access-limit.js';
import { accessSettings } from './access-security.js';
import { assertTestDatabase } from '../../academico/shared/participation.js';

const pageSchema = { limit: z.coerce.number().int().min(1).max(100).default(25), cursor: z.string().min(1).max(2048).optional() };
const query = <T extends z.ZodType>(c: Context, schema: T) => {
  const params = new URL(c.req.url).searchParams;
  if ([...params.keys()].some(k => params.getAll(k).length > 1)) throw new GameError(400, 'INVALID_INPUT');
  return schema.parse(Object.fromEntries(params));
};
const empty = (c: Context) => query(c, z.strictObject({}));
async function body(c: Context, max = 1048576): Promise<unknown> {
  const stream = c.req.raw.body?.getReader();
  if (!stream || c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new GameError(400, 'INVALID_INPUT');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const next = await stream.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > max) { await stream.cancel(); throw new GameError(413, 'PAYLOAD_TOO_LARGE'); }
      chunks.push(next.value);
    }
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); }
    catch { throw new GameError(400, 'INVALID_INPUT'); }
    return JSON.parse(text);
  } finally { stream.releaseLock(); }
}
function bearer(c: Context) {
  const value = /^Bearer ([A-Za-z0-9_-]+)$/.exec(c.req.header('Authorization') ?? '')?.[1];
  if (!secret.safeParse(value).success) throw new GameError(401, 'RUNTIME_UNAUTHENTICATED');
  return value!;
}
export function createGameRoutes(deps: GameDependencies = {}) {
  const routes = new Hono<AuthVariables>(), service = createGameService(deps);
  routes.onError((error, c) => {
    if (error instanceof GameError && error.retryAfter) c.header('Retry-After', String(error.retryAfter));
    if (error instanceof GameError || error instanceof AcademicError)
      return c.json({ code: error.code, message: 'Operación no disponible', ...('reason' in error && error.reason ? { reason: error.reason } : {}) }, error.status);
    if (error instanceof ZodError || error instanceof SyntaxError) return c.json({ code: 'INVALID_INPUT', message: 'Solicitud inválida' }, 400);
    const cause = error instanceof Error && 'cause' in error ? error.cause : error;
    if (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505' &&
      'constraint' in cause && cause.constraint === 'task_result_receipts_submission_id_unique')
      return c.json({ code: 'RESULT_CONFLICT', message: 'Contenido de entrega en conflicto' }, 409);
    if (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505')
      return c.json({ code: 'CONFLICT', message: 'Operación en conflicto', reason: 'REQUEST_CONFLICT' }, 409);
    return c.json({ code: 'UNAVAILABLE', message: 'Operación no confirmada' }, 503);
  });
  const runtime = new Hono<AuthVariables>();
  runtime.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    const origin = c.req.header('Origin');
    if (origin && origin !== runtimeSettings().origin) throw new GameError(403, 'PARTICIPATION_BLOCKED');
    await next();
  });
  // Bounded per-instance admission control; session/database locks remain authoritative across instances.
  const buckets = new Map<string, { until: number; count: number }>();
  runtime.use('*', async (c, next) => {
    if (c.req.path.startsWith('/api/v1/game-runtime/access/')) {
      accessSettings();
      let ip: string | undefined;
      try { ip = getConnInfo(c).remote.address; } catch { /* In-process test requests have no socket. */ }
      if (!ip && deps.testParticipation) { assertTestDatabase(); ip = 'synthetic-in-process'; }
      if (!ip) throw new GameError(503, 'UNAVAILABLE');
      const wait = await accessLimit(ip, 'ip'); if (wait) throw new GameError(429, 'RATE_LIMITED', undefined, wait);
      await next(); return;
    }
    const token = c.req.header('Authorization') ?? '';
    const key = (await import('node:crypto')).createHash('sha256').update(token).digest('hex');
    const now = Date.now(), old = buckets.get(key), bucket = old && old.until > now ? old : { until: now + 60000, count: 0 };
    if (++bucket.count > 120) { c.header('Retry-After', String(Math.max(1, Math.ceil((bucket.until - now) / 1000)))); throw new GameError(429, 'RATE_LIMITED'); }
    if (buckets.size > 10000) for (const [id, b] of buckets) if (b.until <= now) buckets.delete(id);
    if (buckets.size >= 10000 && !buckets.has(key)) throw new GameError(503, 'UNAVAILABLE');
    buckets.set(key, bucket); await next();
  });
  runtime.post('/access/claim', async c => { empty(c); return c.json(await service.accessClaim(await body(c, 4096))); });
  runtime.post('/access/recover', async c => { empty(c); return c.json(await service.accessClaim(await body(c, 4096), true)); });
  runtime.post('/launches/claim', async c => { empty(c); return c.json(await service.claim(bearer(c), await body(c, 4096))); });
  runtime.get('/sessions/:id', async c => { empty(c); return c.json(await service.context(c.req.param('id'), bearer(c))); });
  runtime.post('/sessions/:id/start', async c => { empty(c); return c.json(await service.start(c.req.param('id'), bearer(c), await body(c, 4096))); });
  runtime.post('/sessions/:id/results', async c => {
    empty(c); const token = bearer(c), result = await service.submit(c.req.param('id'), token, await body(c));
    return c.json(result.receipt, result.repeated ? 200 : 201);
  });
  runtime.get('/sessions/:id/receipt', async c => {
    const input = query(c, z.strictObject({ submissionId: uuid }));
    return c.json(await service.receipt(c.req.param('id'), bearer(c), input.submissionId));
  });
  routes.route('/api/v1/game-runtime', runtime);
  const teacher = new Hono<AuthVariables>();
  const protect: MiddlewareHandler<AuthVariables> = async (c, next) => {
    c.header('Cache-Control', 'no-store');
    if (c.req.method !== 'GET' && c.req.header('Origin') !== loadEnv().SPA_ORIGIN) throw new GameError(403, 'FORBIDDEN');
    const prepared = await prepareActive(c);
    if (typeof prepared !== 'string') return prepared;
    if (c.get('currentAccount').role !== 'TEACHER') throw new GameError(403, 'FORBIDDEN');
    await next();
  };
  for (const path of ['/task-assignments', '/task-assignments/*', '/task-assignment-recipients/*', '/task-access-codes/*', '/task-sessions/*', '/students/:id/task-sessions']) teacher.use(path, protect);
  teacher.post('/task-assignments/:id/access-codes', async c => { empty(c); const r = await service.generateCodes(academicActor(c), c.req.param('id'), await body(c, 16384)); return c.json(r.detail, r.repeated ? 200 : 201); });
  teacher.get('/task-assignments/:id/access-codes', async c => { const q = query(c, z.strictObject(pageSchema)); return c.json(await service.listCodes(academicActor(c), c.req.param('id'), q)); });
  teacher.post('/task-access-codes/:id/reveal', async c => { empty(c); return c.json(await service.revealCode(academicActor(c), c.req.param('id'), await body(c, 4096))); });
  teacher.post('/task-access-codes/:id/replace', async c => { empty(c); const r = await service.mutateCode(academicActor(c), c.req.param('id'), await body(c, 4096), true); return c.json(r.detail, r.repeated ? 200 : 201); });
  teacher.post('/task-access-codes/:id/revoke', async c => { empty(c); return c.json((await service.mutateCode(academicActor(c), c.req.param('id'), await body(c, 4096), false)).detail); });
  teacher.post('/task-sessions/:id/access-recovery-codes', async c => { empty(c); const r = await service.recoveryCode(academicActor(c), c.req.param('id'), await body(c, 4096)); return c.json(r.detail, r.repeated ? 200 : 201); });
  teacher.post('/task-assignments', async c => { empty(c); const r = await service.createAssignment(academicActor(c), await body(c, 131072)); return c.json(r.detail, r.repeated ? 200 : 201); });
  teacher.get('/task-assignments', async c => { const q = query(c, z.strictObject({ ...pageSchema, groupId: uuid })); return c.json(await service.listAssignments(academicActor(c), q.groupId, q)); });
  teacher.get('/task-assignments/:id', async c => { empty(c); return c.json(await service.assignment(academicActor(c), c.req.param('id'))); });
  teacher.post('/task-assignments/:id/cancel', async c => { empty(c); return c.json(await service.cancel(academicActor(c), c.req.param('id'), await body(c, 4096))); });
  teacher.post('/task-assignment-recipients/:id/launch-grants', async c => { empty(c); const r = await service.grant(academicActor(c), c.req.param('id'), await body(c, 4096)); return c.json(r.detail, r.repeated ? 200 : 201); });
  teacher.get('/students/:id/task-sessions', async c => { const q = query(c, z.strictObject({ ...pageSchema, taskId: z.literal('TG-01').optional() })); return c.json(await service.listSessions(academicActor(c), c.req.param('id'), q.taskId, q)); });
  teacher.get('/task-sessions/:id', async c => { empty(c); return c.json(await service.session(academicActor(c), c.req.param('id'))); });
  teacher.get('/task-sessions/:id/evidence', async c => { const q = query(c, z.strictObject({ ...pageSchema, kind: z.enum(['trials', 'incidents']) })); return c.json(await service.evidence(academicActor(c), c.req.param('id'), q.kind, q)); });
  teacher.post('/task-sessions/:id/recovery-grants', async c => { empty(c); const r = await service.grant(academicActor(c), c.req.param('id'), await body(c, 4096), true); return c.json(r.detail, r.repeated ? 200 : 201); });
  teacher.post('/task-sessions/:id/processing-retries', async c => { empty(c); return c.json(await service.retry(academicActor(c), c.req.param('id'), await body(c, 4096)), 202); });
  // Mount only these resources; do not intercept existing students/catalog routes.
  routes.route('/api/v1', teacher);
  return routes;
}
