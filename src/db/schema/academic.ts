import { sql } from 'drizzle-orm';
import { boolean, check, integer, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { userAccounts } from './accounts.js';

// Scope data belongs to Académico. This minimal model does not activate
// students or manage consent; those operations require their own contract.
export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherAccountId: uuid('teacher_account_id').notNull().references(() => userAccounts.id),
  name: varchar('name', { length: 50 }).notNull(),
  grade: varchar('grade', { length: 20 }).notNull(),
  schoolYear: integer('school_year').notNull(),
}, (t) => [check('group_year_positive', sql`${t.schoolYear} > 0`)]);

export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id),
  studentCode: varchar('student_code', { length: 50 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(false),
}, (t) => [
  check('student_first_name_nonempty', sql`length(btrim(${t.firstName})) > 0`),
  check('student_last_name_nonempty', sql`length(btrim(${t.lastName})) > 0`),
]);
