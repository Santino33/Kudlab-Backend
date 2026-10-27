import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { tasks, taskPublishedVersions } from '../../../db/schema/tasks.js';
import { gameConfigurations, indicatorRules } from '../../../db/schema/game.js';
import { hash, PROFILE } from '../runtime/contract.js';
import { RULE } from '../../evolucion/tg01.js';

// Publication never enables the task or approves methodology/participation.
export async function publishTg01() {
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('publish-tg01', 0))`);
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, 'TG-01')).for('update');
    if (!task) throw new Error('TG01_CATALOG_REQUIRED');
    const [existing] = await tx.select().from(gameConfigurations).where(eq(gameConfigurations.gameBuildId, 'tg01-viewport-rebuild-2'));
    if (existing) {
      if (existing.configurationHash !== hash(PROFILE)) throw new Error('PUBLISHED_CONFIGURATION_CONFLICT');
      return existing.publishedVersionId;
    }
    const [rule] = await tx.insert(indicatorRules).values({ taskId: 'TG-01', code: RULE.code, version: RULE.version,
      definition: RULE, definitionHash: hash(RULE), approvalStatus: 'PROPOSED' }).onConflictDoNothing().returning();
    const [storedRule] = rule ? [rule] : await tx.select().from(indicatorRules).where(and(eq(indicatorRules.taskId, 'TG-01'), eq(indicatorRules.code, RULE.code), eq(indicatorRules.version, RULE.version)));
    if (!storedRule || storedRule.definitionHash !== hash(RULE)) throw new Error('RULE_VERSION_CONFLICT');
    const [max] = await tx.select({ n: sql<number>`coalesce(max(${taskPublishedVersions.version}), 0)::int` }).from(taskPublishedVersions).where(eq(taskPublishedVersions.taskId, 'TG-01'));
    const [version] = await tx.insert(taskPublishedVersions).values({ taskId: 'TG-01', version: max!.n + 1 }).returning();
    await tx.insert(gameConfigurations).values({ publishedVersionId: version!.id, contractVersion: '1.1', gameBuildId: 'tg01-viewport-rebuild-2',
      configuration: PROFILE, configurationHash: hash(PROFILE), ruleVersionId: storedRule.id });
    return version!.id;
  });
}
