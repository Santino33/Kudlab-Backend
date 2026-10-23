import { sql } from 'drizzle-orm';
import { pgTable, uuid, varchar, integer, boolean, index, check, customType } from 'drizzle-orm/pg-core';
import { userAccounts } from './accounts.js';

const studentCode = customType<{ data: string }>({ dataType: () => 'varchar(50) COLLATE "C"' });

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherId: uuid('teacher_id').notNull().references(() => userAccounts.id),
  name: varchar('name', { length: 50 }).notNull(),
  grade: varchar('grade', { length: 20 }).notNull(),
  schoolYear: integer('school_year').notNull(),
}, (t) => [
  index('groups_teacher_idx').on(t.teacherId),
  check('groups_name_check', sql`${t.name} <> '' and ${t.name} = btrim(${t.name})`),
  check('groups_grade_check', sql`${t.grade} <> '' and ${t.grade} = btrim(${t.grade})`),
]);

export const students = pgTable('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => groups.id),
  studentCode: studentCode('student_code').notNull().unique('students_code_unique'),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  isActive: boolean('is_active').notNull().default(false),
}, (t) => [
  index('students_group_idx').on(t.groupId),
  check('students_code_check', sql`${t.studentCode} <> '' and ${t.studentCode} = btrim(${t.studentCode})`),
  check('students_first_name_check', sql`${t.firstName} <> '' and ${t.firstName} = btrim(${t.firstName})`),
  check('students_last_name_check', sql`${t.lastName} <> '' and ${t.lastName} = btrim(${t.lastName})`),
]);
