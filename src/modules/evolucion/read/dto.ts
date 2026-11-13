import { z } from 'zod';
import { INDICATOR_METRIC_CODES, INDICATOR_SCOPES, UNAVAILABILITY_REASONS } from './definitions.js';
import { MENTALISTA_METRICS, MENTALISTA_SCOPES, MENTALISTA_REASONS } from './mentalista-definitions.js';
import { KUD_DICE_METRICS, KUD_DICE_SCOPES, KUD_DICE_REASONS, KUD_DICE_LENGTH_METRICS } from './kud-dice-definitions.js';
import { taskIdSchema } from '../../tareas/runtime/profiles.js';
import { configSchema as mentalistaConfig, deviceSchema as mentalistaDevice, preparationSchema } from '../../tareas/runtime/tg03/contract.js';
const metrics = [...new Set([...INDICATOR_METRIC_CODES, ...MENTALISTA_METRICS, ...KUD_DICE_METRICS])];
const scopes = [...new Set([...INDICATOR_SCOPES, ...MENTALISTA_SCOPES, ...KUD_DICE_SCOPES])];
const reasons = [...new Set([...UNAVAILABILITY_REASONS, ...MENTALISTA_REASONS, ...KUD_DICE_REASONS])];

const datetime = z.iso.datetime();
const count = z.number().int().nonnegative();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Estado metodológico vigente de la regla. `approvalReference` no se expone.
export const ruleRefSchema = z.strictObject({
  code: z.string().min(1), version: z.number().int().positive(),
  approval: z.strictObject({ current: z.enum(['PROPOSED', 'APPROVED']), approvedAt: datetime.nullable() }),
});

export const indicatorDefinitionSchema = z.strictObject({
  metricCode: z.enum(metrics), taskId: taskIdSchema, label: z.string().min(1), description: z.string().min(1),
  calculation: z.string().min(1), unit: z.enum(['%', 'ms', 'points', 'count']), scopes: z.array(z.enum(scopes)).min(1), inputs: z.string().min(1),
  unavailabilityReasons: z.array(z.enum(reasons)), exclusions: z.string().min(1), rule: ruleRefSchema.nullable(),
});
export const indicatorDefinitionsResponseSchema = z.strictObject({ items: z.array(indicatorDefinitionSchema) });

export const indicatorValueSchema = z.strictObject({
  metricCode: z.enum(metrics), scope: z.enum(scopes), status: z.enum(['CALCULATED', 'NOT_AVAILABLE']),
  value: z.number().nullable(), unit: z.enum(['%', 'ms', 'points', 'count']), numerator: count.nullable(), denominator: count.nullable(), sampleSize: count,
  unavailabilityReason: z.enum(reasons).nullable(),
}).superRefine((v, ctx) => {
  // Ausencia ≠ cero: un valor solo existe cuando está calculado, y todo no disponible lleva motivo.
  if (v.status === 'CALCULATED' && (v.value === null || v.unavailabilityReason !== null)) ctx.addIssue({ code: 'custom', message: 'CALCULATED exige valor y sin motivo' });
  if (v.status === 'NOT_AVAILABLE' && (v.value !== null || v.unavailabilityReason === null)) ctx.addIssue({ code: 'custom', message: 'NOT_AVAILABLE exige motivo y sin valor' });
});

export const indicatorHistorySessionSchema = z.strictObject({
  sessionId: z.uuid(), taskId: taskIdSchema, attemptNumber: z.number().int().min(1).max(10).nullable(), occurredAt: datetime,
  executionStatus: z.enum(['READY', 'RUNNING', 'COMPLETED', 'INTERRUPTED', 'EXPIRED', 'UNCONFIRMED']),
  processingStatus: z.enum(['NOT_RECEIVED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  configVersion: z.number().int().positive(), publishedVersionId: z.uuid(), incidentCount: count, recordedTrialCount: count,
  rule: ruleRefSchema.nullable(), approvalAtCalculation: z.enum(['APPROVED', 'NOT_ESTABLISHED']).nullable(),
  calculation: z.strictObject({ runId: z.uuid(), calculatedAt: datetime.nullable() }).nullable(),
  indicators: z.array(indicatorValueSchema), detailAccess: z.enum(['AVAILABLE', 'UNAVAILABLE']),
  mentalista: z.strictObject({ configuration: mentalistaConfig, configurationHash: z.string().regex(/^[a-f0-9]{64}$/), gameBuildId: z.literal('tg03-mentalista-1'), device: mentalistaDevice.nullable(), preparation: preparationSchema.nullable() }).optional(),
}).superRefine((v, ctx) => {
  if (v.calculation === null && v.indicators.length) ctx.addIssue({ code: 'custom', message: 'Sin ejecución vigente no hay indicadores' });
  if ((v.taskId === 'TG-03') !== (v.mentalista !== undefined) || v.indicators.some(i => !validFilter(v.taskId, i.metricCode, i.scope))) ctx.addIssue({ code: 'custom', message: 'Indicadores incompatibles con tarea' });
});
export const indicatorHistoryResponseSchema = z.strictObject({
  studentId: z.uuid(), items: z.array(indicatorHistorySessionSchema), nextCursor: z.string().min(1).nullable(),
});

export const indicatorHistoryQuerySchema = z.strictObject({
  taskId: taskIdSchema.optional(), metricCode: z.enum(metrics).optional(), scope: z.enum(scopes).optional(),
  from: day.optional(), to: day.optional(), cursor: z.string().min(1).max(512).optional(),
  limit: z.string().regex(/^\d{1,3}$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
}).refine(q => validFilter(q.taskId ?? 'TG-01', q.metricCode, q.scope), 'Filtro incompatible con tarea');

function validFilter(task: z.infer<typeof taskIdSchema>, metric?: string, scope?: string) {
  const allowedMetrics: readonly string[] = task === 'TG-07' ? KUD_DICE_METRICS : task === 'TG-03' ? MENTALISTA_METRICS : INDICATOR_METRIC_CODES;
  const allowedScopes: readonly string[] = task === 'TG-07' ? KUD_DICE_SCOPES : task === 'TG-03' ? MENTALISTA_SCOPES : INDICATOR_SCOPES;
  return (!metric || allowedMetrics.includes(metric)) && (!scope || allowedScopes.includes(scope)) &&
    !(task === 'TG-03' && metric && MENTALISTA_METRICS.indexOf(metric as typeof MENTALISTA_METRICS[number]) >= 7 && scope && scope !== 'SESSION') &&
    !(task === 'TG-07' && metric && !KUD_DICE_LENGTH_METRICS.includes(metric) && scope && scope !== 'SESSION');
}

export type IndicatorDefinitionDto = z.infer<typeof indicatorDefinitionSchema>;
export type IndicatorValueDto = z.infer<typeof indicatorValueSchema>;
export type IndicatorHistorySession = z.infer<typeof indicatorHistorySessionSchema>;
export type IndicatorHistoryResponse = z.infer<typeof indicatorHistoryResponseSchema>;
export type IndicatorHistoryQuery = z.infer<typeof indicatorHistoryQuerySchema>;
export type RuleRef = z.infer<typeof ruleRefSchema>;
