import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as mail from '../../src/modules/usuarios/shared/transactional-mail.js';
import { inviteTeacher, request, reset } from '../helpers.js';

describe('verification mail HTTP contracts', () => {
  beforeEach(reset);
  afterEach(() => vi.restoreAllMocks());
  it.each(['accepted', 'rejected', 'unknown'] as const)('maps email change %s without confirming the email', async (outcome) => {
    const { account, admin } = await inviteTeacher();
    const send = vi.spyOn(mail, 'sendTransactionalMail').mockResolvedValue({ outcome });
    const response = await request(`/api/v1/accounts/${account.id}`, 'PATCH', { email: 'new@pilot.edu.co' }, admin);
    expect(response.status).toBe(outcome === 'accepted' ? 200 : 503);
    const body = await response.json();
    if (outcome !== 'accepted') expect(body.code).toBe(outcome === 'unknown' ? 'DELIVERY_STATUS_UNKNOWN' : 'DELIVERY_FAILED');
    const current = await (await request(`/api/v1/accounts/${account.id}`, 'GET', undefined, admin)).json();
    expect(current).toMatchObject({ email: 'teacher@pilot.edu.co', pendingEmail: 'new@pilot.edu.co' });
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'email-change', to: 'new@pilot.edu.co' }));
    expect(body.operationId).toBeUndefined();
  });
  it.each(['accepted', 'rejected', 'unknown'] as const)('keeps recovery %s neutral for every eligibility state', async (outcome) => {
    const { account, admin } = await inviteTeacher('inactive@pilot.edu.co');
    expect((await request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }, admin)).status).toBe(200);
    expect((await request('/api/v1/accounts', 'POST', { name: 'Pending', email: 'pending@pilot.edu.co', role: 'TEACHER' }, admin)).status).toBe(201);
    const send = vi.spyOn(mail, 'sendTransactionalMail').mockResolvedValue({ outcome });
    for (const email of ['admin@pilot.edu.co', 'inactive@pilot.edu.co', 'pending@pilot.edu.co', 'unknown@pilot.edu.co']) {
      const response = await request('/api/v1/auth/password-recovery/request', 'POST', { email });
      expect(response.status).toBe(202);
      expect(await response.json()).toEqual({ message: 'Si corresponde, recibirás instrucciones en tu correo.' });
    }
    expect(send).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'password-recovery', to: 'admin@pilot.edu.co' }));
  });
});
