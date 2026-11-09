import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, integer, date, timestamp, unique, index, check, foreignKey } from 'drizzle-orm/pg-core';
import { students } from './academic.js';
import { userAccounts } from './accounts.js';

export const consentRecords = pgTable('consent_records', {
  id: uuid('id').primaryKey(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  signedOn: date('signed_on').notNull(), receivedOn: date('received_on').notNull(),
  objectKey: text('object_key').notNull().unique(), mediaType: text('media_type').notNull(),
  byteSize: integer('byte_size').notNull(), sha256: text('sha256').notNull(),
}, t => [
  unique('consent_records_student_id_unique').on(t.studentId, t.id),
  check('consent_records_dates_check', sql`${t.signedOn} <= ${t.receivedOn}`),
  check('consent_records_size_check', sql`${t.byteSize} between 1 and 10485760`),
  check('consent_records_type_check', sql`${t.mediaType} in ('application/pdf','image/jpeg','image/png')`),
  check('consent_records_hash_check', sql`${t.sha256} ~ '^[a-f0-9]{64}$'`),
  check('consent_records_key_check', sql`${t.objectKey} = 'consents/' || ${t.id}::text`),
]);

export const consentEvents = pgTable('consent_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  version: integer('version').notNull(), recordId: uuid('record_id').notNull(),
  previousRecordId: uuid('previous_record_id'), type: text('type').notNull(),
  actorId: uuid('actor_id').notNull().references(() => userAccounts.id, { onDelete: 'restrict' }),
  actorName: text('actor_name').notNull(), occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  reason: text('reason'),
}, t => [
  unique('consent_events_student_version_unique').on(t.studentId, t.version),
  unique('consent_events_student_id_unique').on(t.studentId, t.id),
  index('consent_events_history_idx').on(t.studentId, t.version.desc()),
  foreignKey({ name: 'consent_events_record_fk', columns: [t.studentId, t.recordId], foreignColumns: [consentRecords.studentId, consentRecords.id] }).onDelete('restrict'),
  foreignKey({ name: 'consent_events_previous_fk', columns: [t.studentId, t.previousRecordId], foreignColumns: [consentRecords.studentId, consentRecords.id] }).onDelete('restrict'),
  check('consent_events_version_check', sql`${t.version} > 0`),
  check('consent_events_actor_check', sql`btrim(${t.actorName}) <> ''`),
  check('consent_events_shape_check', sql`(${t.type} = 'REGISTER' and ${t.previousRecordId} is null and ${t.reason} is null)
    or (${t.type} = 'REPLACE' and ${t.previousRecordId} is not null and ${t.previousRecordId} <> ${t.recordId} and ${t.reason} is null)
    or (${t.type} = 'REVOKE' and ${t.previousRecordId} is null and ${t.reason} is not null and btrim(${t.reason}) <> '' and length(${t.reason}) <= 2000)`),
]);

export const consentOperations = pgTable('consent_operations', {
  id: uuid('id').primaryKey().defaultRandom(), requestId: uuid('request_id').notNull(),
  actorId: uuid('actor_id').notNull().references(() => userAccounts.id, { onDelete: 'restrict' }),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  action: text('action').notNull(), expectedVersion: integer('expected_version').notNull(),
  fingerprint: text('fingerprint').notNull(), status: text('status').notNull().default('PENDING'),
  recordId: uuid('record_id').notNull(), objectKey: text('object_key'),
  signedOn: date('signed_on'), receivedOn: date('received_on'), mediaType: text('media_type'),
  byteSize: integer('byte_size'), sha256: text('sha256'), reason: text('reason'),
  eventId: uuid('event_id'), rejectionCode: text('rejection_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  unique('consent_operations_actor_request_unique').on(t.actorId, t.requestId),
  index('consent_operations_student_idx').on(t.studentId),
  foreignKey({ name: 'consent_operations_event_fk', columns: [t.studentId, t.eventId], foreignColumns: [consentEvents.studentId, consentEvents.id] }).onDelete('restrict'),
  check('consent_operations_version_check', sql`${t.expectedVersion} >= 0`),
  check('consent_operations_hash_check', sql`${t.fingerprint} ~ '^[a-f0-9]{64}$'`),
  check('consent_operations_state_check', sql`(${t.status} = 'PENDING' and ${t.eventId} is null and ${t.rejectionCode} is null)
    or (${t.status} = 'COMMITTED' and ${t.eventId} is not null and ${t.rejectionCode} is null)
    or (${t.status} = 'REJECTED' and ${t.eventId} is null and ${t.rejectionCode} is not null)`),
  check('consent_operations_payload_check', sql`(${t.action} = 'REGISTER' and ${t.objectKey} is not null and ${t.objectKey} = 'consents/' || ${t.recordId}::text
    and ${t.signedOn} is not null and ${t.receivedOn} is not null and ${t.signedOn} <= ${t.receivedOn}
    and ${t.mediaType} is not null and ${t.mediaType} in ('application/pdf','image/jpeg','image/png')
    and ${t.byteSize} is not null and ${t.byteSize} between 1 and 10485760
    and ${t.sha256} is not null and ${t.sha256} ~ '^[a-f0-9]{64}$' and ${t.reason} is null)
    or (${t.action} = 'REVOKE' and ${t.objectKey} is null and ${t.signedOn} is null and ${t.receivedOn} is null
    and ${t.mediaType} is null and ${t.byteSize} is null and ${t.sha256} is null
    and ${t.reason} is not null and btrim(${t.reason}) <> '' and length(${t.reason}) <= 2000)`),
]);
