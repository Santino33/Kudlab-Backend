import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { ZodError } from 'zod';
import type { AuthVariables } from '../../../auth/session-guard.js';
import { requireActive, requireAdmin } from '../../../auth/session-guard.js';
import { getTask, listTasks, setTaskAvailability } from './catalog.service.js';
import { academicActor } from '../../academico/shared/academic-auth.js';
import { AcademicError } from '../../academico/shared/academic.errors.js';
import { GameError } from '../runtime/errors.js';
import { loadEnv } from '../../../config/env.js';
import type { GameDependencies } from '../../academico/shared/participation.js';

export function createCatalogRoutes(deps: GameDependencies = {}) {
const catalogRoutes = new Hono<AuthVariables>();
catalogRoutes.onError((error, c) => {
  if (error instanceof GameError || error instanceof AcademicError)
    return c.json({ code: error.code, message: 'Operación no disponible' }, error.status);
  if (error instanceof ZodError || error instanceof SyntaxError)
    return c.json({ code: 'INVALID_INPUT', message: 'Solicitud inválida' }, 400);
  return c.json({ code: 'UNAVAILABLE', message: 'Operación no confirmada' }, 503);
});
catalogRoutes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  return requireActive(c, next);
});
catalogRoutes.use('*', async (c, next) => {
  if (!['TEACHER', 'ADMIN'].includes(c.get('currentAccount').role))
    return c.json({ code: 'FORBIDDEN', message: 'Acceso denegado' }, 403);
  if (new URL(c.req.url).searchParams.size)
    return c.json({ code: 'INVALID_INPUT', message: 'Solicitud inválida' }, 400);
  await next();
});
catalogRoutes.get('/', async (c) => c.json(await listTasks(deps)));
catalogRoutes.patch('/:taskId/availability', requireAdmin,
  bodyLimit({ maxSize: 1024, onError: c => c.json({ code: 'INVALID_INPUT', message: 'Solicitud inválida' }, 400) }),
  async c => {
    if (c.req.header('Origin') !== loadEnv().SPA_ORIGIN)
      return c.json({ code: 'FORBIDDEN', message: 'Acceso denegado' }, 403);
    const id = c.req.param('taskId');
    if (!/^TG-[0-9]{2}$/.test(id) || c.req.header('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
      return c.json({ code: 'INVALID_INPUT', message: 'Solicitud inválida' }, 400);
    return c.json(await setTaskAvailability(academicActor(c), id, await c.req.json(), deps));
  });
catalogRoutes.get('/:taskId', async (c) => {
  const id = c.req.param('taskId');
  if (!/^TG-[0-9]{2}$/.test(id)) return c.json({ code: 'INVALID_INPUT', message: 'Solicitud inválida' }, 400);
  const task = await getTask(id, deps);
  return task ? c.json(task) : c.json({ code: 'NOT_FOUND', message: 'Tarea no encontrada' }, 404);
});
return catalogRoutes;
}
export const catalogRoutes = createCatalogRoutes();
