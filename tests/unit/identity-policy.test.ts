import { expect, it } from 'vitest';
import { hasActiveIdentity } from '../../src/modules/usuarios/shared/accounts.types.js';

it('solo autoriza el rol único vigente y una identidad no bloqueada', () => {
  expect(hasActiveIdentity({ status: 'ACTIVA', role: 'ADMIN' }, { role: 'admin', banned: false })).toBe(true);
  expect(hasActiveIdentity({ status: 'ACTIVA', role: 'TEACHER' }, { role: 'teacher', banned: false })).toBe(true);
  for (const account of [undefined, { status: 'INACTIVA', role: 'ADMIN' }, { status: 'PENDIENTE', role: 'TEACHER' }, { status: 'ACTIVA', role: 'admin,teacher' }])
    expect(hasActiveIdentity(account, { role: 'admin', banned: false })).toBe(false);
  expect(hasActiveIdentity({ status: 'ACTIVA', role: 'ADMIN' }, { role: 'admin', banned: true })).toBe(false);
  expect(hasActiveIdentity({ status: 'ACTIVA', role: 'TEACHER' }, { role: 'admin', banned: false })).toBe(false);
});
