import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthVariables } from '../../auth/session-guard.js';
import { authorizeProtectedScope } from '../../auth/session-guard.js';
import { academicAssignments } from './assignment-provider.js';
import { listStudents, readStudent, renameStudent } from './students.service.js';
import { AccountError } from '../usuarios/accounts.errors.js';

export const studentsRoutes = new Hono<AuthVariables>();
const studentId = z.uuid();
const name = z.string().trim().min(1).max(100);
const rename = z.strictObject({ firstName: name.optional(), lastName: name.optional() })
  .refine((value) => value.firstName !== undefined || value.lastName !== undefined);
const forbidden = () => new AccountError(403, 'FORBIDDEN', 'Acceso denegado');
const listQuery = z.strictObject({
  groupId: z.uuid().optional(), ids: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

studentsRoutes.get('/', async (c) => {
  const query = listQuery.parse(c.req.query());
  const ids = query.ids === undefined ? undefined : z.array(z.uuid()).min(1).max(100).parse(query.ids.split(','));
  const owned = await academicAssignments.ownedGroupIds(c.get('currentAccount').id);
  if (!Array.isArray(owned) || !owned.every((id) => z.uuid().safeParse(id).success)) throw forbidden();
  return c.json(await listStudents(c.get('currentAccount').id, owned, { ...query, ids }));
});

studentsRoutes.get('/:id', async (c) => {
  const id = studentId.parse(c.req.param('id'));
  const decision = await authorizeProtectedScope(c, { operation: 'read', target: { kind: 'student', id } }, academicAssignments);
  if (!decision.allowed) throw forbidden();
  return c.json(await readStudent(c.get('currentAccount').id, decision.scope.id));
});

studentsRoutes.patch('/:id', async (c) => {
  const id = studentId.parse(c.req.param('id'));
  const decision = await authorizeProtectedScope(c, { operation: 'write', target: { kind: 'student', id } }, academicAssignments);
  if (!decision.allowed) throw forbidden();
  const body = rename.parse(await c.req.json());
  return c.json(await renameStudent(c.get('currentAccount').id, decision.scope.id, body));
});
