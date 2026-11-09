import type { AcademicTransaction } from './academic-auth.js';
import { GameError } from '../../tareas/runtime/errors.js';
import { eq } from 'drizzle-orm';
import { students } from '../../../db/schema/academic.js';
import { assertLocalSynthetic } from '../../../config/local-synthetic.js';
import { readConsentDecision } from '../consents/consent-decision.js';

export type Participation = (tx: AcademicTransaction, studentId: string, at: Date) => Promise<
  { status: 'ALLOWED'; authorizationReference: string; validUntil: Date | null } | { status: 'DENIED' | 'UNAVAILABLE' }>;
export type GameDependencies = { testParticipation?: Participation; testActiveStudents?: boolean; localSynthetic?: true };
export function assertTestDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? 'https://invalid');
  if (process.env.NODE_ENV !== 'test' || !/^\/(kudlab_j02_[a-z0-9_]*test|kudlab_consent_phase_b_test)$/.test(url.pathname))
    throw new Error('SYNTHETIC_PARTICIPATION_REQUIRES_ISOLATED_TEST_DATABASE');
}
export function participationProvider(dependencies: GameDependencies): Participation {
  if (dependencies.localSynthetic) {
    syntheticEnabled(dependencies);
    return async (tx, id, at) => {
      syntheticEnabled(dependencies);
      const [student] = await tx.select().from(students).where(eq(students.id, id));
      return student?.isActive ? { status: 'ALLOWED', authorizationReference: `SYNTHETIC-LOCAL:${id}`,
        validUntil: new Date(at.getTime() + 86400000) } : { status: 'DENIED' };
    };
  }
  if (!dependencies.testParticipation) return async (tx, id, at) => {
    const decision = await readConsentDecision(tx, id, at);
    if (decision.kind === 'unavailable') return { status: 'UNAVAILABLE' };
    const [student] = await tx.select().from(students).where(eq(students.id, id));
    return student?.isActive && decision.state === 'CURRENT'
      ? { status: 'ALLOWED', authorizationReference: decision.authorizationReference, validUntil: null }
      : { status: 'DENIED' };
  };
  assertTestDatabase();
  return async (...args) => { assertTestDatabase(); return dependencies.testParticipation!(...args); };
}
export function syntheticEnabled(dependencies: GameDependencies) {
  if (dependencies.testParticipation || dependencies.testActiveStudents) assertTestDatabase();
  if (dependencies.localSynthetic) assertLocalSynthetic();
  return Boolean(dependencies.localSynthetic || dependencies.testParticipation);
}
export function syntheticStudentActivation(dependencies: GameDependencies) {
  syntheticEnabled(dependencies);
  return Boolean(dependencies.localSynthetic || dependencies.testActiveStudents);
}
export async function requireParticipation(provider: Participation, tx: AcademicTransaction, studentId: string, at: Date) {
  const decision = await provider(tx, studentId, at);
  if (decision.status === 'UNAVAILABLE') throw new GameError(503, 'UNAVAILABLE');
  if (decision.status !== 'ALLOWED' || decision.validUntil !== null && decision.validUntil <= at || !decision.authorizationReference)
    throw new GameError(403, 'PARTICIPATION_BLOCKED');
  return decision;
}
