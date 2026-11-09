import { z } from 'zod';
import { INDICATOR_METRIC_CODES, INDICATOR_SCOPES, UNAVAILABILITY_REASONS } from './definitions.js';

const datetime = z.iso.datetime();
const count = z.number().int().nonnegative();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Estado metodológico vigente de la regla. `approvalReference` no se expone.
export const ruleRefSchema = z.strictObject({
  code: z.string().min(1), version: z.number().int().positive(),
  approval: z.strictObject({ current: z.enum(['PROPOSED', 'APPROVED']), approvedAt: datetime.nullable() }),
});

export const indicatorDefinitionSchema = z.strictObject({
  metricCode: z.enum(INDICATOR_METRIC_CODES), taskId: z.literal('TG-01'), label: z.string().min(1), description: z.string().min(1),
  calculation: z.string().min(1), unit: z.enum(['%', 'ms']), scopes: z.array(z.enum(INDICATOR_SCOPES)).min(1), inputs: z.string().min(1),
  unavailabilityReasons: z.array(z.enum(UNAVAILABILITY_REASONS)), exclusions: z.string().min(1), rule: ruleRefSchema.nullable(),
});
export const indicatorDefinitionsResponseSchema = z.strictObject({ items: z.array(indicatorDefinitionSchema) });

export const indicatorValueSchema = z.strictObject({
  metricCode: z.enum(INDICATOR_METRIC_CODES), scope: z.enum(INDICATOR_SCOPES), status: z.enum(['CALCULATED', 'NOT_AVAILABLE']),
  value: z.number().nullable(), unit: z.enum(['%', 'ms']), numerator: count.nullable(), denominator: count.nullable(), sampleSize: count,
  unavailabilityReason: z.enum(UNAVAILABILITY_REASONS).nullable(),
}).superRefine((v, ctx) => {
  // Ausencia ≠ cero: un valor solo existe cuando está calculado, y todo no disponible lleva motivo.
  if (v.status === 'CALCULATED' && (v.value === null || v.unavailabilityReason !== null)) ctx.addIssue({ code: 'custom', message: 'CALCULATED exige valor y sin motivo' });
  if (v.status === 'NOT_AVAILABLE' && (v.value !== null || v.unavailabilityReason === null)) ctx.addIssue({ code: 'custom', message: 'NOT_AVAILABLE exige motivo y sin valor' });
});

export const indicatorHistorySessionSchema = z.strictObject({
  sessionId: z.uuid(), taskId: z.literal('TG-01'), attemptNumber: z.number().int().min(1).max(10).nullable(), occurredAt: datetime,
  executionStatus: z.enum(['READY', 'RUNNING', 'COMPLETED', 'INTERRUPTED', 'EXPIRED', 'UNCONFIRMED']),
  processingStatus: z.enum(['NOT_RECEIVED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  configVersion: z.number().int().positive(), publishedVersionId: z.uuid(), incidentCount: count, recordedTrialCount: count,
  rule: ruleRefSchema.nullable(), approvalAtCalculation: z.enum(['APPROVED', 'NOT_ESTABLISHED']).nullable(),
  calculation: z.strictObject({ runId: z.uuid(), calculatedAt: datetime.nullable() }).nullable(),
  indicators: z.array(indicatorValueSchema), detailAccess: z.enum(['AVAILABLE', 'UNAVAILABLE']),
}).superRefine((v, ctx) => {
  if (v.calculation === null && v.indicators.length) ctx.addIssue({ code: 'custom', message: 'Sin ejecución vigente no hay indicadores' });
});
export const indicatorHistoryResponseSchema = z.strictObject({
  studentId: z.uuid(), items: z.array(indicatorHistorySessionSchema), nextCursor: z.string().min(1).nullable(),
});

export const indicatorHistoryQuerySchema = z.strictObject({
  taskId: z.literal('TG-01').optional(), metricCode: z.enum(INDICATOR_METRIC_CODES).optional(), scope: z.enum(INDICATOR_SCOPES).optional(),
  from: day.optional(), to: day.optional(), cursor: z.string().min(1).max(512).optional(),
  limit: z.string().regex(/^\d{1,3}$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
});

export type IndicatorDefinitionDto = z.infer<typeof indicatorDefinitionSchema>;
export type IndicatorValueDto = z.infer<typeof indicatorValueSchema>;
export type IndicatorHistorySession = z.infer<typeof indicatorHistorySessionSchema>;
export type IndicatorHistoryResponse = z.infer<typeof indicatorHistoryResponseSchema>;
export type IndicatorHistoryQuery = z.infer<typeof indicatorHistoryQuerySchema>;
export type RuleRef = z.infer<typeof ruleRefSchema>;
