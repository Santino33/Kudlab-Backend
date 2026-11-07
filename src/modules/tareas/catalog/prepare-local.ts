import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { assertLocalSynthetic } from '../../../config/local-synthetic.js';
import { tasks, taskPublishedVersions } from '../../../db/schema/tasks.js';
import { publishTg01 } from './publish.js';

export async function prepareLocalTg01() {
  assertLocalSynthetic();
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('publish-tg01', 0))`);
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, 'TG-01')).for('update');
    if (!task) throw new Error('TG01_CATALOG_REQUIRED');
    const latest = async () => (await tx.select().from(taskPublishedVersions).where(eq(taskPublishedVersions.taskId, 'TG-01')).orderBy(desc(taskPublishedVersions.version)).limit(1))[0];
    const before = await latest();
    const publishedVersionId = await publishTg01(tx);
    if ((await latest())?.id !== publishedVersionId) throw new Error('PUBLISHED_CONFIGURATION_CONFLICT');
    const changed = !task.isEnabled || before?.id !== publishedVersionId;
    if (changed) await tx.update(tasks).set({ isEnabled: true, revision: task.revision + 1 }).where(eq(tasks.id, task.id));
    return { publishedVersionId, changed };
  });
}
