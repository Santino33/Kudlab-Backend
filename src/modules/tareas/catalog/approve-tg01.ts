import { desc, eq } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { taskPublishedVersions } from '../../../db/schema/tasks.js';
import { gameConfigurations, indicatorRules } from '../../../db/schema/game.js';
import { hash } from '../runtime/contract.js';
import { RULE } from '../../evolucion/tg01.js';
import { publishTg01 } from './publish.js';

// Responsible's decision on 2026-11-11; pinned to the reviewed definition, not future RULE changes.
export const TG01_APPROVAL = {
  reference: 'KUDLAB-TG01-APPROVAL-20261111-01',
  definitionHash: '9006e2903ae0363d67ff7f9343b175f820118e0fe48995b9ee39caf5e652e469',
} as const;

export async function approveTg01() {
  if (RULE.code !== 'TG01-DESCRIPTIVE-1' || RULE.version !== 1 || hash(RULE) !== TG01_APPROVAL.definitionHash)
    throw new Error('APPROVAL_DEFINITION_CONFLICT');
  return db.transaction(async tx => {
    // Publication holds the task lock until approval commits; it never changes isEnabled.
    const publishedVersionId = await publishTg01(tx);
    const [latest] = await tx.select().from(taskPublishedVersions).where(eq(taskPublishedVersions.taskId, 'TG-01'))
      .orderBy(desc(taskPublishedVersions.version)).limit(1);
    if (latest?.id !== publishedVersionId) throw new Error('PUBLISHED_CONFIGURATION_CONFLICT');
    const [configuration] = await tx.select().from(gameConfigurations).where(eq(gameConfigurations.publishedVersionId, publishedVersionId));
    const [rule] = await tx.select().from(indicatorRules).where(eq(indicatorRules.id, configuration!.ruleVersionId)).for('update');
    if (!rule || rule.taskId !== 'TG-01' || rule.code !== 'TG01-DESCRIPTIVE-1' || rule.version !== 1 ||
      rule.definitionHash !== TG01_APPROVAL.definitionHash || hash(rule.definition) !== TG01_APPROVAL.definitionHash)
      throw new Error('APPROVAL_DEFINITION_CONFLICT');
    if (rule.approvalStatus === 'APPROVED') {
      if (!rule.approvedAt || !rule.approvalReference?.trim()) throw new Error('APPROVAL_REFERENCE_REQUIRED');
      return { publishedVersionId, ruleVersionId: rule.id, changed: false, approvedAt: rule.approvedAt, approvalReference: rule.approvalReference };
    }
    const approvedAt = new Date();
    await tx.update(indicatorRules).set({ approvalStatus: 'APPROVED', approvedAt, approvalReference: TG01_APPROVAL.reference })
      .where(eq(indicatorRules.id, rule.id));
    return { publishedVersionId, ruleVersionId: rule.id, changed: true, approvedAt, approvalReference: TG01_APPROVAL.reference };
  });
}
