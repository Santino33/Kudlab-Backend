import { eq, sql } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { accessLimits } from '../../../db/schema/access.js';
import { accessDigest } from './access-security.js';
export async function accessLimit(value: string, kind: 'ip' | 'code', now = Date.now(), operation?: string): Promise<number> {
  const key = `${kind}:${accessDigest(value, kind === 'ip')}`, windowMs = kind === 'ip' ? 300000 : 900000, maximum = kind === 'ip' ? 120 : 10;
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
    const [old] = await tx.select().from(accessLimits).where(eq(accessLimits.key, key));
    const events = old && old.expiresAt.getTime() > now ? old.events.filter(event => event.at > now - windowMs) : [];
    if (operation && events.some(event => event.operation === operation)) return 0;
    const tokens = old ? Math.min(60, old.tokens + Math.max(0, now - old.touchedAt.getTime()) * .0004) : 60;
    const wait = Math.max(events.length >= maximum ? events[0]!.at + windowMs - now : 0, kind === 'ip' && tokens < 1 ? (1 - tokens) / .0004 : 0);
    if (wait <= 0) events.push({ at: now, ...(operation ? { operation } : {}) });
    const row = { key, events, tokens: kind === 'ip' ? Math.max(0, tokens - (wait <= 0 ? 1 : 0)) : 0, touchedAt: new Date(now), expiresAt: new Date(now + 900000) };
    await tx.insert(accessLimits).values(row).onConflictDoUpdate({ target: accessLimits.key, set: row });
    return Math.max(0, Math.ceil(wait / 1000));
  });
}
export async function cleanAccessLimits() { await db.delete(accessLimits).where(sql`${accessLimits.expiresAt} <= now()`); }
export function startAccessCleanup() {
  const tick = () => void cleanAccessLimits().catch(() => console.warn('{"event":"access_cleanup_unavailable","code":"UNAVAILABLE"}'));
  tick(); const timer = setInterval(tick, 300000); timer.unref(); return () => clearInterval(timer);
}
