import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, integer, smallint, numeric, timestamp, unique, check, index } from 'drizzle-orm/pg-core';
import { userAccounts } from './accounts.js';
import { students } from './academic.js';

// Notas escolares por estudiante, área, año del curso y periodo (D-01…D-06).
// La escala 1.0–5.0 con un decimal es una restricción del producto (D-02), no del tipo SQL.
export const academicNotes = pgTable('academic_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id),
  subject: varchar('subject', { length: 20 }).notNull(),
  schoolYear: integer('school_year').notNull(),
  term: smallint('term').notNull(),
  score: numeric('score', { precision: 2, scale: 1 }).notNull(),
  version: integer('version').notNull().default(1),
  authorId: uuid('author_id').notNull().references(() => userAccounts.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('academic_notes_slot_unique').on(t.studentId, t.subject, t.schoolYear, t.term),
  index('academic_notes_student_idx').on(t.studentId),
  check('academic_notes_subject_check', sql`${t.subject} in ('LENGUAJE', 'MATEMATICAS')`),
  check('academic_notes_term_check', sql`${t.term} between 1 and 4`),
  check('academic_notes_score_check', sql`${t.score} between 1.0 and 5.0`),
  check('academic_notes_version_check', sql`${t.version} >= 1`),
]);

// Solo inserciones: cada alta y cada cambio de valor añade una revisión (D-06). Sin borrado ni anulación.
export const academicNoteRevisions = pgTable('academic_note_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  noteId: uuid('note_id').notNull().references(() => academicNotes.id),
  version: integer('version').notNull(),
  score: numeric('score', { precision: 2, scale: 1 }).notNull(),
  authorId: uuid('author_id').notNull().references(() => userAccounts.id),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('academic_note_revisions_version_unique').on(t.noteId, t.version),
  check('academic_note_revisions_score_check', sql`${t.score} between 1.0 and 5.0`),
]);
