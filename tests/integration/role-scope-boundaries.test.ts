import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { sessionActivity } from '../../src/db/schema/authentication.js';
import { user } from '../../src/db/schema/auth.js';
import { inviteTeacher, login, request, reset } from '../helpers.js';

describe('rol vigente y sesión en operaciones protegidas', () => {
  beforeEach(reset);

  it('un ascenso y una degradación surten efecto desde la primera solicitud de la sesión ya abierta', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    const promoted = await (await request('/api/v1/admin-role-requests', 'POST', undefined, teacher)).json();
    expect((await request(`/api/v1/admin-role-requests/${promoted.id}/approve`, 'POST', undefined, admin)).status).toBe(200);
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(200);
    expect((await request(`/api/v1/accounts/${account.id}/role`, 'PUT', { role: 'TEACHER' }, admin)).status).toBe(200);
    const denied = await request(`/api/v1/accounts/${account.id}`, 'PATCH', { name: 'Sin permiso' }, teacher);
    expect(denied.status).toBe(403);
    expect((await denied.json()).fields).toBeUndefined();
    expect((await (await request(`/api/v1/accounts/${account.id}`, 'GET', undefined, admin)).json()).name)
      .toBe('Docente Test');
  });

  it('una denegación por rol no registra actividad y una identidad discrepante o inactiva tampoco accede', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    const { session } = await (await request('/api/auth/get-session', 'GET', undefined, teacher)).json();
    expect(await db.select().from(sessionActivity).where(eq(sessionActivity.sessionId, session.id))).toHaveLength(0);
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    expect(await db.select().from(sessionActivity).where(eq(sessionActivity.sessionId, session.id))).toHaveLength(0);

    await db.update(user).set({ role: 'admin' }).where(eq(user.email, 'teacher@pilot.edu.co'));
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    await db.update(user).set({ role: 'teacher' }).where(eq(user.email, 'teacher@pilot.edu.co'));
    await db.update(userAccounts).set({ status: 'INACTIVA' }).where(eq(userAccounts.id, account.id));
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    expect((await request('/api/v1/accounts', 'GET', undefined, admin)).status).toBe(200);
  });

  it('JWT, cierre o fallo de identidad no proporcionan cuentas ni efectos', async () => {
    const admin = await login();
    const jwt = await (await request('/api/auth/token', 'GET', undefined, admin)).json();
    const asJwt = await request('/api/v1/accounts', 'GET', undefined, { authorization: `Bearer ${jwt.token}` });
    expect(asJwt.status).toBe(401);
    expect(await asJwt.json()).toEqual({ code: 'UNAUTHENTICATED', message: 'Sesión requerida' });

    const spy = vi.spyOn(db, 'select').mockImplementationOnce(() => { throw new Error('DB_UNAVAILABLE'); });
    try {
      const unavailable = await request('/api/v1/accounts', 'GET', undefined, admin);
      expect(unavailable.status).toBe(503);
      expect(await unavailable.json()).toEqual({ code: 'UNAVAILABLE', message: 'Operación no confirmada' });
    } finally { spy.mockRestore(); }
    expect((await request('/api/auth/sign-out', 'POST', undefined, admin)).status).toBe(200);
    expect((await request('/api/v1/accounts', 'GET', undefined, admin)).status).toBe(401);
  });
});
