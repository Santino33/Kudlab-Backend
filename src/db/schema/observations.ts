import { sql } from 'drizzle-orm';
import { pgTable, uuid, integer, text, date, timestamp, unique, index, check } from 'drizzle-orm/pg-core';
import { students } from './academic.js';
import { userAccounts } from './accounts.js';

export const teacherObservations = pgTable('teacher_observations', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  authorId: uuid('author_id').notNull().references(() => userAccounts.id, { onDelete: 'restrict' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  version: integer('version').notNull().default(1),
}, t => [
  index('teacher_observations_history_idx').on(t.studentId, t.createdAt.desc(), t.id.desc()),
  check('teacher_observations_version_check', sql`${t.version} > 0`),
]);

export const teacherObservationRevisions = pgTable('teacher_observation_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  observationId: uuid('observation_id').notNull().references(() => teacherObservations.id, { onDelete: 'restrict' }),
  version: integer('version').notNull(),
  behavior: text('behavior').notNull(),
  frequency: text('frequency').notNull(),
  area: text('area'),
  observedOn: date('observed_on').notNull(),
  schoolYear: integer('school_year').notNull(),
  term: integer('term').notNull(),
  actorId: uuid('actor_id').notNull().references(() => userAccounts.id, { onDelete: 'restrict' }),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  requestId: uuid('request_id').notNull(),
  fingerprint: text('fingerprint').notNull(),
}, t => [
  unique('teacher_observation_revisions_version_unique').on(t.observationId, t.version),
  unique('teacher_observation_revisions_request_unique').on(t.actorId, t.requestId),
  check('teacher_observation_revisions_version_check', sql`${t.version} > 0`),
  check('teacher_observation_revisions_behavior_check', sql`${t.behavior} in ('ATTENTION','FOLLOWING_INSTRUCTIONS')`),
  check('teacher_observation_revisions_frequency_check', sql`${t.frequency} in ('NEVER','SOMETIMES','ALMOST_ALWAYS','ALWAYS')`),
  check('teacher_observation_revisions_area_check', sql`${t.area} is null or ${t.area} in ('LANGUAGE_READING','MATHEMATICS')`),
  check('teacher_observation_revisions_term_check', sql`${t.term} between 1 and 4`),
  check('teacher_observation_revisions_hash_check', sql`${t.fingerprint} ~ '^[a-f0-9]{64}$'`),
]);
