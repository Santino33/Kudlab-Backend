import { Hono } from 'hono';
import type { AuthVariables } from '../../../auth/session-guard.js';
import { academicActor } from '../shared/academic-auth.js';
import { notesFail } from './notes.errors.js';
import { createNote, listNotes, updateNote } from './notes.service.js';
import { rejectQuery } from './notes.validation.js';

// Se monta con `app.route('/', createNotesRoutes())` después de las guardias de `/api/v1/students`
// y antes del CRUD de estudiantes. Usa rutas completas y valida la consulta solo en sus propias rutas:
// un `use('*')` aquí afectaría a toda la API, porque el router se monta en la raíz.
export function createNotesRoutes() {
  const routes = new Hono<AuthVariables>();
  routes.onError((error, c) => notesFail(c, error));
  const guardQuery = async (c: { req: { url: string } }, next: () => Promise<void>) => { rejectQuery(c.req.url); await next(); };
  routes.use('/api/v1/students/:id/academic-notes', guardQuery);
  routes.use('/api/v1/students/:id/academic-notes/:noteId', guardQuery);
  routes.get('/api/v1/students/:id/academic-notes', async (c) =>
    c.json(await listNotes(academicActor(c), c.req.param('id'))));
  routes.post('/api/v1/students/:id/academic-notes', async (c) =>
    c.json(await createNote(academicActor(c), c.req.param('id'), () => c.req.json()), 201));
  routes.patch('/api/v1/students/:id/academic-notes/:noteId', async (c) =>
    c.json(await updateNote(academicActor(c), c.req.param('id'), c.req.param('noteId'), () => c.req.json())));
  return routes;
}
