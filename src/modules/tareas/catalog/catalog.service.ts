import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { tasks, taskPublishedVersions } from '../../../db/schema/tasks.js';

const catalogIds = ['TG-01'];
export type UnavailableReason = 'INTEGRATION_PENDING' | 'CONFIGURATION_UNPUBLISHED' | 'TASK_DISABLED';
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
  } }).from(tasks).leftJoin(taskPublishedVersions, eq(taskPublishedVersions.taskId, tasks.id))
    .where(id ? eq(tasks.id, id) : inArray(tasks.id, catalogIds))
    .orderBy(tasks.id, desc(taskPublishedVersions.version));
}

function summary({ task, publishedVersion }: Awaited<ReturnType<typeof catalogRows>>[number]) {
  // No game integration has been received/validated. A catalog row is not evidence of integration.
  const integrationReady = false;
  return { id: task.id, title: task.title, description: task.description, isEnabled: task.isEnabled,
    integrationReady, publishedVersion, ...taskReadiness(task.isEnabled, integrationReady, publishedVersion), revision: task.revision };
}

export async function listTasks() {
  return { items: (await catalogRows()).map(summary) };
}

export async function getTask(id: string) {
  if (!catalogIds.includes(id)) return null;
  const [row] = await catalogRows(id);
  return row ? { ...summary(row), purpose: row.task.purpose, pedagogicalNotice: row.task.pedagogicalNotice } : null;
}
