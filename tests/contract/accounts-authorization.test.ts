import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/db/client.js';
import { auditEvents, userAccounts } from '../../src/db/schema/accounts.js';
import { inviteTeacher, request, reset } from '../helpers.js';

describe('contrato de permisos de gestión de cuentas', () => {
  beforeEach(reset);

  it('el administrador activo puede leer cuentas y consultar su auditoría; un docente no ve ni modifica nada', async () => {
    const { account, admin, teacher } = await inviteTeacher();
    expect((await request('/api/v1/accounts', 'GET', undefined, admin)).status).toBe(200);
    expect((await request(`/api/v1/accounts/${account.id}`, 'GET', undefined, admin)).status).toBe(200);
    expect((await request(`/api/v1/accounts/${account.id}/audit`, 'GET', undefined, admin)).status).toBe(200);

    const count = (await db.select().from(userAccounts)).length;
    const audits = (await db.select().from(auditEvents)).length;
    for (const [path, method, body] of [
      ['/api/v1/accounts', 'GET', undefined],
      ['/api/v1/accounts', 'POST', { name: 'No autorizada', email: 'new@pilot.edu.co', role: 'TEACHER' }],
      [`/api/v1/accounts/${account.id}`, 'GET', undefined],
      [`/api/v1/accounts/${account.id}`, 'PATCH', { name: 'Invasión' }],
      [`/api/v1/accounts/${account.id}/role`, 'PUT', { role: 'TEACHER' }],
      [`/api/v1/accounts/${account.id}/audit`, 'GET', undefined],
      [`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }],
    ] as const) {
      for (const headers of [teacher, {}]) {
        const response = await request(path, method, body, headers);
        expect(response.status).toBe(headers === teacher ? 403 : 401);
        expect(await response.json()).toEqual(headers === teacher
          ? { code: 'FORBIDDEN', message: 'Acceso denegado' }
          : { code: 'UNAUTHENTICATED', message: 'Sesión requerida' });
      }
    }
    expect((await db.select().from(userAccounts)).length).toBe(count);
    expect((await db.select().from(auditEvents)).length).toBe(audits);
    const stillActive = await (await request(`/api/v1/accounts/${account.id}`, 'GET', undefined, admin)).json();
    expect(stillActive.name).toBe('Docente Test');
    expect(stillActive.status).toBe('ACTIVA');
  });

  it('sin autorización se deniega antes de validar cuerpo o revelar si la cuenta existe', async () => {
    const { teacher } = await inviteTeacher();
    for (const id of ['00000000-0000-0000-0000-000000000000', 'not-an-id']) {
      const response = await request(`/api/v1/accounts/${id}`, 'PATCH', { name: '' }, teacher);
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ code: 'FORBIDDEN', message: 'Acceso denegado' });
    }
    expect((await request('/api/auth/admin/list-users', 'GET', undefined, teacher)).status).toBe(403);
  });
});
