import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { tasks, taskPublishedVersions } from '../../../db/schema/tasks.js';
import { gameConfigurations, indicatorRules } from '../../../db/schema/game.js';
import { compatible, hash } from '../runtime/contract.js';
import { RULE } from '../../evolucion/tg01.js';
import { participationProvider, type GameDependencies } from '../../academico/shared/participation.js';

const catalogIds = ['TG-01'];
export type UnavailableReason = 'INTEGRATION_PENDING' | 'CONFIGURATION_UNPUBLISHED' | 'TASK_DISABLED' | 'CONFIGURATION_UNSUPPORTED' | 'METHODOLOGY_PENDING';
type PublishedVersion = { id: string; version: number } | null;

export function taskReadiness(isEnabled: boolean, integrationReady: boolean, publishedVersion: PublishedVersion) {
  const unavailableReasons: UnavailableReason[] = [];
  if (!integrationReady) unavailableReasons.push('INTEGRATION_PENDING');
  if (!publishedVersion) unavailableReasons.push('CONFIGURATION_UNPUBLISHED');
  if (!isEnabled) unavailableReasons.push('TASK_DISABLED');
  return { assignable: unavailableReasons.length === 0, unavailableReasons };
}

async function catalogRows(id?: string) {
  return db.selectDistinctOn([tasks.id], { task: tasks, publishedVersion: {
    id: taskPublishedVersions.id, version: taskPublishedVersions.version,
  }, configuration: gameConfigurations, rule: indicatorRules }).from(tasks).leftJoin(taskPublishedVersions, eq(taskPublishedVersions.taskId, tasks.id))
    .leftJoin(gameConfigurations, eq(gameConfigurations.publishedVersionId, taskPublishedVersions.id))
    .leftJoin(indicatorRules, eq(indicatorRules.id, gameConfigurations.ruleVersionId))
    .where(id ? eq(tasks.id, id) : inArray(tasks.id, catalogIds))
    .orderBy(tasks.id, desc(taskPublishedVersions.version));
}

function summary({ task, publishedVersion, configuration, rule }: Awaited<ReturnType<typeof catalogRows>>[number], deps: GameDependencies) {
  participationProvider(deps);
  const integrationReady = Boolean(configuration && compatible(configuration.contractVersion, configuration.gameBuildId, configuration.configuration) && hash(configuration.configuration) === configuration.configurationHash);
  const readiness = taskReadiness(task.isEnabled, integrationReady, publishedVersion);
  if (publishedVersion && !integrationReady) readiness.unavailableReasons.push('CONFIGURATION_UNSUPPORTED');
  if (rule && (hash(rule.definition) !== hash(RULE) || hash(rule.definition) !== rule.definitionHash || rule.approvalStatus !== 'APPROVED' && !deps.testParticipation)) readiness.unavailableReasons.push('METHODOLOGY_PENDING');
  return { id: task.id, title: task.title, description: task.description, isEnabled: task.isEnabled,
    integrationReady, publishedVersion, assignable: readiness.unavailableReasons.length === 0, unavailableReasons: readiness.unavailableReasons, revision: task.revision };
}

export async function listTasks(deps: GameDependencies = {}) {
  return { items: (await catalogRows()).map(row => summary(row, deps)) };
}

export async function getTask(id: string, deps: GameDependencies = {}) {
  if (!catalogIds.includes(id)) return null;
  const [row] = await catalogRows(id);
  return row ? { ...summary(row, deps), purpose: row.task.purpose, pedagogicalNotice: row.task.pedagogicalNotice } : null;
}
