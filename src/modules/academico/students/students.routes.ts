import { Hono } from 'hono';
import type { AuthVariables } from '../../../auth/session-guard.js';
import { academicActor } from '../shared/academic-auth.js';
import { academicFail, invalidInput } from '../shared/academic.errors.js';
import { createStudent, listStudents, getStudent, updateStudent, deactivateStudent } from './students.service.js';

export const studentsRoutes = new Hono<AuthVariables>();
studentsRoutes.onError((error, c) => academicFail(c, error));
studentsRoutes.use('*', async (c, next) => {
  if (new URL(c.req.url).searchParams.size) throw invalidInput();
  await next();
});
studentsRoutes.post('/', async (c) => c.json(await createStudent(academicActor(c), await c.req.json()), 201));
studentsRoutes.get('/', async (c) => c.json(await listStudents(academicActor(c))));
studentsRoutes.get('/:id', async (c) => c.json(await getStudent(academicActor(c), c.req.param('id'))));
studentsRoutes.patch('/:id', async (c) => c.json(await updateStudent(academicActor(c), c.req.param('id'), () => c.req.json())));
studentsRoutes.post('/:id/deactivate', async (c) => c.json(await deactivateStudent(academicActor(c), c.req.param('id'), () => c.req.text())));
