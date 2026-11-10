import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import type { AuthVariables } from '../../../auth/session-guard.js';
import { groups, students } from '../../../db/schema/academic.js';
import { academicActor, requireTeacher, withAcademicAccess, type AcademicActor, type AcademicTransaction } from '../../academico/shared/academic-auth.js';
import { AcademicError, academicFail, invalidInput, notFound } from '../../academico/shared/academic.errors.js';
import { academicScopeProvider } from '../../academico/shared/scope-provider.js';
import { authorizeScope } from '../../usuarios/shared/scope-authorization.js';
import { readIndicatorCatalog } from './catalog.service.js';
import { decodeCursor, encodeCursor, InvalidCursorError } from './cursor.js';
import { IndicatorDateRangeError, bogotaDayRange } from './dates.js';
import { indicatorDefinitionsResponseSchema, indicatorHistoryQuerySchema, indicatorHistoryResponseSchema } from './dto.js';
import { readStudentHistoryPage, type SessionResultsFilter } from './history.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Pertenencia actual: estudiante → curso → docente responsable, con el mismo control de ámbito que el CRUD de estudiantes.
// No consulta consentimiento ni `isActive` (D-5): la historia ya registrada se conserva.
async function requireOwnStudent(tx: AcademicTransaction, actor: AcademicActor, id: string) {
  if (!UUID.test(id)) throw notFound();
  const [visible] = await tx.select({ groupId: students.groupId }).from(students).innerJoin(groups, eq(groups.id, students.groupId))
    .where(and(eq(students.id, id), eq(groups.teacherId, actor.accountId)));
  if (!visible) throw notFound();
  await tx.select({ id: groups.id }).from(groups).where(and(eq(groups.id, visible.groupId), eq(groups.teacherId, actor.accountId))).for('share');
  const decision = await authorizeScope({ id: actor.accountId, role: 'TEACHER', status: 'ACTIVA' }, { operation: 'read', target: { kind: 'student', id } }, academicScopeProvider(tx));
  if (!decision.allowed) throw notFound();
}

function failure(error: unknown, c: Parameters<typeof academicFail>[0]) {
  if (error instanceof IndicatorDateRangeError || error instanceof InvalidCursorError || error instanceof ZodError) return academicFail(c, invalidInput());
  return academicFail(c, error instanceof AcademicError ? error : new Error('UNAVAILABLE'));
}

export function createIndicatorReadRoutes() {
  const routes = new Hono<AuthVariables>();
  routes.onError((error, c) => failure(error, c));
  // El catálogo vive fuera del prefijo de estudiantes: guardia propia (solo TEACHER; ADMIN recibe 403).
  routes.use('/api/v1/indicator-definitions', requireTeacher);
  routes.get('/api/v1/indicator-definitions', async c => {
    if (new URL(c.req.url).searchParams.size) throw invalidInput();
    c.header('Cache-Control', 'no-store');
    return c.json(indicatorDefinitionsResponseSchema.parse(await readIndicatorCatalog()));
  });
  // La historia queda cubierta por las guardias de prefijo `/api/v1/students` y `/api/v1/students/*` de app.ts (el orden de montaje lo comprueba una prueba).
  routes.get('/api/v1/students/:id/indicator-history', async c => {
    const params = new URL(c.req.url).searchParams, keys = [...params.keys()];
    if (new Set(keys).size !== keys.length) throw invalidInput();
    const query = indicatorHistoryQuerySchema.parse(Object.fromEntries(params));
    const id = c.req.param('id'), range = bogotaDayRange(query.from, query.to);
    const cursorFilter = { studentId: id, ...(query.taskId ? { taskId: query.taskId } : {}), ...(query.metricCode ? { metricCode: query.metricCode } : {}),
      ...(query.scope ? { scope: query.scope } : {}), ...(query.from ? { from: query.from } : {}), ...(query.to ? { to: query.to } : {}) };
    const after = query.cursor ? decodeCursor(query.cursor, cursorFilter) : undefined;
    const filter: SessionResultsFilter = { ...(query.taskId ? { taskId: query.taskId } : {}), ...range,
      ...(query.metricCode ? { metricCodes: [query.metricCode] } : {}), ...(query.scope ? { scopes: [query.scope] } : {}) };
    const actor = academicActor(c);
    const page = await withAcademicAccess(actor, async tx => {
      await requireOwnStudent(tx, actor, id);
      return readStudentHistoryPage(tx, { studentId: id, filter, viewerAccountId: actor.accountId, limit: query.limit ?? 25, ...(after ? { after } : {}) });
    });
    c.header('Cache-Control', 'no-store');
    return c.json(indicatorHistoryResponseSchema.parse({ studentId: id, items: page.items, nextCursor: page.next ? encodeCursor(cursorFilter, page.next) : null }));
  });
  return routes;
}
