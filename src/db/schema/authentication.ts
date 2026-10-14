import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, index, check } from 'drizzle-orm/pg-core';
import { session } from './auth.js';
import { userAccounts } from './accounts.js';

export const sessionActivity = pgTable('session_activity', {
  sessionId: text('session_id').primaryKey().references(() => session.id, { onDelete: 'cascade' }),
  lastAcceptedAt: timestamp('last_accepted_at', { withTimezone: true }).notNull(),
});

export const passwordRecoveryVerifications = pgTable('password_recovery_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => userAccounts.id),
  emailNormalized: text('email_normalized').notNull(),
  tokenDigest: text('token_digest').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
}, (t) => [
  index('password_recovery_account_created_idx').on(t.accountId, t.createdAt),
  check('password_recovery_ttl_check', sql`${t.expiresAt} = ${t.createdAt} + interval '30 minutes'`),
  check('password_recovery_state_check', sql`${t.consumedAt} is null or ${t.invalidatedAt} is null`),
]);
