import { Hono } from 'hono';
import type { AuthVariables } from '../../../auth/session-guard.js';
import { requireActive } from '../../../auth/session-guard.js';
import { getTask, listTasks } from './catalog.service.js';
import type { GameDependencies } from '../../academico/shared/participation.js';

export function createCatalogRoutes(deps: GameDependencies = {}) {
const catalogRoutes = new Hono<AuthVariables>();
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
catalogRoutes.get('/:taskId', async (c) => {
  const id = c.req.param('taskId');
  if (!/^TG-[0-9]{2}$/.test(id)) return c.json({ code: 'INVALID_INPUT', message: 'Solicitud inválida' }, 400);
  const task = await getTask(id, deps);
  return task ? c.json(task) : c.json({ code: 'NOT_FOUND', message: 'Tarea no encontrada' }, 404);
});
return catalogRoutes;
}
export const catalogRoutes = createCatalogRoutes();
