import { createHmac, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { z } from 'zod';
import { loadEnv } from '../../../config/env.js';
import { GameError } from './errors.js';
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const codeInput = z.string().max(64).regex(/^[A-Za-z2-9 -]+$/).transform(v => v.replace(/[ -]/g, '').toUpperCase()).pipe(z.string().regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/));
export function accessSettings() {
  const env = loadEnv();
  if (!env.GAME_ACCESS_ENABLED) throw new GameError(503, 'UNAVAILABLE');
  return { lookupKey: env.GAME_ACCESS_LOOKUP_KEY!, keyId: env.GAME_ACCESS_ACTIVE_KEY_ID!, keys: JSON.parse(env.GAME_ACCESS_KEYS!) as Record<string, string>, ipKey: env.GAME_ACCESS_IP_KEY! };
}
export function accessDigest(value: string, ip = false) {
  const s = accessSettings();
  return createHmac('sha256', Buffer.from(ip ? s.ipKey : s.lookupKey, 'hex')).update(value).digest('hex');
}
export function newCode() { return [...randomBytes(5)].map(n => CODE_ALPHABET[n & 31]).join(''); }
export function sealCode(value: string, aad: string) {
  const { keys, keyId } = accessSettings(), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', Buffer.from(keys[keyId]!, 'hex'), iv);
  cipher.setAAD(Buffer.from(aad));
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return { keyId, ciphertext: Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url') };
}
export function openCode(value: string, keyId: string, aad: string) {
  const key = accessSettings().keys[keyId]; if (!key) throw new GameError(503, 'UNAVAILABLE');
  const bytes = Buffer.from(value, 'base64url'), cipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(aad)); cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8');
}
