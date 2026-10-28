export class GameError extends Error {
  constructor(readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 503, readonly code: string, readonly reason?: string, readonly retryAfter = 0) { super(code); }
}
export const conflict = (reason: string) => new GameError(409, 'CONFLICT', reason);
