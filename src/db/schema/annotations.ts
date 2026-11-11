import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { students } from './academic.js';
import { userAccounts } from './accounts.js';

// Solo texto vigente: no revisiones ni copias del contenido eliminado.
export const teacherAnnotations = pgTable('teacher_annotations', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'restrict' }),
  authorAccountId: uuid('author_account_id').notNull().references(() => userAccounts.id, { onDelete: 'restrict' }),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
}, (t) => [
  index('teacher_annotations_student_date_idx').on(t.studentId, t.createdAt.desc(), t.id.desc()),
  check('teacher_annotations_text_length', sql`char_length(${t.text}) between 1 and 1000`),
  check('teacher_annotations_text_nonblank', sql`${t.text} ~ '[^[:space:]   -     　﻿]'`),
]);
