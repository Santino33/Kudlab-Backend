import { sql } from 'drizzle-orm';
import { app } from '../src/app.js';
import { db } from '../src/db/client.js';
import { bootstrapAdmin } from '../src/scripts/bootstrap-admin.js';
import { capturedMail } from '../src/modules/usuarios/invitations.mailer.js';

export async function reset() {
  await db.execute(sql`truncate password_recovery_verifications, session_activity, account_audit_events, account_email_changes, account_invitations, admin_role_requests, user_accounts, session, account, verification, jwks, "user" restart identity cascade`);
  capturedMail.length = 0;
  await bootstrapAdmin();
}
export async function login(email = 'admin@pilot.edu.co', password = 'TestingA123'): Promise<Record<string, string>> {
  const response = await app.request('/api/auth/sign-in/email', { method: 'POST', headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }) });
  if (!response.ok) throw new Error(`Login failed: ${response.status} ${await response.text()}`);
  const bearer = response.headers.get('set-auth-token');
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!bearer && !cookie) throw new Error('Sesión sin credencial');
  return bearer ? { authorization: `Bearer ${bearer}` } : { cookie: cookie! };
}

export async function loginPair(email = 'admin@pilot.edu.co', password = 'TestingA123') {
  const first = await login(email, password);
  const second = await login(email, password);
  return { first, second };
}

export async function request(path: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return app.request(path, { method, headers: { origin: 'http://localhost:5173', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
export async function inviteTeacher(email = 'teacher@pilot.edu.co') {
  const admin = await login();
  const response = await request('/api/v1/accounts', 'POST', { name: 'Docente Test', email, role: 'TEACHER' }, admin);
  if (response.status !== 201) throw new Error(`Invitación fallida ${response.status} ${await response.text()}`);
  const account = await response.json();
  const token = new URL(capturedMail.at(-1)!.url).searchParams.get('token');
  const accepted = await request('/api/v1/account-invitations/accept', 'POST', { token, password: 'TeacherPass1' });
  if (accepted.status !== 200) throw new Error(`Activación fallida ${accepted.status} ${await accepted.text()}`);
  return { account, admin, teacher: await login(email, 'TeacherPass1') };
}
