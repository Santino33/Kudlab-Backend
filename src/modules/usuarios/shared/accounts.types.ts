export const ACCOUNT_ROLES = ['ADMIN', 'TEACHER'] as const;
export const ACCOUNT_STATUSES = ['PENDIENTE', 'ACTIVA', 'INACTIVA'] as const;

export type AccountRole = (typeof ACCOUNT_ROLES)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type PromotionDecision = 'approve' | 'reject';
export type LifecycleAction = 'deactivate' | 'reactivate';

const authRoles = { ADMIN: 'admin', TEACHER: 'teacher' } as const;

export function authRoleFor(role: AccountRole) {
  return authRoles[role];
}

export function hasActiveIdentity<T extends { status: string; role: string }>(
  account: T | null | undefined,
  identity: { role: string | null; banned: boolean | null } | null | undefined,
): account is T {
  if (!account || !identity || account.status !== 'ACTIVA' || identity.banned) return false;
  return ACCOUNT_ROLES.some((role) => account.role === role && identity.role === authRoleFor(role));
}
