import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, jsonb, doublePrecision, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { recipients, gameSessions, runtimeCapabilities } from './game.js';
import { userAccounts } from './accounts.js';
const at = (name: string) => timestamp(name, { withTimezone: true });
export const accessCodes = pgTable('task_access_codes', {
  id: uuid('id').primaryKey().defaultRandom(), recipientId: uuid('recipient_id').notNull().references(() => recipients.id),
  scope: text('scope', { enum: ['PLAY_AND_SUBMIT', 'SUBMIT_ONLY'] }).notNull(), sessionId: uuid('session_id').references(() => gameSessions.id),
  lookupDigest: text('lookup_digest').notNull().unique(), secretCiphertext: text('secret_ciphertext').notNull(), encryptionKeyId: text('encryption_key_id').notNull(),
  status: text('status', { enum: ['ACTIVE', 'REVOKED', 'REPLACED', 'EXPIRED'] }).notNull().default('ACTIVE'),
  issuedBy: uuid('issued_by_account_id').notNull().references(() => userAccounts.id), createdAt: at('created_at').notNull().defaultNow(),
  expiresAt: at('expires_at').notNull(), revokedAt: at('revoked_at'), replacedById: uuid('replaced_by_id'), lastClaimedAt: at('last_claimed_at'),
}, t => [uniqueIndex('one_active_play_code').on(t.recipientId).where(sql`${t.status} = 'ACTIVE' and ${t.scope} = 'PLAY_AND_SUBMIT'`),
  uniqueIndex('one_active_recovery_code').on(t.sessionId).where(sql`${t.status} = 'ACTIVE' and ${t.scope} = 'SUBMIT_ONLY'`),
  check('access_code_scope_check', sql`(${t.scope} = 'PLAY_AND_SUBMIT' and ${t.sessionId} is null) or (${t.scope} = 'SUBMIT_ONLY' and ${t.sessionId} is not null)`)]);
export const accessClaims = pgTable('task_access_claims', {
  claimId: uuid('claim_id').primaryKey(), codeId: uuid('code_id').notNull().references(() => accessCodes.id),
  capabilityId: uuid('capability_id').notNull().unique().references(() => runtimeCapabilities.id),
  sessionId: uuid('session_id').notNull().references(() => gameSessions.id), submissionId: uuid('submission_id'),
  createdAt: at('created_at').notNull().defaultNow(),
});
export const accessLimits = pgTable('task_access_limits', {
  key: text('key').primaryKey(), events: jsonb('events').$type<{ at: number; operation?: string }[]>().notNull(), tokens: doublePrecision('tokens').notNull(),
  touchedAt: at('touched_at').notNull(), expiresAt: at('expires_at').notNull(),
});
