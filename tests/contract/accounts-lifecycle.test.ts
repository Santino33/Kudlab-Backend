import { beforeEach, describe, expect, it } from 'vitest';
import { inviteTeacher, request, reset } from '../helpers.js';

describe('US3 contrato de estado', () => {
  beforeEach(reset);
  it('exige confirmación y refleja estados repetidos', async () => {
    const { account, admin } = await inviteTeacher();
    expect((await request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: false }, admin)).status).toBe(400);
    expect((await request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }, admin)).status).toBe(200);
    expect((await request(`/api/v1/accounts/${account.id}/deactivate`, 'POST', { confirm: true }, admin)).status).toBe(409);
    expect((await request(`/api/v1/accounts/${account.id}/reactivate`, 'POST', { confirm: true }, admin)).status).toBe(200);
    expect((await request(`/api/v1/accounts/${account.id}/reactivate`, 'POST', { confirm: true }, admin)).status).toBe(409);
  });
});
