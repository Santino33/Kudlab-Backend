import { z } from 'zod';
import { hash } from '../contract.js';
import { BANK, bankSchema, buildSequence, operationSchema } from './bank.js';

export const BUILD_ID = 'tg03-mentalista-1';
export const CONTRACT_VERSION = '2.0';
const time = z.number().finite().nonnegative();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const uuid = z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
const uuidV4 = z.string().regex(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
export const configSchema = z.strictObject({
  profile: z.literal('TG03_MENTALISTA_V1'), instructionMs: z.literal(2500), gapMs: z.literal(500), preItemMs: z.literal(1000),
  answerTimeoutMs: z.literal(30000), anticipatoryMs: z.literal(400), pressedMs: z.literal(300), nOptions: z.literal(4),
  seed: z.literal(30303), practiceMaxRounds: z.literal(2), maxFrameGapMs: z.literal(250), layoutRule: z.literal('ADAPTIVE_DOM_V1'),
  bank: bankSchema, bankHash: digest, sequenceHash: digest,
}).superRefine((config, ctx) => {
  if (hash(config.bank) !== config.bankHash || hash(config.bank) !== hash(BANK) || hash(buildSequence(config.bank, config.seed)) !== config.sequenceHash)
    ctx.addIssue({ code: 'custom', message: 'Unrecognized bank or sequence' });
});
export type Config = z.infer<typeof configSchema>;
// Lazy: the common runtime dispatcher can import these schemas without an initialization cycle.
export function profile(): Config {
  return configSchema.parse({ profile: 'TG03_MENTALISTA_V1', instructionMs: 2500, gapMs: 500, preItemMs: 1000,
    answerTimeoutMs: 30000, anticipatoryMs: 400, pressedMs: 300, nOptions: 4, seed: 30303, practiceMaxRounds: 2,
    maxFrameGapMs: 250, layoutRule: 'ADAPTIVE_DOM_V1', bank: BANK, bankHash: hash(BANK), sequenceHash: hash(buildSequence()) });
}
export const trialSchema = z.strictObject({
  trial: z.number().int().min(1).max(12), itemId: z.string().regex(/^M[1-4]-[1-3]$/), load: z.number().int().min(1).max(4),
  plannedBlock: z.number().int().min(1).max(3), start: z.number().int().min(1).max(9),
  ops: z.array(operationSchema).min(1).max(4), intermediates: z.array(z.number().int().min(0).max(20)).max(3),
  optionValues: z.array(z.number().int().min(0).max(20)).length(4),
  startedAtMs: time, instructionShownAtMs: z.array(time).max(5), optionsShownAtMs: time.nullable(),
  selectedIdx: z.number().int().min(0).max(3).nullable(), selectedAtMs: time.nullable(), closedAtMs: time,
  responseDevice: z.enum(['mouse', 'touch', 'pen', 'keyboard']).nullable(), closureReason: z.enum(['response', 'timeout', 'interruption']),
}).superRefine((trial, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Incoherent mathematical trial' });
  if (trial.closedAtMs < trial.startedAtMs || trial.instructionShownAtMs.length > trial.load + 1) fail();
  const shown = trial.instructionShownAtMs;
  if (shown.length && shown[0]! < trial.startedAtMs + 1000) fail();
  if (shown.some((at, index) => at > trial.closedAtMs || index > 0 && at < shown[index - 1]! + 3000)) fail();
  if (trial.optionsShownAtMs !== null && (shown.length !== trial.load + 1 || trial.optionsShownAtMs < shown.at(-1)! + 3000 || trial.optionsShownAtMs > trial.closedAtMs)) fail();
  if (trial.closureReason === 'response') {
    if (trial.optionsShownAtMs === null || trial.selectedIdx === null || trial.selectedAtMs === null || trial.responseDevice === null ||
      trial.selectedAtMs < trial.optionsShownAtMs || trial.selectedAtMs >= trial.optionsShownAtMs + 30000 || trial.selectedAtMs !== trial.closedAtMs) fail();
  } else {
    if (trial.selectedIdx !== null || trial.selectedAtMs !== null || trial.responseDevice !== null) fail();
    if (trial.closureReason === 'timeout' && (trial.optionsShownAtMs === null || trial.closedAtMs < trial.optionsShownAtMs + 30000)) fail();
  }
});
export type Trial = z.infer<typeof trialSchema>;
export const reasonSchema = z.enum(['items_completed', 'user_exit', 'focus_lost', 'visibility_lost', 'script_error', 'storage_failure',
  'frame_gap', 'layout_changed', 'recovered_after_reload', 'evidence_limit', 'resource_error']);
export const incidentSchema = z.strictObject({
  sequence: z.number().int().positive(), type: z.enum(['focus_lost', 'visibility_lost', 'script_error', 'network_lost', 'network_restored',
    'storage_failure', 'frame_gap', 'layout_changed', 'recovered_after_reload', 'resource_error', 'evidence_limit']),
  clockId: uuid.nullable(), atMs: time.nullable(), endedAtMs: time.nullable(), recordedAtClient: z.iso.datetime().nullable(),
  category: z.enum(['EXECUTION_INTERRUPTED', 'CONTEXT_ONLY', 'MEASUREMENT_AFFECTED']),
});
export type Incident = z.infer<typeof incidentSchema>;
const practiceItem = z.strictObject({ itemId: z.enum(['P1', 'P2']), selectedIdx: z.number().int().min(0).max(3).nullable(),
  result: z.enum(['correct', 'incorrect', 'omission']), rtMs: time.nullable() }).superRefine((trial, ctx) => {
  const item = BANK.practice.find(item => item.id === trial.itemId)!;
  if (trial.result !== (trial.selectedIdx === null ? 'omission' : trial.selectedIdx === item.correctIdx ? 'correct' : 'incorrect') ||
    (trial.selectedIdx === null) !== (trial.rtMs === null)) ctx.addIssue({ code: 'custom', message: 'Incoherent practice' });
});
export const preparationSchema = z.strictObject({
  instructionRepeats: z.number().int().min(0).max(1000),
  practice: z.array(z.strictObject({ round: z.number().int().min(1).max(2), items: z.tuple([practiceItem, practiceItem]) })).min(1).max(2),
  resourceIncidents: z.array(z.strictObject({ phase: z.enum(['preparation', 'closing']),
    type: z.enum(['transition_skipped', 'resource_error']), reason: z.enum(['video_error', 'timeout', 'autoplay_blocked', 'reduced_motion', 'closing_recovered']),
  })).max(1000),
}).superRefine((preparation, ctx) => {
  preparation.practice.forEach((round, index) => {
    if (round.round !== index + 1 || round.items[0].itemId !== 'P1' || round.items[1].itemId !== 'P2' ||
      index === 1 && preparation.practice[0]!.items.every(item => item.result === 'correct'))
      ctx.addIssue({ code: 'custom', message: 'Incoherent practice rounds' });
  });
});
const reference = { sessionId: uuid, taskId: z.literal('TG-03'), publishedVersionId: uuid,
  configVersion: z.number().int().positive(), configurationHash: digest, gameBuildId: z.literal(BUILD_ID), contractVersion: z.literal(CONTRACT_VERSION) };
export const deviceSchema = z.strictObject({ viewportWidth: z.number().int().positive(), viewportHeight: z.number().int().positive(),
  stageWidthCss: z.number().finite().positive(), stageHeightCss: z.number().finite().positive(), touchCapable: z.boolean(),
  layoutPreset: z.enum(['portrait', 'landscape']),
}).superRefine((device, ctx) => {
  if (device.stageWidthCss > device.viewportWidth || device.stageHeightCss > device.viewportHeight)
    ctx.addIssue({ code: 'custom', message: 'Stage outside viewport' });
});
export const contextSchema = z.strictObject({ ...reference, config: configSchema,
  executionStatus: z.enum(['READY', 'RUNNING', 'COMPLETED', 'INTERRUPTED', 'EXPIRED', 'UNCONFIRMED']),
  attemptNumber: z.number().int().min(1).max(10).nullable(), startAllowedUntil: z.iso.datetime(), uploadAllowedUntil: z.iso.datetime().nullable(),
  serverTime: z.iso.datetime(), capabilities: z.strictObject({ canStart: z.boolean(), canSubmit: z.boolean(), canReadReceipt: z.boolean() }),
}).superRefine((context, ctx) => {
  if (context.configurationHash !== hash(context.config) || context.capabilities.canStart && context.attemptNumber !== null ||
    context.capabilities.canSubmit && (context.attemptNumber === null || context.uploadAllowedUntil === null))
    ctx.addIssue({ code: 'custom', message: 'Incoherent mathematical context' });
});
export const envelopeSchema = z.strictObject({ ...reference, submissionId: uuidV4, state: z.enum(['completed', 'interrupted']), terminationReason: reasonSchema,
  clock: z.strictObject({ id: uuid, timeOriginUnixMs: time }),
  timing: z.strictObject({ startedAtMs: time, finishedAtMs: time, lastCheckpointAtMs: time }), device: deviceSchema,
  preparation: preparationSchema, events: z.array(trialSchema).max(12), incidents: z.array(incidentSchema).max(1000),
  extraResponses: z.array(z.strictObject({ sequence: z.number().int().positive(), trial: z.number().int().min(1).max(12), atMs: time,
    region: z.enum(['locked', 'outside_options']), device: z.enum(['mouse', 'touch', 'pen', 'keyboard']),
    x: z.number().finite().nullable(), y: z.number().finite().nullable() })).max(1000),
}).superRefine((envelope, ctx) => {
  const fail = () => ctx.addIssue({ code: 'custom', message: 'Incoherent mathematical envelope' });
  const { startedAtMs: start, finishedAtMs: end, lastCheckpointAtMs: checkpoint } = envelope.timing;
  if (start > end || end !== checkpoint || envelope.configurationHash !== hash(profile())) fail();
  if ((envelope.state === 'completed') !== (envelope.terminationReason === 'items_completed')) fail();
  if (envelope.state === 'completed' && (envelope.events.length !== 12 || envelope.events.some(event => event.closureReason === 'interruption'))) fail();
  const sequence = buildSequence();
  envelope.events.forEach((event, index) => {
    const entry = sequence[index]!;
    const item = entry.item;
    if (event.trial !== index + 1 || event.itemId !== item.id || event.load !== item.load || event.plannedBlock !== entry.plannedBlock ||
      event.start !== item.start || hash(event.ops) !== hash(item.ops) || hash(event.intermediates) !== hash(item.intermediates) || hash(event.optionValues) !== hash(item.options)) fail();
    if (event.startedAtMs < start || event.closedAtMs > end || index > 0 && event.startedAtMs < envelope.events[index - 1]!.closedAtMs) fail();
    if (event.closureReason === 'interruption' && (envelope.state !== 'interrupted' || index !== envelope.events.length - 1)) fail();
  });
  envelope.incidents.forEach((incident, index) => {
    if (index > 0 && incident.sequence <= envelope.incidents[index - 1]!.sequence) fail();
    if (incident.type === 'recovered_after_reload') {
      if (incident.clockId !== null || incident.atMs !== null || incident.endedAtMs !== null || incident.recordedAtClient === null) fail();
    } else if (incident.clockId !== envelope.clock.id || incident.atMs === null || incident.atMs < start || incident.atMs > end ||
      incident.endedAtMs !== null && (incident.endedAtMs < incident.atMs || incident.endedAtMs > end)) fail();
    const network = incident.type === 'network_lost' || incident.type === 'network_restored';
    if (network !== (incident.category === 'CONTEXT_ONLY')) fail();
    if (!network && envelope.state === 'completed') fail();
    if (!network && incident.atMs !== null && envelope.events.some(event => event.startedAtMs > incident.atMs!)) fail();
  });
  envelope.extraResponses.forEach((response, index) => {
    const event = envelope.events[response.trial - 1];
    if (!event || response.atMs < event.startedAtMs || response.atMs > end || index > 0 && response.sequence <= envelope.extraResponses[index - 1]!.sequence) fail();
    if (response.device === 'keyboard' ? response.x !== null || response.y !== null : response.x === null || response.y === null) fail();
  });
  if (Buffer.byteLength(JSON.stringify(envelope), 'utf8') > 1048576) fail();
});
export type Envelope = z.infer<typeof envelopeSchema>;
