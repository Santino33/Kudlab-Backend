import type { AcademicTransaction } from './academic-auth.js';
import { GameError } from '../../tareas/runtime/errors.js';

export type Participation = (tx: AcademicTransaction, studentId: string, at: Date) => Promise<
  { status: 'ALLOWED'; authorizationReference: string; validUntil: Date } | { status: 'DENIED' | 'UNAVAILABLE' }>;
export type GameDependencies = { testParticipation?: Participation; testActiveStudents?: boolean };
export function assertTestDatabase() {
  const url = new URL(process.env.DATABASE_URL ?? 'https://invalid');
  if (process.env.NODE_ENV !== 'test' || !/^\/kudlab_j02_[a-z0-9_]*test$/.test(url.pathname))
    throw new Error('SYNTHETIC_PARTICIPATION_REQUIRES_ISOLATED_TEST_DATABASE');
}
export function participationProvider(dependencies: GameDependencies): Participation {
  if (!dependencies.testParticipation) return async () => ({ status: 'UNAVAILABLE' });
  assertTestDatabase();
  return async (...args) => { assertTestDatabase(); return dependencies.testParticipation!(...args); };
}
export async function requireParticipation(provider: Participation, tx: AcademicTransaction, studentId: string, at: Date) {
  const decision = await provider(tx, studentId, at);
  if (decision.status === 'UNAVAILABLE') throw new GameError(503, 'UNAVAILABLE');
  if (decision.status !== 'ALLOWED' || decision.validUntil <= at || !decision.authorizationReference)
    throw new GameError(403, 'PARTICIPATION_BLOCKED');
  return decision;
}
