import { expect, it } from 'vitest';
import { authorizeScope } from '../../src/modules/usuarios/scope-authorization.js';

it('solo permite al docente activo el objetivo que Académico confirma para la operación actual', async () => {
  const assignments = { 'teacher-one': 'group-one', 'teacher-two': 'group-two' } as const;
  const provider = { async hasAssignment(accountId: string, operation: 'read' | 'write', target: { kind: 'student' | 'group'; id: string }) {
    return operation === 'read' && target.kind === 'group' &&
      assignments[accountId as keyof typeof assignments] === target.id;
  } };
  const own = await authorizeScope({ id: 'teacher-one', status: 'ACTIVA', role: 'TEACHER' },
    { operation: 'read', target: { kind: 'group', id: 'group-one' } }, provider);
  expect(own).toEqual({ allowed: true, scope: { kind: 'group', id: 'group-one' } });
  expect(await authorizeScope({ id: 'teacher-one', status: 'ACTIVA', role: 'TEACHER' },
    { operation: 'read', target: { kind: 'group', id: 'group-two' } }, provider)).toEqual({ allowed: false });
  expect(await authorizeScope({ id: 'teacher-two', status: 'ACTIVA', role: 'TEACHER' },
    { operation: 'write', target: { kind: 'group', id: 'group-two' } }, provider)).toEqual({ allowed: false });
  expect(await authorizeScope({ id: 'teacher-one', status: 'INACTIVA', role: 'TEACHER' },
    { operation: 'read', target: { kind: 'group', id: 'group-one' } }, provider)).toEqual({ allowed: false });
  expect(await authorizeScope({ id: 'administrator', status: 'ACTIVA', role: 'ADMIN' },
    { operation: 'read', target: { kind: 'group', id: 'group-one' } }, provider)).toEqual({ allowed: false });
  expect(await authorizeScope({ id: 'teacher-one', status: 'ACTIVA', role: 'TEACHER' },
    { operation: 'read', target: { kind: 'group', id: 'group-one' } })).toEqual({ allowed: false });
});

it('deniega verificaciones inconclusas y objetivos o filtros que el cliente intenta añadir', async () => {
  const actor = { id: 'teacher-one', status: 'ACTIVA', role: 'TEACHER' };
  const provider = { async hasAssignment() { throw new Error('Académico no disponible'); } };
  expect(await authorizeScope(actor, { operation: 'read', target: { kind: 'student', id: 'student-two' } }, provider))
    .toEqual({ allowed: false });
  expect(await authorizeScope(actor, { operation: 'read', target: { kind: 'student', id: ' ' } },
    { async hasAssignment() { return true; } })).toEqual({ allowed: false });
  // El proveedor nunca puede ser reemplazado por una afirmación del cliente.
  expect(await authorizeScope(actor, { operation: 'read', target: { kind: 'group', id: 'group-two' } },
    { async hasAssignment() { return false; } })).toEqual({ allowed: false });
});
