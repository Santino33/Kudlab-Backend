// Funciones puras de lectura. No tocan la base de datos ni `runtime/*`.
export type ExecutionStatus = 'READY' | 'RUNNING' | 'COMPLETED' | 'INTERRUPTED' | 'EXPIRED' | 'UNCONFIRMED';
export type ApprovalAtCalculation = 'APPROVED' | 'NOT_ESTABLISHED';

// Misma regla que el detalle de sesión (`tareas/runtime/service.ts`): 32 minutos (1 920 000 ms) desde el inicio.
// Se duplica a propósito para no modificar el runtime; la paridad se prueba contra el endpoint de detalle (T-B04, R-2).
export const RUNNING_CONFIRMATION_WINDOW_MS = 1_920_000;

export function normalizeExecutionStatus(session: { executionStatus: ExecutionStatus; startAllowedUntil: Date; startedAtServer: Date | null }, now: Date): ExecutionStatus {
  if (session.executionStatus === 'READY' && session.startAllowedUntil.getTime() <= now.getTime()) return 'EXPIRED';
  if (session.executionStatus === 'RUNNING' && session.startedAtServer !== null
    && session.startedAtServer.getTime() + RUNNING_CONFIRMATION_WINDOW_MS <= now.getTime()) return 'UNCONFIRMED';
  return session.executionStatus;
}

// D-8: `APPROVED` solo si la aprobación es anterior o igual al fin del cálculo; en otro caso no se inventa historia.
export function approvalAtCalculation(rule: { approvalStatus: 'PROPOSED' | 'APPROVED'; approvedAt: Date | null }, finishedAt: Date | null): ApprovalAtCalculation {
  if (rule.approvalStatus !== 'APPROVED' || rule.approvedAt === null || finishedAt === null) return 'NOT_ESTABLISHED';
  return rule.approvedAt.getTime() <= finishedAt.getTime() ? 'APPROVED' : 'NOT_ESTABLISHED';
}
