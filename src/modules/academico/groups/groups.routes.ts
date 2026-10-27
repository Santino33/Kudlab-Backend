import { Hono, type Context } from 'hono';
import { prepareActive, type AuthVariables } from '../../../auth/session-guard.js';
import { academicActor } from '../shared/academic-auth.js';
import { academicFail, forbidden, invalidInput } from '../shared/academic.errors.js';
import { listStudents } from '../students/students.service.js';
import { createGroup, deleteGroup, getGroup, listGroups, listTeachers, updateGroup } from './groups.service.js';

export const groupsRoutes = new Hono<AuthVariables>();
function role(c: Context<AuthVariables>) {
  const value = c.get('currentAccount').role;
  if (value !== 'ADMIN' && value !== 'TEACHER') throw forbidden();
  return value;
}
groupsRoutes.onError((error, c) => academicFail(c, error));
groupsRoutes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  const prepared = await prepareActive(c);
  if (typeof prepared !== 'string') return prepared;
  if (new URL(c.req.url).searchParams.size) throw invalidInput();
  await next();
});
groupsRoutes.use('*', async (c, next) => {
  if (c.req.method !== 'GET' && c.get('currentAccount').role !== 'ADMIN') throw forbidden();
  await next();
});
groupsRoutes.get('/', async c => c.json(await listGroups(academicActor(c), role(c))));
groupsRoutes.get('/teachers', async c => {
  if (c.get('currentAccount').role !== 'ADMIN') throw forbidden();
  return c.json(await listTeachers(academicActor(c)));
});
groupsRoutes.get('/:id/students', async c => {
  if (role(c) !== 'TEACHER') throw forbidden();
  return c.json(await listStudents(academicActor(c), c.req.param('id')));
});
groupsRoutes.get('/:id', async c => c.json(await getGroup(academicActor(c), role(c), c.req.param('id'))));
groupsRoutes.post('/', async c => c.json(await createGroup(academicActor(c), await c.req.json()), 201));
groupsRoutes.patch('/:id', async c => c.json(await updateGroup(academicActor(c), c.req.param('id'), () => c.req.json())));
groupsRoutes.delete('/:id', async c => c.json(await deleteGroup(academicActor(c), c.req.param('id'), () => c.req.text())));
