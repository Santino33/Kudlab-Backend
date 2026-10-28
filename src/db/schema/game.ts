import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, bigint, numeric, unique, uniqueIndex, index, check, foreignKey } from 'drizzle-orm/pg-core';
import { tasks, taskPublishedVersions } from './tasks.js';
import { groups, students } from './academic.js';
import { userAccounts } from './accounts.js';
import type { Config, Envelope, Trial, Incident } from '../../modules/tareas/runtime/contract.js';

const at = (name: string) => timestamp(name, { withTimezone: true });
export const indicatorRules = pgTable('indicator_rule_versions', {
  id: uuid('id').primaryKey().defaultRandom(), taskId: text('task_id').notNull().references(() => tasks.id),
  code: text('code').notNull(), version: integer('version').notNull(), definition: jsonb('definition').notNull(),
  definitionHash: text('definition_hash').notNull(), approvalStatus: text('approval_status', { enum: ['PROPOSED', 'APPROVED'] }).notNull(),
  approvedAt: at('approved_at'), approvalReference: text('approval_reference'),
}, t => [unique().on(t.taskId, t.code, t.version), check('rule_approval_check', sql`${t.approvalStatus} in ('PROPOSED','APPROVED') and (${t.approvalStatus} <> 'APPROVED' or (${t.approvedAt} is not null and ${t.approvalReference} is not null))`)]);
export const gameConfigurations = pgTable('task_version_configurations', {
  publishedVersionId: uuid('published_version_id').primaryKey().references(() => taskPublishedVersions.id),
  contractVersion: text('contract_version').notNull(), gameBuildId: text('game_build_id').notNull(),
  configuration: jsonb('configuration').$type<Config>().notNull(), configurationHash: text('configuration_hash').notNull(),
  ruleVersionId: uuid('rule_version_id').notNull().references(() => indicatorRules.id), createdAt: at('created_at').notNull().defaultNow(),
});
export const assignments = pgTable('task_assignments', {
  id: uuid('id').primaryKey().defaultRandom(), taskId: text('task_id').notNull().references(() => tasks.id),
  publishedVersionId: uuid('published_version_id').notNull(), groupId: uuid('group_id').notNull().references(() => groups.id),
  createdBy: uuid('created_by_account_id').notNull().references(() => userAccounts.id),
  startsAt: at('starts_at').notNull(), endsAt: at('ends_at').notNull(), maxAttempts: integer('max_attempts').notNull(),
  status: text('status', { enum: ['OPEN', 'CANCELLED'] }).notNull().default('OPEN'), createdAt: at('created_at').notNull().defaultNow(),
  cancelledAt: at('cancelled_at'), cancelledBy: uuid('cancelled_by').references(() => userAccounts.id),
  requestId: uuid('creation_request_id').notNull(), requestHash: text('request_hash').notNull(),
}, t => [unique().on(t.createdBy, t.requestId), index().on(t.groupId, t.createdAt, t.id),
  foreignKey({ columns: [t.publishedVersionId, t.taskId], foreignColumns: [taskPublishedVersions.id, taskPublishedVersions.taskId] }),
  check('assignment_window_check', sql`${t.startsAt} < ${t.endsAt} and ${t.maxAttempts} between 1 and 10`),
  check('assignment_state_check', sql`(${t.status} = 'OPEN' and ${t.cancelledAt} is null and ${t.cancelledBy} is null) or (${t.status} = 'CANCELLED' and ${t.cancelledAt} is not null and ${t.cancelledBy} is not null)`)]);
