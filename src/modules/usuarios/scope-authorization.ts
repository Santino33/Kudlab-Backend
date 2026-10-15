// Boundary for future Academic consumers. Assignment data is owned by Académico;
// no student/group route can grant access without its current decision.
export type ScopeTarget = { kind: 'student' | 'group'; id: string };
export type ScopeRequest = { operation: 'read' | 'write'; target: ScopeTarget };
export type AssignmentProvider = {
  hasAssignment(accountId: string, operation: 'read' | 'write', target: ScopeTarget): Promise<boolean>;
};
export type ScopeDecision = { allowed: false } | { allowed: true; scope: ScopeTarget };

export async function authorizeScope(
  actor: { id: string; status: string; role: string } | undefined,
  request: ScopeRequest,
  provider?: AssignmentProvider,
): Promise<ScopeDecision> {
  const { operation, target } = request;
  if (!actor?.id || actor.status !== 'ACTIVA' || actor.role !== 'TEACHER' || !provider ||
    !['read', 'write'].includes(operation) || !target || !['student', 'group'].includes(target.kind) ||
    typeof target.id !== 'string' || !target.id.trim()) return { allowed: false };

  const scope = { kind: target.kind, id: target.id.trim() };
  try {
    if (await provider.hasAssignment(actor.id, operation, scope) === true) return { allowed: true, scope };
  } catch {
    // A failed or unavailable assignment check never grants access.
  }
  return { allowed: false };
}
