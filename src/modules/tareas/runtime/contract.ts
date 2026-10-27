import { z } from 'zod';
import { createHash } from 'node:crypto';

export const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const uuidV4 = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const secret = z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/);
const time = z.number().finite().nonnegative();
export const legacyConfigSchema = z.strictObject({
  durationMs: z.literal(120000), segmentBoundariesMs: z.tuple([z.literal(0), z.literal(40000), z.literal(80000), z.literal(120000)]),
  logicalWidth: z.literal(960), logicalHeight: z.literal(600), lanes: z.literal(6), fallSpeedUnitsPerSecond: z.literal(210),
  spawnIntervalMs: z.strictObject({ min: z.literal(1100), max: z.literal(1800) }), starProbability: z.literal(0.7),
  stimulusSizeUnits: z.strictObject({ min: z.literal(75), max: z.literal(105) }), minimumDistanceUnits: z.literal(180), positionAttempts: z.literal(30),
  presentationRule: z.literal('FULLY_VISIBLE'), maxFrameGapMs: z.literal(250), minimumStageScale: z.literal(0.6), inputProfile: z.literal('POINTER_V1'),
});
export const viewportConfigSchema = legacyConfigSchema.omit({ logicalWidth: true, logicalHeight: true, lanes: true }).extend({
  layoutRule: z.literal('VIEWPORT_FIT_V2'), referenceWidthUnits: z.literal(480), minimumLaneWidthUnits: z.literal(120), maximumLanes: z.literal(6),
});
export const configSchema = z.union([legacyConfigSchema, viewportConfigSchema]);
export type Config = z.infer<typeof configSchema>;
export const PROFILE: Config = {
  durationMs: 120000, segmentBoundariesMs: [0, 40000, 80000, 120000], fallSpeedUnitsPerSecond: 210,
  spawnIntervalMs: { min: 1100, max: 1800 }, starProbability: .7, stimulusSizeUnits: { min: 75, max: 105 },
  minimumDistanceUnits: 180, positionAttempts: 30, presentationRule: 'FULLY_VISIBLE', maxFrameGapMs: 250,
  minimumStageScale: .6, inputProfile: 'POINTER_V1', layoutRule: 'VIEWPORT_FIT_V2', referenceWidthUnits: 480, minimumLaneWidthUnits: 120, maximumLanes: 6,
};
export function compatible(version: string, build: string, config: unknown) {
  return version === '1.1' && build === 'tg01-viewport-rebuild-2' && viewportConfigSchema.safeParse(config).success ||
    version === '1.0' && build === 'tg01-reference-rebuild-1' && legacyConfigSchema.safeParse(config).success;
}
const reference = { sessionId: uuid, taskId: z.literal('TG-01'), publishedVersionId: uuid, configVersion: z.number().int().positive(),
  configurationHash: z.string().regex(/^[a-f0-9]{64}$/), gameBuildId: z.enum(['tg01-reference-rebuild-1', 'tg01-viewport-rebuild-2']), contractVersion: z.enum(['1.0', '1.1']) };
