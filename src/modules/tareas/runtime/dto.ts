import { z } from 'zod';
import { uuid, uuidV4, secret, contextSchema, receiptSchema, configSchema } from './contract.js';
export const requestInput = z.strictObject({ requestId: uuidV4 });
export const createInput = requestInput.extend({ taskId: z.literal('TG-01'), publishedVersionId: uuid, groupId: uuid,
  studentIds: z.array(uuid).min(1).max(1000).refine(ids => new Set(ids).size === ids.length),
  startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), maxAttempts: z.number().int().min(1).max(10) }).refine(v => Date.parse(v.startsAt) < Date.parse(v.endsAt));
const count = z.number().int().nonnegative(), datetime = z.iso.datetime();
export const assignmentSummarySchema = z.strictObject({ id: uuid, taskId: z.literal('TG-01'), title: z.string().min(1), publishedVersionId: uuid, configVersion: z.number().int().positive(), groupId: uuid,
  startsAt: datetime, endsAt: datetime, maxAttempts: z.number().int().min(1).max(10), status: z.enum(['OPEN', 'CANCELLED']), availability: z.enum(['FUTURE', 'CURRENT', 'EXPIRED', 'CANCELLED']), recipientCount: count, createdAt: datetime });
export const assignmentSchema = assignmentSummarySchema.extend({ recipients: z.array(z.strictObject({ id: uuid, studentId: uuid, studentDisplayName: z.string(), studentCode: z.string(), attemptsStarted: count, activeSessionId: uuid.nullable(), canLaunch: z.boolean(), unavailableReasons: z.array(z.enum(['TASK_UNAVAILABLE', 'OUTSIDE_WINDOW', 'ASSIGNMENT_CANCELLED', 'PARTICIPATION_BLOCKED', 'ATTEMPT_LIMIT', 'ACTIVE_SESSION', 'CONFIGURATION_UNSUPPORTED'])) })) });
export const grantSchema = z.strictObject({ sessionId: uuid, grantId: uuid, launchGrant: secret, expiresAt: datetime, runtimeOrigin: z.url() });
export const sessionSummarySchema = z.strictObject({ id: uuid, studentId: uuid, taskId: z.literal('TG-01'), assignmentId: uuid, attemptNumber: z.number().int().min(1).max(10).nullable(), launchMode: z.literal('SUPERVISED'),
  configVersion: z.number().int().positive(), gameBuildId: z.string(), executionStatus: contextSchema.shape.executionStatus, processingStatus: z.enum(['NOT_RECEIVED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  preparedAt: datetime, startedAtServer: datetime.nullable(), receivedAt: datetime.nullable(), incidentCount: count, recordedTrialCount: count });
export const indicatorSchema = z.strictObject({ metricCode: z.enum(['accuracy_pct', 'omission_rate_pct', 'commission_rate_pct', 'median_reaction_time_ms', 'rt_sd_ms', 'rt_cv_pct']),
  scope: z.enum(['SESSION', 'SEGMENT_1', 'SEGMENT_2', 'SEGMENT_3']), status: z.enum(['CALCULATED', 'NOT_AVAILABLE']), value: z.number().nullable(), unit: z.enum(['%', 'ms']),
  numerator: count.nullable(), denominator: count.nullable(), sampleSize: count, unavailabilityReason: z.enum(['NO_VALID_TARGETS', 'NO_VALID_DISTRACTORS', 'NO_VALID_RT', 'INSUFFICIENT_RT_FOR_VARIABILITY', 'SEGMENT_NOT_REACHED', 'TECHNICAL_EXCLUSION', 'ZERO_MEAN_RT', 'METHOD_NOT_APPROVED']).nullable() });
export const sessionDetailSchema = sessionSummarySchema.extend({ publishedVersionId: uuid, configurationHash: z.string().regex(/^[a-f0-9]{64}$/), configuration: configSchema,
  declaredState: z.enum(['completed', 'interrupted']).nullable(), terminationReason: z.string().nullable(), measuredDurationMs: z.number().nonnegative().nullable(), device: z.record(z.string(), z.unknown()).nullable(),
  receipt: receiptSchema.nullable(), calculation: z.strictObject({ runId: uuid, ruleCode: z.literal('TG01-DESCRIPTIVE-1'), ruleVersion: z.number().int().positive(), status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED']),
    calculatedAt: datetime.nullable(), summary: z.record(z.string(), z.unknown()), indicators: z.array(indicatorSchema) }).nullable() });
export const page = (schema: z.ZodType) => z.strictObject({ items: z.array(schema), nextCursor: z.string().nullable() });
