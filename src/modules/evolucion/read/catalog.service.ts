import { and, eq } from 'drizzle-orm';
import { db } from '../../../db/client.js';
import { indicatorRules } from '../../../db/schema/game.js';
import { hash } from '../../tareas/runtime/contract.js';
import { RULE } from '../tg01.js';
import { INDICATOR_DEFINITIONS } from './definitions.js';
import type { IndicatorDefinitionDto, RuleRef } from './dto.js';

type RuleRow = { approvalStatus: 'PROPOSED' | 'APPROVED'; approvedAt: Date | null } | undefined;

// Une las definiciones con el estado metodológico vigente. Sin fila de regla publicada: `rule: null` («regla aún no publicada»).
// `approvalReference` no se expone.
export function buildIndicatorCatalog(row: RuleRow): IndicatorDefinitionDto[] {
  const rule: RuleRef | null = row ? { code: RULE.code, version: RULE.version, approval: { current: row.approvalStatus, approvedAt: row.approvedAt?.toISOString() ?? null } } : null;
  return INDICATOR_DEFINITIONS.map(d => ({ ...d, scopes: [...d.scopes], unavailabilityReasons: [...d.unavailabilityReasons], rule }));
}

export async function readIndicatorCatalog(executor: Pick<typeof db, 'select'> = db) {
  // Solo la fila cuya definición coincide con la regla que el código calcula (código, versión y hash).
  const [row] = await executor.select({ approvalStatus: indicatorRules.approvalStatus, approvedAt: indicatorRules.approvedAt }).from(indicatorRules)
    .where(and(eq(indicatorRules.taskId, 'TG-01'), eq(indicatorRules.code, RULE.code), eq(indicatorRules.version, RULE.version), eq(indicatorRules.definitionHash, hash(RULE))));
  return { items: buildIndicatorCatalog(row) };
}
