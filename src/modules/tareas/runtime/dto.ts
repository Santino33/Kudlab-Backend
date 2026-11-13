import { z } from 'zod';
import { uuid, uuidV4, secret, contextSchema, receiptSchema, configSchema } from './contract.js';
import { taskIdSchema } from './profiles.js';
import { configSchema as mentalistaConfig, preparationSchema } from './tg03/contract.js';
import { configSchema as kudDiceConfig, preparationSchema as kudDicePreparation, envelopeSchema as kudDiceEnvelope } from './tg07/contract.js';
import { KUD_DICE_METRICS, KUD_DICE_SCOPES, KUD_DICE_REASONS } from '../../evolucion/read/kud-dice-definitions.js';
export const requestInput = z.strictObject({ requestId: uuidV4 });
export const createInput = requestInput.extend({ taskId: taskIdSchema, publishedVersionId: uuid, groupId: uuid,
  studentIds: z.array(uuid).min(1).max(1000).refine(ids => new Set(ids).size === ids.length),
  startsAt: z.iso.datetime(), endsAt: z.iso.datetime(), maxAttempts: z.number().int().min(1).max(10) }).refine(v => Date.parse(v.startsAt) < Date.parse(v.endsAt));
const count = z.number().int().nonnegative(), datetime = z.iso.datetime();
export const assignmentSummarySchema = z.strictObject({ id: uuid, taskId: taskIdSchema, title: z.string().min(1), publishedVersionId: uuid, configVersion: z.number().int().positive(), groupId: uuid,
  startsAt: datetime, endsAt: datetime, maxAttempts: z.number().int().min(1).max(10), status: z.enum(['OPEN', 'CANCELLED']), availability: z.enum(['FUTURE', 'CURRENT', 'EXPIRED', 'CANCELLED']), recipientCount: count, createdAt: datetime });
