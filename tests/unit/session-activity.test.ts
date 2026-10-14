import { describe, expect, it } from 'vitest';
import { isSessionExpired, nextAcceptedAt } from '../../src/auth/session-activity.js';

describe('inactividad de sesión', () => {
  const start = new Date('2026-10-13T12:00:00.000Z');

  it('acepta 29:59.999 y vence exactamente en 30:00.000', () => {
    expect(isSessionExpired(start, new Date(start.getTime() + 1_799_999))).toBe(false);
    expect(isSessionExpired(start, new Date(start.getTime() + 1_800_000))).toBe(true);
    expect(isSessionExpired(start, new Date(start.getTime() + 1_800_001))).toBe(true);
  });

  it('usa la creación si aún no existe marca de actividad y nunca retrocede', () => {
    expect(isSessionExpired(start, new Date(start.getTime() + 1_800_000))).toBe(true);
    const later = new Date(start.getTime() + 25_000);
    expect(nextAcceptedAt(later, start)).toEqual(later);
    expect(nextAcceptedAt(start, later)).toEqual(later);
  });
});