export const recipients = pgTable('task_assignment_recipients', {
  id: uuid('id').primaryKey().defaultRandom(), assignmentId: uuid('assignment_id').notNull().references(() => assignments.id),
  studentId: uuid('student_id').notNull().references(() => students.id), createdAt: at('created_at').notNull().defaultNow(),
}, t => [unique().on(t.assignmentId, t.studentId), unique().on(t.id, t.studentId), index().on(t.studentId)]);
export const operationReceipts = pgTable('task_operation_receipts', {
  id: uuid('id').primaryKey().defaultRandom(), actorId: uuid('actor_account_id').notNull().references(() => userAccounts.id),
  requestId: uuid('request_id').notNull(), operation: text('operation').notNull(), requestHash: text('request_hash').notNull(),
  references: jsonb('result_references').$type<{ id: string; ids?: string[]; createdCount?: number }>().notNull(), createdAt: at('created_at').notNull().defaultNow(),
}, t => [unique().on(t.actorId, t.requestId)]);
export const gameSessions = pgTable('task_sessions', {
  id: uuid('id').primaryKey().defaultRandom(), recipientId: uuid('recipient_id').notNull(), studentId: uuid('student_id').notNull(),
  taskId: text('task_id').notNull().references(() => tasks.id), groupIdAtStart: uuid('group_id_at_start').references(() => groups.id),
  launchMode: text('launch_mode', { enum: ['SUPERVISED', 'CODE'] }).notNull().default('SUPERVISED'), sourceAccessCodeId: uuid('source_access_code_id'),
  attemptNumber: integer('attempt_number'),
  executionStatus: text('execution_status', { enum: ['READY', 'RUNNING', 'COMPLETED', 'INTERRUPTED', 'EXPIRED', 'UNCONFIRMED'] }).notNull().default('READY'),
  processingStatus: text('processing_status', { enum: ['NOT_RECEIVED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] }).notNull().default('NOT_RECEIVED'),
  preparedAt: at('prepared_at').notNull().defaultNow(), startAllowedUntil: at('start_allowed_until').notNull(),
  startedAtServer: at('started_at_server'), startRequestId: uuid('start_request_id'), uploadAllowedUntil: at('upload_allowed_until'),
  closedReceivedAt: at('closed_received_at'), participationAuthorizationRef: text('participation_authorization_ref'), activeCalculationRunId: uuid('active_calculation_run_id'),
}, t => [foreignKey({ columns: [t.recipientId, t.studentId], foreignColumns: [recipients.id, recipients.studentId] }),
  unique().on(t.recipientId, t.attemptNumber), index().on(t.studentId, t.preparedAt, t.id),
  uniqueIndex('one_active_game_session').on(t.studentId, t.taskId).where(sql`${t.executionStatus} in ('READY','RUNNING')`),
  check('game_session_attempt_check', sql`(${t.attemptNumber} is null and ${t.startedAtServer} is null and ${t.startRequestId} is null and ${t.uploadAllowedUntil} is null) or (${t.attemptNumber} between 1 and 10 and ${t.startedAtServer} is not null and ${t.startRequestId} is not null and ${t.uploadAllowedUntil} is not null)`),
  check('game_session_states_check', sql`${t.executionStatus} in ('READY','RUNNING','COMPLETED','INTERRUPTED','EXPIRED','UNCONFIRMED') and ${t.processingStatus} in ('NOT_RECEIVED','PENDING','PROCESSING','COMPLETED','FAILED')`)]);
export const runtimeCapabilities = pgTable('task_runtime_capabilities', {
  id: uuid('id').primaryKey().defaultRandom(), sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  secretDigest: text('secret_digest').notNull().unique(), claimId: uuid('claim_id').notNull(), canStart: boolean('can_start').notNull(),
  canSubmit: boolean('can_submit').notNull(), canReadReceipt: boolean('can_read_receipt').notNull(),
  startAllowedUntil: at('start_allowed_until').notNull(), expiresAt: at('expires_at').notNull(), revokedAt: at('revoked_at'), submissionId: uuid('submission_id'), sourceAccessCodeId: uuid('source_access_code_id'),
});
export const launchGrants = pgTable('task_launch_grants', {
  id: uuid('id').primaryKey().defaultRandom(), sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  scope: text('scope', { enum: ['START_SESSION', 'RECOVER_SUBMISSION'] }).notNull(), submissionId: uuid('submission_id'),
  secretDigest: text('secret_digest').notNull().unique(), secretCiphertext: text('secret_ciphertext').notNull(), encryptionKeyId: text('encryption_key_id').notNull(),
  expiresAt: at('expires_at').notNull(), claimedAt: at('claimed_at'), claimId: uuid('claim_id'),
  boundCapabilityId: uuid('bound_capability_id').references(() => runtimeCapabilities.id),
  issuedBy: uuid('issued_by_account_id').notNull().references(() => userAccounts.id), requestId: uuid('request_id').notNull(),
  requestHash: text('request_hash').notNull(), invalidatedAt: at('invalidated_at'),
}, t => [unique().on(t.issuedBy, t.requestId), check('grant_scope_check', sql`(${t.scope} = 'START_SESSION' and ${t.submissionId} is null) or (${t.scope} = 'RECOVER_SUBMISSION' and ${t.submissionId} is not null)`)]);
export const resultReceipts = pgTable('task_result_receipts', {
  id: uuid('id').primaryKey().defaultRandom(), sessionId: uuid('session_id').notNull().unique().references(() => gameSessions.id),
  submissionId: uuid('submission_id').notNull().unique(), contractVersion: text('contract_version').notNull(), evidenceHash: text('evidence_hash').notNull(),
  receivedAt: at('received_at').notNull().defaultNow(), producerState: text('producer_state', { enum: ['completed', 'interrupted'] }).notNull(),
  terminationReason: text('termination_reason').$type<Envelope['terminationReason']>().notNull(), clockId: uuid('clock_id').notNull(),
  timeOriginUnixMs: doublePrecision('time_origin_unix_ms').notNull(), startedAtMs: doublePrecision('started_at_ms').notNull(),
  finishedAtMs: doublePrecision('finished_at_ms').notNull(), lastCheckpointAtMs: doublePrecision('last_checkpoint_at_ms').notNull(),
  device: jsonb('device').$type<Envelope['device']>().notNull(),
}, t => [check('receipt_timing_check', sql`${t.startedAtMs} >= 0 and ${t.finishedAtMs} >= ${t.startedAtMs} and ${t.finishedAtMs} = ${t.lastCheckpointAtMs}`)]);
export const rawEvents = pgTable('raw_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(), sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  trial: integer('trial_number').notNull(), stimulus: text('stimulus_type').$type<Trial['stimulus']>().notNull(), spawnedAtMs: doublePrecision('spawned_at_ms').notNull(),
  presentedAtMs: doublePrecision('presented_at_ms'), respondedAtMs: doublePrecision('responded_at_ms'), closedAtMs: doublePrecision('closed_at_ms').notNull(),
  result: text('producer_result').$type<Trial['result']>().notNull(), segment: integer('segment').$type<Trial['segment']>(),
  closureReason: text('closure_reason').$type<Trial['closureReason']>().notNull(), responseWindowCompleted: boolean('response_window_completed').notNull(),
  responseDevice: text('response_device').$type<Trial['responseDevice']>(), geometry: jsonb('geometry').$type<Trial['geometry']>().notNull(),
}, t => [unique().on(t.sessionId, t.trial), check('trial_check', sql`${t.trial} > 0 and ${t.spawnedAtMs} >= 0 and ${t.closedAtMs} >= ${t.spawnedAtMs} and (${t.presentedAtMs} is null or ${t.presentedAtMs} between ${t.spawnedAtMs} and ${t.closedAtMs}) and (${t.respondedAtMs} is null or (${t.presentedAtMs} is not null and ${t.respondedAtMs} between ${t.presentedAtMs} and ${t.closedAtMs}))`)]);
export const sessionIncidents = pgTable('task_session_incidents', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(), sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  sequence: integer('sequence').notNull(), type: text('type').$type<Incident['type']>().notNull(), clockId: uuid('clock_id'),
  atMs: doublePrecision('at_ms'), endedAtMs: doublePrecision('ended_at_ms'), recordedAtClient: text('recorded_at_client'),
  category: text('category').$type<Incident['category']>().notNull(),
}, t => [unique().on(t.sessionId, t.sequence), check('incident_sequence_check', sql`${t.sequence} > 0`)]);
export const calculationRuns = pgTable('indicator_calculation_runs', {
  id: uuid('id').primaryKey().defaultRandom(), sessionId: uuid('session_id').notNull().references(() => gameSessions.id),
  ruleVersionId: uuid('rule_version_id').notNull().references(() => indicatorRules.id), runNumber: integer('run_number').notNull(), evidenceHash: text('evidence_hash').notNull(),
  status: text('status', { enum: ['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED'] }).notNull().default('PENDING'),
  createdAt: at('created_at').notNull().defaultNow(), startedAt: at('started_at'), finishedAt: at('finished_at'), leaseUntil: at('lease_until'), leaseToken: uuid('lease_token'),
  attemptCount: integer('attempt_count').notNull().default(0), nextAttemptAt: at('next_attempt_at'), failureCode: text('failure_code'),
  evidenceDecisions: jsonb('evidence_decisions').notNull().default([]), summary: jsonb('summary').notNull().default({}),
}, t => [unique().on(t.sessionId, t.ruleVersionId, t.runNumber), index().on(t.status, t.nextAttemptAt),
  uniqueIndex('one_successful_evidence_rule').on(t.sessionId, t.ruleVersionId, t.evidenceHash).where(sql`${t.status} = 'SUCCEEDED'`)]);
export const calculatedIndicators = pgTable('calculated_indicators', {
  id: uuid('id').primaryKey().defaultRandom(), runId: uuid('run_id').notNull().references(() => calculationRuns.id),
  metricCode: text('metric_code').notNull(), scope: text('scope').notNull(), status: text('availability_status', { enum: ['CALCULATED', 'NOT_AVAILABLE'] }).notNull(),
  value: numeric('value', { precision: 20, scale: 6 }), unit: text('unit').notNull(), numerator: integer('numerator'), denominator: integer('denominator'), sampleSize: integer('sample_size').notNull(), unavailabilityReason: text('unavailability_reason'),
}, t => [unique().on(t.runId, t.metricCode, t.scope), check('indicator_availability_check', sql`(${t.status} = 'CALCULATED' and ${t.value} is not null and ${t.unavailabilityReason} is null) or (${t.status} = 'NOT_AVAILABLE' and ${t.value} is null and ${t.unavailabilityReason} is not null)`)]);
