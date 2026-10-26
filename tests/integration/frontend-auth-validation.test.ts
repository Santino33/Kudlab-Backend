import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { auth } from '../../src/auth/auth.js';
import { db } from '../../src/db/client.js';
import { session } from '../../src/db/schema/auth.js';
import { sessionActivity } from '../../src/db/schema/authentication.js';
import { request, reset } from '../helpers.js';

async function cookieLogin() {
  const response = await request('/api/auth/sign-in/email', 'POST', {
    email: 'admin@pilot.edu.co', password: 'TestingA123', rememberMe: true,
  });
  expect(response.status).toBe(200);
  const cookies = response.headers.getSetCookie();
  expect(cookies.some((cookie) => cookie.startsWith('better-auth.session_token='))).toBe(true);
  return { cookie: cookies.map((cookie) => cookie.split(';')[0]).join('; ') };
}

async function currentSession(credential: Record<string, string>) {
  const response = await request('/api/auth/get-session', 'GET', undefined, credential);
  expect(response.status).toBe(200);
  return (await response.json()).session as { id: string; expiresAt: string };
}

async function ageSession(id: string, seconds: number) {
  await db.update(session).set({ createdAt: new Date(Date.now() - seconds * 1000),
    updatedAt: new Date(Date.now() - seconds * 1000),
    expiresAt: new Date(Date.now() + (1800 - seconds) * 1000) }).where(eq(session.id, id));
}

function expectRenewal(response: Response) {
  expect(response.headers.getSetCookie().some((cookie) =>
    cookie.startsWith('better-auth.session_token=') && cookie.includes('Max-Age=1800'))).toBe(true);
  expect(response.headers.has('set-auth-token')).toBe(false);
  expect(response.headers.has('set-auth-jwt')).toBe(false);
}

describe('garantías de cookie/sesión para frontend', () => {
  beforeEach(reset);
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it('cierre confirmado revoca la cookie original y conserva otra sesión independiente', async () => {
    const first = await cookieLogin();
    const second = await cookieLogin();
    const response = await request('/api/auth/sign-out', 'POST', {}, first);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.getSetCookie().some((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
    expect((await request('/api/auth/get-session', 'GET', undefined, first)).status).toBe(401);
    expect((await request('/api/auth/get-session', 'GET', undefined, second)).status).toBe(200);
  });

  it('confirma revocación persistida aunque el proveedor absorba su fallo de borrado', async () => {
    const first = await cookieLogin();
    const second = await cookieLogin();
    const adapter = (await auth.$context).internalAdapter;
    vi.spyOn(adapter, 'deleteSession').mockRejectedValueOnce(new Error('SYNTHETIC_PROVIDER_DELETE_FAILURE'));
    const response = await request('/api/auth/sign-out', 'POST', {}, first);
    expect(response.status).toBe(200);
    expect((await request('/api/auth/get-session', 'GET', undefined, first)).status).toBe(401);
    expect((await request('/api/auth/get-session', 'GET', undefined, second)).status).toBe(200);
  });

  it('si fallan ambos borrados devuelve 503 sin cookies de cierre; permite revisión y reintento explícito', async () => {
    const credential = await cookieLogin();
    const adapter = (await auth.$context).internalAdapter;
    vi.spyOn(adapter, 'deleteSession').mockRejectedValueOnce(new Error('SYNTHETIC_PROVIDER_DELETE_FAILURE'));
    vi.spyOn(db, 'delete').mockImplementationOnce(() => { throw new Error('SYNTHETIC_PERSISTED_DELETE_FAILURE'); });
    const response = await request('/api/auth/sign-out', 'POST', {}, credential);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: 'UNAVAILABLE', message: 'Operación no confirmada' });
    expect(response.headers.getSetCookie()).toHaveLength(0);
    vi.restoreAllMocks();
    expect((await request('/api/auth/get-session', 'GET', undefined, credential)).status).toBe(200);
    expect((await request('/api/auth/sign-out', 'POST', {}, credential)).status).toBe(200);
    expect((await request('/api/auth/get-session', 'GET', undefined, credential)).status).toBe(401);
  });

  it('la revocación adicional no se ejecuta si el proveedor rechaza; el rechazo asíncrono se normaliza', async () => {
    const credential = await cookieLogin();
    const deletion = vi.spyOn(db, 'delete');
    const handler = vi.spyOn(auth, 'handler').mockResolvedValueOnce(Response.json({ code: 'INVALID_ORIGIN' }, { status: 403 }));
    expect((await request('/api/auth/sign-out', 'POST', {}, credential)).status).toBe(403);
    expect(deletion).not.toHaveBeenCalled();
    handler.mockRejectedValueOnce(new Error('SYNTHETIC_ASYNC_PROVIDER_FAILURE'));
    const response = await request('/api/auth/sign-out', 'POST', {}, credential);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: 'UNAVAILABLE', message: 'Operación no confirmada' });
    expect(response.headers.getSetCookie()).toHaveLength(0);
    expect(deletion).not.toHaveBeenCalled();
  });

  it('consulta propaga cookie renovada pero no crea actividad protegida', async () => {
    const credential = await cookieLogin();
    const current = await currentSession(credential);
    await ageSession(current.id, 61);
    const response = await request('/api/auth/get-session', 'GET', undefined, credential);
    expect(response.status).toBe(200);
    expectRenewal(response);
    expect(await db.select().from(sessionActivity).where(eq(sessionActivity.sessionId, current.id))).toHaveLength(0);
  });

  it('operación protegida propaga renovación y solo su aceptación registra actividad', async () => {
    const credential = await cookieLogin();
    const current = await currentSession(credential);
    await ageSession(current.id, 61);
    const response = await request('/api/v1/accounts', 'GET', undefined, credential);
    expect(response.status).toBe(200);
    expectRenewal(response);
    expect(await db.select().from(sessionActivity).where(eq(sessionActivity.sessionId, current.id))).toHaveLength(1);
  });

  it('renovación interna no reabre 30 minutos de inactividad ni transmite su cookie', async () => {
    const credential = await cookieLogin();
    const current = await currentSession(credential);
    await db.update(session).set({ createdAt: new Date(Date.now() - 1800000),
      expiresAt: new Date(Date.now() + 1000) }).where(eq(session.id, current.id));
    const response = await request('/api/auth/get-session', 'GET', undefined, credential);
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toHaveLength(0);
    expect(await db.select().from(session).where(eq(session.id, current.id))).toHaveLength(0);
  });

  it('reloj controlado: cookie renovada a 61 s permite continuar a 1801 s sin reabrir después del límite protegido', async () => {
    const credential = await cookieLogin();
    const start = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(start + 61000);
    const accepted = await request('/api/v1/accounts', 'GET', undefined, credential);
    expect(accepted.status).toBe(200);
    expectRenewal(accepted);
    const cookies = accepted.headers.getSetCookie();
    const renewed = { cookie: cookies.map((cookie) => cookie.split(';')[0]).join('; ') };
    const maxAge = Number(cookies.find((cookie) => cookie.startsWith('better-auth.session_token='))?.match(/Max-Age=(\d+)/)?.[1]);
    expect(61 + maxAge).toBeGreaterThan(1801);
    vi.setSystemTime(start + 1801000);
    expect((await request('/api/auth/get-session', 'GET', undefined, renewed)).status).toBe(200);
    vi.setSystemTime(start + 1861000);
    expect((await request('/api/auth/get-session', 'GET', undefined, renewed)).status).toBe(401);
  });
});
