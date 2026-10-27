import { sql } from 'drizzle-orm';
import { pgTable, varchar, text, boolean, integer, uuid, timestamp, unique, check } from 'drizzle-orm/pg-core';

export const tasks = pgTable('tasks', {
  id: varchar('id', { length: 20 }).primaryKey(),
  title: varchar('title', { length: 100 }).notNull(),
  description: text('description').notNull(),
  purpose: text('purpose').notNull(),
  pedagogicalNotice: text('pedagogical_notice').notNull(),
  isEnabled: boolean('is_enabled').notNull().default(false),
  revision: integer('revision').notNull().default(1),
}, (t) => [
  check('tasks_code_check', sql`${t.id} ~ '^TG-[0-9]{2}$'`),
  check('tasks_revision_check', sql`${t.revision} > 0`),
  check('tasks_content_check', sql`btrim(${t.title}) <> '' and btrim(${t.description}) <> '' and btrim(${t.purpose}) <> '' and btrim(${t.pedagogicalNotice}) <> ''`),
]);

// Published references only; publication/configuration editing is outside this feature.
export const taskPublishedVersions = pgTable('task_published_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  taskId: varchar('task_id', { length: 20 }).notNull().references(() => tasks.id),
  version: integer('version').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique('task_published_versions_number_unique').on(t.taskId, t.version),
  unique('task_published_versions_task_unique').on(t.id, t.taskId),
  check('task_published_versions_number_check', sql`${t.version} > 0`),
]);
