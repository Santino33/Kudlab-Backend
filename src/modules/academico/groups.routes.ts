import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthVariables } from '../../auth/session-guard.js';
import { AccountError } from '../usuarios/accounts.errors.js';
import { academicAssignments } from './assignment-provider.js';
import { listGroupOptions } from './students.service.js';

export const groupsRoutes = new Hono<AuthVariables>();

groupsRoutes.get('/', async (c) => {
  const owned = await academicAssignments.ownedGroupIds(c.get('currentAccount').id);
  if (!Array.isArray(owned) || !owned.every((id) => z.uuid().safeParse(id).success))
    throw new AccountError(403, 'FORBIDDEN', 'Acceso denegado');
  return c.json(await listGroupOptions(c.get('currentAccount').id, owned));
});
