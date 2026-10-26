import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as mail from '../../src/modules/usuarios/shared/transactional-mail.js';
import { login, request, reset } from '../helpers.js';

describe('invitation mail response contract', () => {
  beforeEach(reset);
  afterEach(() => vi.restoreAllMocks());
  it.each([
    ['accepted', 201, undefined, 'ENVIADA'],
    ['rejected', 503, 'DELIVERY_FAILED', 'ERROR'],
    ['unknown', 503, 'DELIVERY_STATUS_UNKNOWN', 'PENDIENTE'],
  ] as const)('%s produces an honest create/reissue response', async (outcome, status, code, deliveryStatus) => {
    const admin = await login();
    const send = vi.spyOn(mail, 'sendTransactionalMail').mockResolvedValue({ outcome });
    const response = await request('/api/v1/accounts', 'POST', { name: 'Fictitious teacher', email: 'contract@pilot.edu.co', role: 'TEACHER' }, admin);
    expect(response.status).toBe(status);
    const body = await response.json();
    if (code) expect(body.code).toBe(code);
    expect(body.token).toBeUndefined(); expect(body.operationId).toBeUndefined();
    const listed = await (await request('/api/v1/accounts', 'GET', undefined, admin)).json();
    const account = listed.items.find((x: { email: string }) => x.email === 'contract@pilot.edu.co');
    expect(account).toMatchObject({ status: 'PENDIENTE', deliveryStatus });
    expect((await request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: account.email }, admin)).status).toBe(status === 201 ? 200 : status);
    expect(send).toHaveBeenCalledTimes(2);
    const denied = await request('/api/v1/accounts', 'POST', { name: 'No access', email: 'denied@pilot.edu.co', role: 'TEACHER' });
    expect(denied.status).toBe(401); expect(send).toHaveBeenCalledTimes(2);
  });
});
