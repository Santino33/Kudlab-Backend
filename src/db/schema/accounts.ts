import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid, jsonb, uniqueIndex, check, index } from 'drizzle-orm/pg-core';
import { user } from './auth.js';

export const userAccounts = pgTable('user_accounts', {
  id: uuid('id').primaryKey().defaultRandom(), authUserId: text('auth_user_id').unique().references(() => user.id),
  emailNormalized: text('email_normalized').notNull().unique(), pendingEmailNormalized: text('pending_email_normalized'),
  fullName: text('full_name').notNull(), role: text('role').notNull(), status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check('account_role_check', sql`${t.role} in ('ADMIN','TEACHER')`),
  check('account_status_check', sql`${t.status} in ('PENDIENTE','ACTIVA','INACTIVA')`),
  check('account_auth_check', sql`(${t.status} = 'PENDIENTE' and ${t.authUserId} is null) or (${t.status} <> 'PENDIENTE' and ${t.authUserId} is not null)`),
  check('account_email_check', sql`${t.emailNormalized} = lower(${t.emailNormalized}) and ${t.emailNormalized} ~ '^[^@[:space:]]+@([a-z0-9-]+\\.)+edu\\.co$'`),
  check('pending_email_check', sql`${t.pendingEmailNormalized} is null or (${t.pendingEmailNormalized} = lower(${t.pendingEmailNormalized}) and ${t.pendingEmailNormalized} ~ '^[^@[:space:]]+@([a-z0-9-]+\\.)+edu\\.co$')`),
  uniqueIndex('account_pending_email_unique').on(t.pendingEmailNormalized),
]);

export const invitations = pgTable('account_invitations', {
  id: uuid('id').primaryKey().defaultRandom(), accountId: uuid('account_id').notNull().references(() => userAccounts.id),
  emailNormalized: text('email_normalized').notNull(), tokenDigest: text('token_digest').notNull().unique(),
  createdBy: text('created_by').notNull(), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }), invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  deliveryStatus: text('delivery_status').notNull().default('PENDIENTE'),
}, (t) => [index('invitation_latest_account_idx').on(t.accountId, t.createdAt.desc(), t.id.desc()),
  check('invitation_delivery_check', sql`${t.deliveryStatus} in ('PENDIENTE','ENVIADA','ERROR')`),
  check('invitation_ttl_check', sql`${t.expiresAt} = ${t.createdAt} + interval '7 days'`)]);

export const adminRoleRequests = pgTable('admin_role_requests', {
  id: uuid('id').primaryKey().defaultRandom(), requesterAccountId: uuid('requester_account_id').notNull().references(() => userAccounts.id),
  status: text('status').notNull().default('PENDIENTE'), requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  decidedByAccountId: uuid('decided_by_account_id').references(() => userAccounts.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
}, (t) => [uniqueIndex('one_pending_request').on(t.requesterAccountId).where(sql`${t.status} = 'PENDIENTE'`),
  check('request_status_check', sql`${t.status} in ('PENDIENTE','APROBADA','RECHAZADA')`),
  check('decision_check', sql`(${t.status} = 'PENDIENTE' and ${t.decidedAt} is null and ${t.decidedByAccountId} is null) or (${t.status} <> 'PENDIENTE' and ${t.decidedAt} is not null and ${t.decidedByAccountId} is not null)`)]);

export const emailChanges = pgTable('account_email_changes', {
  id: uuid('id').primaryKey().defaultRandom(), accountId: uuid('account_id').notNull().references(() => userAccounts.id),
  requestedByAuthUserId: text('requested_by_auth_user_id').references(() => user.id),
  newEmailNormalized: text('new_email_normalized').notNull(), tokenDigest: text('token_digest').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), consumedAt: timestamp('consumed_at', { withTimezone: true }),
  invalidatedAt: timestamp('invalidated_at', { withTimezone: true }), createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('email_change_account_idx').on(t.accountId),
  uniqueIndex('email_change_pending_unique').on(t.newEmailNormalized).where(sql`${t.consumedAt} is null and ${t.invalidatedAt} is null`)]);

export const auditEvents = pgTable('account_audit_events', {
  id: uuid('id').primaryKey().defaultRandom(), targetAccountId: uuid('target_account_id').notNull().references(() => userAccounts.id),
  actorAuthUserId: text('actor_auth_user_id').notNull(), action: text('action').notNull(),
  before: jsonb('before'), after: jsonb('after'), occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('audit_account_idx').on(t.targetAccountId)]);
