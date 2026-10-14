import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/client.js';
import { userAccounts } from '../../src/db/schema/accounts.js';
import { session as authSession, user } from '../../src/db/schema/auth.js';
import { sessionActivity } from '../../src/db/schema/authentication.js';
import { inviteTeacher, login, loginPair, request, reset } from '../helpers.js';

describe('ingreso y fronteras protegidas', () => {
  beforeEach(reset);

  it('activa invitación, ingresa como docente y limita administración al rol vigente', async () => {
    const { teacher, admin } = await inviteTeacher();
    expect((await request('/api/auth/get-session', 'GET', undefined, teacher)).status).toBe(200);
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    expect((await request('/api/v1/accounts', 'GET', undefined, admin)).status).toBe(200);
  });

  it('no crea acceso para rol discordante, cuenta desactivada o correo que dejó de ser vigente', async () => {
    const { account, teacher } = await inviteTeacher();
    await db.update(user).set({ role: 'admin' }).where(eq(user.email, 'teacher@pilot.edu.co'));
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
    expect((await request('/api/auth/get-session', 'GET', undefined, teacher)).status).toBe(401);
    const mismatch = await request('/api/auth/sign-in/email', 'POST', { email: 'teacher@pilot.edu.co', password: 'TeacherPass1' });
    expect(mismatch.status).toBe(401);
    await db.update(user).set({ role: 'teacher' }).where(eq(user.email, 'teacher@pilot.edu.co'));
    await db.update(userAccounts).set({ emailNormalized: 'other@pilot.edu.co' }).where(eq(userAccounts.id, account.id));
    expect((await request('/api/auth/sign-in/email', 'POST', { email: 'teacher@pilot.edu.co', password: 'TeacherPass1' })).status).toBe(401);
    await db.update(userAccounts).set({ status: 'INACTIVA' }).where(eq(userAccounts.id, account.id));
    expect((await request('/api/v1/accounts', 'GET', undefined, teacher)).status).toBe(403);
  });

  it('no acepta JWT de interoperabilidad como sesión para operaciones de negocio', async () => {
    const bearer = await login();
    const token = await (await request('/api/auth/token', 'GET', undefined, bearer)).json();
    const response = await request('/api/v1/accounts', 'GET', undefined, { authorization: `Bearer ${token.token}` });
    expect(response.status).toBe(401);
    expect(JSON.stringify(await response.json())).not.toContain('admin@pilot.edu.co');
  });

  it('deniega una operación protegida si no puede verificar la identidad', async () => {
    const bearer = await login();
    const spy = vi.spyOn(db, 'select').mockImplementationOnce(() => { throw new Error('DB_UNAVAILABLE'); });
    try {
      const response = await request('/api/v1/accounts', 'GET', undefined, bearer);
      expect(response.status).toBe(503);
      expect(JSON.stringify(await response.json())).not.toContain('admin@pilot.edu.co');
    } finally { spy.mockRestore(); }
  });

  it('mantiene actividad por sesión y no renueva un acceso por denegaciones', async () => {
    const { first, second } = await loginPair();
    const { session: firstSession } = await (await request('/api/auth/get-session', 'GET', undefined, first)).json();
    const earlier = new Date(Date.now() - 1_800_100);
    await db.update(authSession).set({ createdAt: earlier, expiresAt: new Date(Date.now() + 1_800_000) })
      .where(eq(authSession.id, firstSession.id));
    expect((await request('/api/v1/accounts', 'GET', undefined, first)).status).toBe(401);
    expect((await request('/api/auth/token', 'GET', undefined, first)).status).toBe(401);
    expect((await request('/api/v1/accounts', 'GET', undefined, second)).status).toBe(200);
    expect((await request('/api/auth/get-session', 'GET', undefined, first)).status).toBe(401);
    expect((await request('/api/v1/accounts', 'GET', undefined, first)).status).toBe(401);
  });

  it('cerrar una sesión conserva la otra, pero inactivar y reactivar nunca recupera las antiguas', async () => {
    const { account, admin } = await inviteTeacher();
    const { first, second } = await loginPair('teacher@pilot.edu.co', 'TeacherPass1');
    expect((await request('/api/auth/sign-out', 'POST', undefined, first)).status).toBe(200);
    expect((await request('/api/v1/admin-role-requests', 'GET', undefined, first)).status).toBe(401);
    expect((await request('/api/v1/admin-role-requests', 'GET', undefined, second)).status).toBe(200);
    const { session: secondSession } = await (await request('/api/auth/get-session', 'GET', undefined, second)).json();
    expect(await db.select().from(sessionActivity).where(eq(sessionActivity.sessionId, secondSession.id))).toHaveLength(1);
    expect((await request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }, admin)).status).toBe(200);
    expect(await db.select().from(sessionActivity).where(eq(sessionActivity.sessionId, secondSession.id))).toHaveLength(0);
    expect((await request('/api/v1/admin-role-requests', 'GET', undefined, second)).status).toBe(401);
    expect((await request(`/api/v1/accounts/${account.id}/reactivate`, 'POST', { confirm: true }, admin)).status).toBe(200);
    expect((await request('/api/v1/admin-role-requests', 'GET', undefined, second)).status).toBe(401);
    expect((await request('/api/v1/admin-role-requests', 'GET', undefined,
      await login('teacher@pilot.edu.co', 'TeacherPass1'))).status).toBe(200);
  });

  it('cierre concurrente con petición nunca permite reutilizar la sesión después del cierre', async () => {
    const credential = await login();
    const [signedOut, requestDuringClose] = await Promise.all([
      request('/api/auth/sign-out', 'POST', undefined, credential),
      request('/api/v1/accounts', 'GET', undefined, credential),
    ]);
    expect(signedOut.status).toBe(200);
    expect([200, 401]).toContain(requestDuringClose.status);
    expect((await request('/api/v1/accounts', 'GET', undefined, credential)).status).toBe(401);
  });
});
