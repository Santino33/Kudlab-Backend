import { randomUUID } from 'node:crypto';
import { db } from '../src/db/client.js';
import { students } from '../src/db/schema/academic.js';
import { createApp } from '../src/app.js';
import { academicFixture } from './helpers.js';

export function assertObservationTestDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  if (process.env.NODE_ENV !== 'test' || url.hostname !== 'feat-observaciones-tests-20261109' ||
    url.pathname !== '/kudlab_observaciones_test' || url.port !== '5432') throw new Error('ISOLATED_OBSERVATION_TEST_DATABASE_REQUIRED');
}
export async function observationFixture() {
  assertObservationTestDatabase();
  const scope = await academicFixture();
  const [student] = await db.insert(students).values({ groupId: scope.aGroups[0]!.id, studentCode: 'OBS-FICTICIO',
    firstName: 'Participante', lastName: 'Ficticio' }).returning();
  // Test boundary doubles only for evidence storage/validation, not consent/activation/authorization.
  const app = createApp({}, { storage: { putImmutable: async () => {}, readVerified: async () => Buffer.from('fixture') },
    validate: async () => ({ kind: 'valid', mediaType: 'image/png' }) });
  const headers = { ...scope.a.teacher, origin: process.env.SPA_ORIGIN!, 'content-type': 'application/json' };
  const consentPath = `/api/v1/students/${student!.id}/consents`;
  async function activate() {
    const form = new FormData();
    form.append('file', new File(['fixture'], 'ficticio.png', { type: 'image/png' }));
    form.append('metadata', JSON.stringify({ requestId: randomUUID(), expectedVersion: 0, signedOn: '2026-01-01', receivedOn: '2026-01-02' }));
    const res = await app.request(consentPath, { method: 'POST', headers: { ...scope.a.teacher, origin: process.env.SPA_ORIGIN! }, body: form });
    if (res.status !== 201) throw new Error(`Consent fixture failed: ${res.status}`);
    return res.json();
  }
  const input = () => ({ requestId: randomUUID(), behavior: 'ATTENTION', frequency: 'SOMETIMES',
    observedOn: '2026-01-01', schoolYear: 2025, term: 1 });
  return { ...scope, student: student!, app, headers, activate, input, consentPath };
}