export const contextSchema = z.strictObject({ ...reference, config: configSchema,
  executionStatus: z.enum(['READY', 'RUNNING', 'COMPLETED', 'INTERRUPTED', 'EXPIRED', 'UNCONFIRMED']), attemptNumber: z.number().int().min(1).max(10).nullable(),
  startAllowedUntil: z.iso.datetime(), uploadAllowedUntil: z.iso.datetime().nullable(), serverTime: z.iso.datetime(),
  capabilities: z.strictObject({ canStart: z.boolean(), canSubmit: z.boolean(), canReadReceipt: z.boolean() }),
});
export const receiptSchema = z.strictObject({ receiptId: uuid, sessionId: uuid, submissionId: uuidV4, receivedAt: z.iso.datetime(), evidenceHash: z.string().regex(/^[a-f0-9]{64}$/), processingStatusAtReceipt: z.literal('PENDING') });
export const startResponseSchema = z.strictObject({ sessionId: uuid, attemptNumber: z.number().int().min(1).max(10), executionStatus: z.literal('RUNNING'), startedAtServer: z.iso.datetime(), uploadAllowedUntil: z.iso.datetime() });
export const trialSchema = z.strictObject({
  trial: z.number().int().positive(), stimulus: z.enum(['star', 'moon']), spawnedAtMs: time, presentedAtMs: time.nullable(),
  respondedAtMs: time.nullable(), closedAtMs: time, result: z.enum(['hit', 'false_alarm', 'miss', 'correct_rejection', 'not_evaluated']),
  segment: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  closureReason: z.enum(['response', 'window_elapsed', 'session_cutoff', 'interruption', 'never_presented']),
  responseWindowCompleted: z.boolean(), responseDevice: z.enum(['mouse', 'touch', 'pen']).nullable(),
  geometry: z.strictObject({ lane: z.number().int().min(1).max(6), x: z.number().finite(), size: z.number().min(75).max(105) }),
}).superRefine((t, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Incoherent trial' });
  if (t.spawnedAtMs > t.closedAtMs) fail();
  if (t.presentedAtMs === null) {
    if (t.segment !== null || t.respondedAtMs !== null || t.closureReason !== 'never_presented') fail();
  } else if (t.presentedAtMs < t.spawnedAtMs || t.presentedAtMs > t.closedAtMs || t.segment === null) fail();
  if (t.respondedAtMs !== null) {
    if (t.presentedAtMs === null || t.respondedAtMs < t.presentedAtMs || t.respondedAtMs !== t.closedAtMs ||
      t.closureReason !== 'response' || t.responseDevice === null || t.result !== (t.stimulus === 'star' ? 'hit' : 'false_alarm')) fail();
  } else {
    if (t.responseDevice !== null || t.closureReason === 'response' || t.result !== (t.closureReason === 'window_elapsed' ?
      t.stimulus === 'star' ? 'miss' : 'correct_rejection' : 'not_evaluated')) fail();
  }
  if (t.responseWindowCompleted !== (t.closureReason === 'window_elapsed')) fail();
});
export type Trial = z.infer<typeof trialSchema>;
export const incidentSchema = z.strictObject({
  sequence: z.number().int().positive(), type: z.enum(['focus_lost', 'visibility_lost', 'script_error', 'audio_unavailable', 'network_lost', 'network_restored',
    'storage_failure', 'frame_gap', 'layout_changed', 'recovered_after_reload', 'resource_error', 'evidence_limit']),
  clockId: uuid.nullable(), atMs: time.nullable(), endedAtMs: time.nullable(), recordedAtClient: z.iso.datetime().nullable(),
  category: z.enum(['EXECUTION_INTERRUPTED', 'CONTEXT_ONLY', 'MEASUREMENT_AFFECTED']),
});
export type Incident = z.infer<typeof incidentSchema>;
const legacyDevice = z.strictObject({ viewportWidth: z.number().int().positive(), viewportHeight: z.number().int().positive(), stageScale: z.number().min(.6), touchCapable: z.boolean() });
const device = z.union([legacyDevice, legacyDevice.extend({ stageWidthCss: z.number().finite().positive(), stageHeightCss: z.number().finite().positive() })]);
export const envelopeSchema = z.strictObject({
  contractVersion: z.enum(['1.0', '1.1']), sessionId: uuid, submissionId: uuidV4, taskId: z.literal('TG-01'), publishedVersionId: uuid,
  configVersion: z.number().int().positive(), configurationHash: z.string().regex(/^[a-f0-9]{64}$/),
  gameBuildId: z.enum(['tg01-reference-rebuild-1', 'tg01-viewport-rebuild-2']), state: z.enum(['completed', 'interrupted']),
  terminationReason: z.enum(['time_limit', 'user_exit', 'visibility_lost', 'script_error', 'storage_failure', 'frame_gap', 'layout_changed', 'recovered_after_reload', 'evidence_limit', 'resource_error']),
  clock: z.strictObject({ id: uuid, timeOriginUnixMs: time }),
  timing: z.strictObject({ startedAtMs: time, finishedAtMs: time, lastCheckpointAtMs: time }), device,
  events: z.array(trialSchema).max(1000), incidents: z.array(incidentSchema).max(1000),
}).superRefine((e, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Incoherent envelope' });
  const adaptive = e.contractVersion === '1.1';
  if (adaptive !== ('stageWidthCss' in e.device) || e.gameBuildId !== (adaptive ? 'tg01-viewport-rebuild-2' : 'tg01-reference-rebuild-1')) fail();
  let width = 960, lanes = 6;
  if ('stageWidthCss' in e.device) {
    const d = e.device, scale = Math.min(1, d.stageWidthCss / 480);
    width = d.stageWidthCss / scale; lanes = Math.max(1, Math.min(6, Math.floor(width / 120)));
    if (d.stageWidthCss < 288 || d.stageHeightCss < 240 || d.stageWidthCss > d.viewportWidth || d.stageHeightCss > d.viewportHeight || Math.abs(scale - d.stageScale) > 1e-9) fail();
  }
  const { startedAtMs: start, finishedAtMs: end, lastCheckpointAtMs: checkpoint } = e.timing;
  if (start > end || end !== checkpoint || end - start > 120000 || (e.state === 'completed') !== (e.terminationReason === 'time_limit') || e.state === 'completed' && end - start !== 120000) fail();
  let previous = 0;
  for (const t of e.events) {
    if (t.trial <= previous || t.spawnedAtMs < start || t.closedAtMs > end || t.geometry.lane > lanes || Math.abs(t.geometry.x - (t.geometry.lane - .5) * width / lanes) > 1e-8) fail();
    previous = t.trial;
    if (t.presentedAtMs !== null) {
      const elapsed = t.presentedAtMs - start;
      if (elapsed < 0 || elapsed >= 120000 || t.segment !== (elapsed < 40000 ? 1 : elapsed < 80000 ? 2 : 3)) fail();
    }
    if (t.closureReason === 'session_cutoff' && e.state !== 'completed') fail();
  }
  previous = 0;
  for (const i of e.incidents) {
    if (i.sequence <= previous) fail(); previous = i.sequence;
    if (i.type === 'recovered_after_reload') {
      if (i.clockId !== null || i.atMs !== null || i.endedAtMs !== null || i.recordedAtClient === null) fail();
    } else if (i.clockId !== e.clock.id || i.atMs === null || i.atMs < start || i.atMs > end || i.endedAtMs !== null && (i.endedAtMs < i.atMs || i.endedAtMs > end)) fail();
  }
});
export type Envelope = z.infer<typeof envelopeSchema>;

// RFC 8785: JSON number/string serialization and UTF-16 property ordering; input must be validated JSON.
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype)
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  throw new Error('INVALID_JSON');
}
export const hash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export const secretDigest = (value: string) => createHash('sha256').update(Buffer.from(secret.parse(value), 'base64url')).digest('hex');
