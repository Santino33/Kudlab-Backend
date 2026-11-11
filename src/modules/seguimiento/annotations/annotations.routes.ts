import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AuthVariables } from '../../../auth/session-guard.js';
import { academicActor, requireTeacher } from '../../academico/shared/academic-auth.js';
import { invalidInput } from '../../academico/shared/academic.errors.js';
import { AnnotationError, annotationsFail } from './annotations.errors.js';
import { createStudentAnnotation, deleteStudentAnnotation, listStudentAnnotations, updateStudentAnnotation } from './annotations.service.js';
import { rejectAnnotationQuery } from './annotations.validation.js';

// Own prefix and guard: never extends the students catch-all or runtime API.
export function createAnnotationsRoutes() {
  const routes = new Hono<AuthVariables>();
  routes.onError((error, c) => annotationsFail(c, error));
  routes.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
  routes.use('*', requireTeacher);
  routes.use('*', bodyLimit({ maxSize: 16 * 1024,
    onError: c => annotationsFail(c, new AnnotationError(413, 'INVALID_INPUT')) }));
  routes.get('/', async c => c.json(await listStudentAnnotations(academicActor(c), c.req.url)));
  routes.post('/', async c => {
    rejectAnnotationQuery(c.req.url);
    return c.json(await createStudentAnnotation(academicActor(c), await c.req.json()), 201);
  });
  routes.patch('/:annotationId', async c => {
    rejectAnnotationQuery(c.req.url);
    return c.json(await updateStudentAnnotation(academicActor(c), c.req.param('annotationId'), await c.req.json()));
  });
  routes.delete('/:annotationId', async c => {
    rejectAnnotationQuery(c.req.url);
    if ((await c.req.arrayBuffer()).byteLength) throw invalidInput();
    return c.json(await deleteStudentAnnotation(academicActor(c), c.req.param('annotationId')));
  });
  return routes;
}