export const assignmentSchema = assignmentSummarySchema.extend({ recipients: z.array(z.strictObject({ id: uuid, studentId: uuid, studentDisplayName: z.string(), studentCode: z.string(), attemptsStarted: count, activeSessionId: uuid.nullable(), canLaunch: z.boolean(), unavailableReasons: z.array(z.enum(['TASK_UNAVAILABLE', 'OUTSIDE_WINDOW', 'ASSIGNMENT_CANCELLED', 'PARTICIPATION_BLOCKED', 'ATTEMPT_LIMIT', 'ACTIVE_SESSION', 'CONFIGURATION_UNSUPPORTED'])) })) });
export const studentAssignmentSchema = assignmentSummarySchema.extend({ studentId: uuid, recipientId: uuid, attemptsStarted: count });
export const grantSchema = z.strictObject({ sessionId: uuid, grantId: uuid, launchGrant: secret, expiresAt: datetime, runtimeOrigin: z.url() });
export const sessionSummarySchema = z.strictObject({ id: uuid, studentId: uuid, taskId: taskIdSchema, assignmentId: uuid, attemptNumber: z.number().int().min(1).max(10).nullable(), launchMode: z.enum(['SUPERVISED', 'CODE']),
  configVersion: z.number().int().positive(), gameBuildId: z.string(), executionStatus: contextSchema.shape.executionStatus, processingStatus: z.enum(['NOT_RECEIVED', 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']),
  preparedAt: datetime, startedAtServer: datetime.nullable(), receivedAt: datetime.nullable(), incidentCount: count, recordedTrialCount: count });
export const indicatorSchema = z.strictObject({ metricCode: z.enum(['accuracy_pct', 'omission_rate_pct', 'commission_rate_pct', 'median_reaction_time_ms', 'rt_sd_ms', 'rt_cv_pct']),
  scope: z.enum(['SESSION', 'SEGMENT_1', 'SEGMENT_2', 'SEGMENT_3']), status: z.enum(['CALCULATED', 'NOT_AVAILABLE']), value: z.number().nullable(), unit: z.enum(['%', 'ms']),
  numerator: count.nullable(), denominator: count.nullable(), sampleSize: count, unavailabilityReason: z.enum(['NO_VALID_TARGETS', 'NO_VALID_DISTRACTORS', 'NO_VALID_RT', 'INSUFFICIENT_RT_FOR_VARIABILITY', 'SEGMENT_NOT_REACHED', 'TECHNICAL_EXCLUSION', 'ZERO_MEAN_RT', 'METHOD_NOT_APPROVED']).nullable() });
const tg01Detail = sessionSummarySchema.extend({ taskId: z.literal('TG-01'), publishedVersionId: uuid, configurationHash: z.string().regex(/^[a-f0-9]{64}$/), configuration: configSchema,
  declaredState: z.enum(['completed', 'interrupted']).nullable(), terminationReason: z.string().nullable(), measuredDurationMs: z.number().nonnegative().nullable(), device: z.record(z.string(), z.unknown()).nullable(),
  receipt: receiptSchema.nullable(), calculation: z.strictObject({ runId: uuid, ruleCode: z.literal('TG01-DESCRIPTIVE-1'), ruleVersion: z.number().int().positive(), status: z.enum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED']),
    calculatedAt: datetime.nullable(), summary: z.record(z.string(), z.unknown()), indicators: z.array(indicatorSchema) }).nullable() });
export const mentalistaIndicatorSchema = indicatorSchema.extend({
  metricCode: z.enum(['accuracy_pct', 'error_rate_pct', 'omission_rate_pct', 'median_reaction_time_ms', 'mean_reaction_time_ms', 'rt_sd_ms', 'rt_cv_pct', 'delta_precision_pts', 'delta_precision_rel_pct', 'chance_level_pct', 'selection_position_1_count', 'selection_position_2_count', 'selection_position_3_count', 'selection_position_4_count']),
  scope: z.enum(['SESSION', 'LOAD_1', 'LOAD_2', 'LOAD_3', 'LOAD_4']), unit: z.enum(['%', 'ms', 'points', 'count']),
  unavailabilityReason: z.enum(['NO_VALID_ITEMS', 'INSUFFICIENT_RT_DATA', 'INSUFFICIENT_LOAD_DATA', 'ZERO_BASELINE', 'LOAD_NOT_REACHED', 'METHOD_NOT_APPROVED', 'TECHNICAL_EXCLUSION', 'ZERO_MEAN_RT']).nullable(),
});
export const mentalistaDetailSchema = tg01Detail.extend({ taskId: z.literal('TG-03'), configuration: mentalistaConfig,
  preparation: preparationSchema.nullable(), extraResponseCount: count,
  calculation: tg01Detail.shape.calculation.unwrap().extend({ ruleCode: z.literal('TG03-DESCRIPTIVE-1'), indicators: z.array(mentalistaIndicatorSchema) }).nullable(),
});
export const kudDiceIndicatorSchema = indicatorSchema.extend({
  metricCode: z.enum(KUD_DICE_METRICS), scope: z.enum(KUD_DICE_SCOPES), unit: z.enum(['%', 'ms', 'points', 'count']),
  unavailabilityReason: z.enum(KUD_DICE_REASONS).nullable(),
});
export const kudDiceDetailSchema = tg01Detail.extend({ taskId: z.literal('TG-07'), configuration: kudDiceConfig,
  preparation: kudDicePreparation.nullable(), audio: kudDiceEnvelope.shape.audio.nullable(), phaseReached: kudDiceEnvelope.shape.phaseReached.nullable(),
  calculation: tg01Detail.shape.calculation.unwrap().extend({ ruleCode: z.literal('TG07-DESCRIPTIVE-1'), indicators: z.array(kudDiceIndicatorSchema) }).nullable(),
});
export const sessionDetailSchema = z.discriminatedUnion('taskId', [tg01Detail, mentalistaDetailSchema, kudDiceDetailSchema]);
export const page = (schema: z.ZodType) => z.strictObject({ items: z.array(schema), nextCursor: z.string().nullable() });
export const codeScope = z.enum(['PLAY_AND_SUBMIT', 'SUBMIT_ONLY']);
export const codeMetadataSchema = z.strictObject({ id: uuid, recipientId: uuid, scope: codeScope, sessionId: uuid.nullable(), status: z.enum(['ACTIVE', 'REVOKED', 'REPLACED', 'EXPIRED']), createdAt: datetime, expiresAt: datetime, lastClaimedAt: datetime.nullable(), canReveal: z.boolean(), unavailableReasons: z.array(z.string()) });
export const codeBatchInput = requestInput.extend({ recipientIds: z.array(uuid).min(1).max(100).refine(ids => new Set(ids).size === ids.length) });
export const codeBatchSchema = z.strictObject({ items: z.array(codeMetadataSchema), createdCount: count, reusedCount: count });
export const codeRevealSchema = z.strictObject({ codeId: uuid, code: z.string().regex(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/), expiresAt: datetime, scope: codeScope });
export const codeClaimInput = z.strictObject({ code: z.string().max(64).regex(/^[A-Za-z2-9 -]+$/), claimId: uuidV4, runtimeSecret: secret });
export const codeRecoverInput = codeClaimInput.extend({ sessionId: uuid, submissionId: uuidV4 });
export const recoveryCodeInput = requestInput.extend({ reconcileReceipt: z.boolean().optional() });
