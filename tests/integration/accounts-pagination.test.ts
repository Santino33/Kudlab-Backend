import { expect, it, vi } from 'vitest';
import { db } from '../../src/db/client.js';
import { invitations, userAccounts } from '../../src/db/schema/accounts.js';
import { listAccounts } from '../../src/modules/usuarios/accounts.service.js';
import { login, request, reset } from '../helpers.js';

it('consulta 100 cuentas con número acotado de queries y páginas de orden estable', async () => {
  await reset();
  const createdAt = new Date('2026-01-01T00:00:00.000Z');
  const inserted = await db.insert(userAccounts).values(Array.from({ length: 100 }, (_, index) => ({
    fullName: `Docente ${index}`, emailNormalized: `teacher-${index}@pilot.edu.co`, role: 'TEACHER',
    status: 'PENDIENTE', createdAt,
  }))).returning({ id: userAccounts.id, email: userAccounts.emailNormalized });
  const selected = [...inserted].sort((a, b) => b.id.localeCompare(a.id))[0]!;
  const invitationDate = new Date('2026-02-01T00:00:00.000Z');
  await db.insert(invitations).values([1, 2].map((number) => ({
    id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    accountId: selected.id, emailNormalized: selected.email, createdBy: 'test-system',
    tokenDigest: String(number).repeat(64), createdAt: invitationDate,
    expiresAt: new Date(invitationDate.getTime() + 7 * 86400000),
    deliveryStatus: number === 2 ? 'ENVIADA' : 'ERROR',
  })));
  const admin = await login();
  const tracked = vi.spyOn(db, 'select');
  try {
    expect((await listAccounts(100, 0)).items).toHaveLength(100);
    expect(tracked.mock.calls.length).toBeLessThanOrEqual(3);
  } finally {
    tracked.mockRestore();
  }
  const first = await request('/api/v1/accounts?limit=100&offset=0', 'GET', undefined, admin);
  expect(first.status).toBe(200);
  const body = await first.json();
  const remaining = await (await request('/api/v1/accounts?limit=100&offset=100', 'GET', undefined, admin)).json();
  expect(body.total).toBe(101);
  expect(body.items).toHaveLength(100);
  expect(remaining.items).toHaveLength(1);
  expect(body.items.find((account: { id: string }) => account.id === selected.id)?.deliveryStatus).toBe('ENVIADA');
  const nextRead = await (await request('/api/v1/accounts?limit=100&offset=0', 'GET', undefined, admin)).json();
  expect(nextRead.items.map((account: { id: string }) => account.id)).toEqual(body.items.map((account: { id: string }) => account.id));
  expect(new Set([...body.items, ...remaining.items].map((account: { id: string }) => account.id)).size).toBe(101);
  const durations = await Promise.all(Array.from({ length: 30 }, async () => {
    const startedAt = performance.now();
    const result = await request('/api/v1/accounts?limit=100', 'GET', undefined, admin);
    expect(result.status).toBe(200);
    return performance.now() - startedAt;
  }));
  durations.sort((a, b) => a - b);
  console.info(`30 solicitudes GET con 100 cuentas; p95=${durations[Math.ceil(durations.length * 0.95) - 1]!.toFixed(1)}ms (medición local, no aprobación institucional)`);
});
