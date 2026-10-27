import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { loadEnv } from '../../../config/env.js';
import { GameError } from './errors.js';
import { canonical } from './contract.js';

export function runtimeSettings() {
  const env = loadEnv();
  if (!env.GAME_RUNTIME_ORIGIN) throw new GameError(503, 'UNAVAILABLE');
  return { origin: env.GAME_RUNTIME_ORIGIN, keyId: env.GAME_ACTIVE_KEY_ID!, keys: JSON.parse(env.GAME_GRANT_KEYS!) as Record<string, string>, cursorKey: env.GAME_CURSOR_KEY! };
}
export function encryptGrant(value: string, aad: string) {
  const { keyId, keys } = runtimeSettings(), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(keys[keyId]!, 'hex'), iv);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { keyId, ciphertext: Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url') };
}
export function decryptGrant(value: string, keyId: string, aad: string) {
  const key = runtimeSettings().keys[keyId];
  if (!key) throw new GameError(503, 'UNAVAILABLE');
  const bytes = Buffer.from(value, 'base64url'), decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28)); decipher.setAAD(Buffer.from(aad));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
}
function sign(value: string) { return createHmac('sha256', Buffer.from(runtimeSettings().cursorKey, 'hex')).update(value).digest('base64url'); }
export function cursorFor(filter: string, position: unknown) {
  const body = Buffer.from(canonical({ filter, position })).toString('base64url');
  return `${body}.${sign(body)}`;
}
export function cursorPosition(cursor: string | undefined, filter: string): unknown {
  if (!cursor) return null;
  try {
    const [body, signature, extra] = cursor.split('.');
    if (!body || !signature || extra || !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(body)))) throw new Error();
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (parsed.filter !== filter) throw new Error();
    return parsed.position;
  } catch { throw new GameError(400, 'INVALID_INPUT'); }
}
