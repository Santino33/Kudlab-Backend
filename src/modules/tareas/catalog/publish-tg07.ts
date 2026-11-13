import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { tasks, taskPublishedVersions } from '../../../db/schema/tasks.js';
import { gameConfigurations, indicatorRules } from '../../../db/schema/game.js';
import { hash } from '../runtime/contract.js';
import { BUILD_ID, CONTRACT_VERSION, profile } from '../runtime/tg07/contract.js';
import { RULE } from '../../evolucion/tg07.js';
import type { AcademicTransaction } from '../../academico/shared/academic-auth.js';

// Explicit preparation preserves availability and methodological approval on repeated runs.
export async function publishTg07(transaction?: AcademicTransaction) {
  const publish = async (tx: AcademicTransaction) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('publish-tg07', 0))`);
    const content = { title: 'Kud Dice', description: 'Observa, escucha y reproduce secuencias de cuatro tambores.',
      purpose: 'Observación pedagógica descriptiva de respuestas por longitud de secuencia.',
      pedagogicalNotice: 'Resultados descriptivos de esta ejecución; no constituyen diagnóstico, baremo ni span estandarizado.' };
    const [task] = await tx.select().from(tasks).where(eq(tasks.id, 'TG-07')).for('update');
    if (task && Object.entries(content).some(([key, value]) => task[key as keyof typeof content] !== value)) throw new Error('TG07_CATALOG_CONFLICT');
    if (!task) await tx.insert(tasks).values({ id: 'TG-07', ...content, isEnabled: false });
    const config = profile();
    const versions = await tx.select({ version: taskPublishedVersions, config: gameConfigurations }).from(taskPublishedVersions)
      .leftJoin(gameConfigurations, eq(gameConfigurations.publishedVersionId, taskPublishedVersions.id)).where(eq(taskPublishedVersions.taskId, 'TG-07'));
    if (versions.length) {
      const existing = versions[0]!;
      if (versions.length !== 1 || !existing.config || existing.config.gameBuildId !== BUILD_ID || existing.config.contractVersion !== CONTRACT_VERSION ||
        existing.config.configurationHash !== hash(config) || hash(existing.config.configuration) !== hash(config)) throw new Error('PUBLISHED_CONFIGURATION_CONFLICT');
      const [rule] = await tx.select().from(indicatorRules).where(eq(indicatorRules.id, existing.config.ruleVersionId));
      if (!rule || rule.taskId !== 'TG-07' || rule.code !== RULE.code || rule.version !== RULE.version || rule.definitionHash !== hash(RULE) || hash(rule.definition) !== hash(RULE)) throw new Error('RULE_VERSION_CONFLICT');
      return existing.version.id;
    }
    await tx.insert(indicatorRules).values({ taskId: 'TG-07', code: RULE.code, version: RULE.version, definition: RULE, definitionHash: hash(RULE), approvalStatus: 'PROPOSED' }).onConflictDoNothing();
    const [rule] = await tx.select().from(indicatorRules).where(and(eq(indicatorRules.taskId, 'TG-07'), eq(indicatorRules.code, RULE.code), eq(indicatorRules.version, RULE.version)));
    if (!rule || rule.definitionHash !== hash(RULE) || hash(rule.definition) !== hash(RULE)) throw new Error('RULE_VERSION_CONFLICT');
    const [version] = await tx.insert(taskPublishedVersions).values({ taskId: 'TG-07', version: 1 }).returning();
    await tx.insert(gameConfigurations).values({ publishedVersionId: version!.id, contractVersion: CONTRACT_VERSION, gameBuildId: BUILD_ID,
      configuration: config, configurationHash: hash(config), ruleVersionId: rule.id });
    return version!.id;
  };
  return transaction ? publish(transaction) : db.transaction(publish);
}
