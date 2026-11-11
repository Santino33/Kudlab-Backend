import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { db } from '../../src/db/client.js';
import { tasks, taskPublishedVersions } from '../../src/db/schema/tasks.js';
import { indicatorRules, gameConfigurations } from '../../src/db/schema/game.js';
import { approveTg01, TG01_APPROVAL } from '../../src/modules/tareas/catalog/approve-tg01.js';
import { publishTg01 } from '../../src/modules/tareas/catalog/publish.js';
import { getTask } from '../../src/modules/tareas/catalog/catalog.service.js';
import { reset } from '../helpers.js';

describe('explicit TG-01 approval without synthetic methodology bypass', () => {
  beforeEach(async () => {
    await reset();
    await db.execute(sql`truncate tasks restart identity cascade`);
    await db.execute(sql.raw(readFileSync(new URL('../../src/db/migrations/0009_task_catalog.sql', import.meta.url), 'utf8').split('--> statement-breakpoint').at(-1)!));
  });
  it('publishes and approves the pinned rule once, preserving a disabled task and provenance', async () => {
    await publishTg01();
    expect((await getTask('TG-01'))?.unavailableReasons).toContain('METHODOLOGY_PENDING');
    const first = await approveTg01(), second = await approveTg01();
    expect(first.changed).toBe(true);
    expect(second).toEqual({ ...first, changed: false });
    expect(first.approvalReference).toBe(TG01_APPROVAL.reference);
    expect(await db.select().from(taskPublishedVersions)).toHaveLength(1);
    expect(await getTask('TG-01')).toMatchObject({ isEnabled: false, revision: 1, integrationReady: true, assignable: false, unavailableReasons: ['TASK_DISABLED'] });
    await db.update(tasks).set({ isEnabled: true }).where(eq(tasks.id, 'TG-01'));
    expect((await getTask('TG-01'))?.assignable).toBe(true);
    await publishTg01();
    expect((await db.select().from(indicatorRules))[0]).toMatchObject({ approvalStatus: 'APPROVED', approvalReference: first.approvalReference, approvedAt: first.approvedAt });
    await db.update(tasks).set({ isEnabled: false }).where(eq(tasks.id, 'TG-01'));
    await approveTg01();
    expect((await getTask('TG-01'))?.isEnabled).toBe(false);
  });
  it('preserves an existing approval reference', async () => {
    await publishTg01();
    const at = new Date('2026-11-01T12:00:00Z');
    await db.update(indicatorRules).set({ approvalStatus: 'APPROVED', approvedAt: at, approvalReference: 'synthetic-prior-decision' });
    expect(await approveTg01()).toMatchObject({ changed: false, approvedAt: at, approvalReference: 'synthetic-prior-decision' });
  });
  it('rejects a changed definition or superseding version instead of approving another rule', async () => {
    await publishTg01();
    const [rule] = await db.select().from(indicatorRules);
    await db.update(indicatorRules).set({ definition: { changed: true } }).where(eq(indicatorRules.id, rule!.id));
    await expect(approveTg01()).rejects.toThrow('RULE_VERSION_CONFLICT');
    expect((await db.select().from(indicatorRules))[0]!.approvalStatus).toBe('PROPOSED');
    await db.update(indicatorRules).set({ definition: rule!.definition }).where(eq(indicatorRules.id, rule!.id));
    await db.insert(taskPublishedVersions).values({ taskId: 'TG-01', version: 2 });
    await expect(approveTg01()).rejects.toThrow('PUBLISHED_CONFIGURATION_CONFLICT');
    expect((await db.select().from(indicatorRules))[0]!.approvalStatus).toBe('PROPOSED');
    expect(await db.select().from(gameConfigurations)).toHaveLength(1);
  });
});
