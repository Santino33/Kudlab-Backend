import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parseDocument } from 'yaml';
import { z } from 'zod';
import { receiptSchema, startResponseSchema, trialSchema, incidentSchema, uuid, uuidV4, secret, PROFILE, hash } from '../modules/tareas/runtime/contract.js';
import { configSchema, contextSchema, envelopeSchema } from '../modules/tareas/runtime/profiles.js';
import { profile, trialSchema as mentalistaTrial, BUILD_ID, CONTRACT_VERSION } from '../modules/tareas/runtime/tg03/contract.js';
import { buildSequence } from '../modules/tareas/runtime/tg03/bank.js';
import * as kudDice from '../modules/tareas/runtime/tg07/contract.js';
import { buildSequences } from '../modules/tareas/runtime/tg07/sequence.js';
import { KUD_DICE_METRICS, KUD_DICE_SCOPES } from '../modules/evolucion/read/kud-dice-definitions.js';
import { indicatorDefinitionSchema, indicatorDefinitionsResponseSchema, indicatorValueSchema, indicatorHistorySessionSchema, indicatorHistoryResponseSchema } from '../modules/evolucion/read/dto.js';
import { INDICATOR_METRIC_CODES, INDICATOR_SCOPES } from '../modules/evolucion/read/definitions.js';
import { MENTALISTA_METRICS, MENTALISTA_SCOPES } from '../modules/evolucion/read/mentalista-definitions.js';
import { assignmentSchema, assignmentSummarySchema, studentAssignmentSchema, grantSchema, sessionSummarySchema, sessionDetailSchema, page, createInput, requestInput } from '../modules/tareas/runtime/dto.js';
import { codeMetadataSchema, codeBatchInput, codeBatchSchema, codeRevealSchema, codeClaimInput, codeRecoverInput, recoveryCodeInput } from '../modules/tareas/runtime/dto.js';

const sha = (v: string) => createHash('sha256').update(v).digest('hex');
const jsonSchema = (schema: z.ZodType) => { const { $schema: _, ...rest } = z.toJSONSchema(schema); return rest; };
const schemas = { GameConfig: configSchema, RuntimeContext: contextSchema, RuntimeEnvelope: envelopeSchema, EvidenceReceipt: receiptSchema, RuntimeStart: startResponseSchema,
  Assignment: assignmentSchema, AssignmentSummary: assignmentSummarySchema, AssignmentPage: page(assignmentSummarySchema), AssignmentCreate: createInput,
  OperationRequest: requestInput, LaunchGrant: grantSchema, SessionSummary: sessionSummarySchema, SessionDetail: sessionDetailSchema, SessionPage: page(sessionSummarySchema),
  RecoveryRequest: requestInput.extend({ submissionId: uuidV4 }), ClaimRequest: z.strictObject({ claimId: uuidV4, runtimeSecret: secret }), StartRequest: z.strictObject({ startId: uuidV4 }),
  EvidencePage: page(z.union([trialSchema.safeExtend({ calculationDecision: z.unknown() }), mentalistaTrial.safeExtend({ calculationDecision: z.unknown() }), kudDice.trialSchema.safeExtend({ calculationDecision: z.unknown() }), incidentSchema, kudDice.incidentSchema])), ReceiptResponse: z.strictObject({ receipt: receiptSchema.nullable() }),
  ProcessingRetry: z.strictObject({ sessionId: uuid, runId: uuid, processingStatus: z.literal('PENDING') }),
  CodeMetadata: codeMetadataSchema, CodeBatchRequest: codeBatchInput, CodeBatch: codeBatchSchema, CodePage: page(codeMetadataSchema), CodeReveal: codeRevealSchema,
  CodeClaim: codeClaimInput, CodeRecover: codeRecoverInput, RecoveryCodeRequest: recoveryCodeInput, EmptyRequest: z.strictObject({}),
  GameError: z.strictObject({ code: z.string().regex(/^[A-Z_]+$/), message: z.string(), reason: z.string().optional() }) };
const artifact = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, jsonSchema(schema)]));
const syntheticContext = { sessionId: '10000000-0000-4000-8000-000000000001', taskId: 'TG-01', publishedVersionId: '30000000-0000-4000-8000-000000000001', configVersion: 1,
  configurationHash: hash(PROFILE), gameBuildId: 'tg01-viewport-rebuild-2', contractVersion: '1.1', config: PROFILE, executionStatus: 'READY', attemptNumber: null,
  startAllowedUntil: '2026-10-27T12:15:00Z', uploadAllowedUntil: null, serverTime: '2026-10-27T12:00:00Z', capabilities: { canStart: true, canSubmit: false, canReadReceipt: true } };
// Generated declarations are structural; cross-field invariants remain validated by the runtime schemas.
function typeOf(schema: Record<string, unknown>): string {
  if ('const' in schema) return JSON.stringify(schema.const);
  if (Array.isArray(schema.enum)) return schema.enum.map(v => JSON.stringify(v)).join(' | ');
  if (Array.isArray(schema.anyOf)) return schema.anyOf.map(s => typeOf(s)).join(' | ');
  if (Array.isArray(schema.oneOf)) return schema.oneOf.map(s => typeOf(s)).join(' | ');
  if (schema.type === 'null') return 'null';
  if (schema.type === 'number' || schema.type === 'integer') return 'number';
  if (schema.type === 'string' || schema.type === 'boolean') return String(schema.type);
  if (schema.type === 'array') return Array.isArray(schema.prefixItems) ? `[${schema.prefixItems.map(s => typeOf(s)).join(', ')}]` : `(${typeOf(schema.items as Record<string, unknown> ?? {})})[]`;
  if (schema.type === 'object') return `{ ${Object.entries(schema.properties ?? {}).map(([key, v]) => `${JSON.stringify(key)}${(schema.required as string[] ?? []).includes(key) ? '' : '?'}: ${typeOf(v as Record<string, unknown>)};`).join(' ')} }`;
  return 'unknown';
}
const files: Record<string, string> = { 'schemas.json': JSON.stringify(artifact, null, 2) + '\n', 'context-1.1.synthetic.json': JSON.stringify(syntheticContext, null, 2) + '\n',
  'canonical-vectors.json': JSON.stringify([{}, { b: 2, a: 1 }, { numbers: [333333333.3333333, 1e30, 4.5, .002, 1e-27] }].map(value => ({ value, sha256: hash(value) })), null, 2) + '\n',
  'types.d.ts': '// Generated by Kudlab backend game:contract. Do not edit.\n' + Object.entries(artifact).map(([name, schema]) => `export type ${name} = ${typeOf(schema)};`).join('\n') + '\n' };
const mentalistaContext = { ...syntheticContext, taskId: 'TG-03', contractVersion: CONTRACT_VERSION, gameBuildId: BUILD_ID, config: profile(), configurationHash: hash(profile()) };
files['mentalista-bank.ts'] = await readFile('src/modules/tareas/runtime/tg03/bank.ts', 'utf8');
files['mentalista-profile.json'] = JSON.stringify({ config: mentalistaContext.config, configurationHash: mentalistaContext.configurationHash }, null, 2) + '\n';
files['context-2.0.synthetic.json'] = JSON.stringify(contextSchema.parse(mentalistaContext), null, 2) + '\n';
let at = 0;
const events = buildSequence().map(({ item, plannedBlock }, index) => {
  const startedAtMs = at, instructionShownAtMs = Array.from({ length: item.load + 1 }, (_, n) => at + 1000 + n * 3000);
  const optionsShownAtMs = instructionShownAtMs.at(-1)! + 3000, selectedAtMs = optionsShownAtMs + 500;
  at = selectedAtMs + 300;
  return { trial: index + 1, itemId: item.id, load: item.load, plannedBlock, start: item.start, ops: item.ops, intermediates: item.intermediates,
    optionValues: item.options, startedAtMs, instructionShownAtMs, optionsShownAtMs, selectedIdx: item.correctIdx, selectedAtMs, closedAtMs: selectedAtMs, responseDevice: 'touch', closureReason: 'response' };
});
const { config, executionStatus: _, attemptNumber: __, startAllowedUntil: ___, uploadAllowedUntil: ____, serverTime: _____, capabilities: ______, ...reference } = mentalistaContext;
const full = envelopeSchema.parse({ ...reference, submissionId: '40000000-0000-4000-8000-000000000001', state: 'completed', terminationReason: 'items_completed',
  clock: { id: '50000000-0000-4000-8000-000000000001', timeOriginUnixMs: 1794528000000 }, timing: { startedAtMs: 0, finishedAtMs: at, lastCheckpointAtMs: at },
  device: { viewportWidth: 390, viewportHeight: 844, stageWidthCss: 390, stageHeightCss: 772, touchCapable: true, layoutPreset: 'portrait' },
  preparation: { instructionRepeats: 0, practice: [{ round: 1, items: config.bank.practice.map(i => ({ itemId: i.id, selectedIdx: i.correctIdx, result: 'correct', rtMs: 500 })) }], resourceIncidents: [] }, events, incidents: [], extraResponses: [] });
files['envelope-2.0.synthetic.json'] = JSON.stringify(full, null, 2) + '\n';
for (const n of [0, 3]) {
  const end = n ? events[n - 1]!.closedAtMs : 0;
  files[`envelope-2.0.partial-${n}.synthetic.json`] = JSON.stringify(envelopeSchema.parse({ ...full, state: 'interrupted', terminationReason: 'user_exit',
    events: events.slice(0, n), timing: { startedAtMs: 0, finishedAtMs: end, lastCheckpointAtMs: end } }), null, 2) + '\n';
}
const diceConfig = kudDice.profile();
files['kud-dice-profile.json'] = JSON.stringify({ config: diceConfig, configurationHash: hash(diceConfig) }, null, 2) + '\n';
files['kud-dice-sequence.ts'] = await readFile('src/modules/tareas/runtime/tg07/sequence.ts', 'utf8');
// Ship the same refinements to Play; only hashing/byte counting depend on the host platform.
files['kud-dice-validation.ts'] = (await readFile('src/modules/tareas/runtime/tg07/contract.ts', 'utf8'))
  .replace("import { hash } from '../contract.js';", "import fixedProfile from './kud-dice-profile.json' with { type: 'json' };\n// Remaining comparisons only concern ordered integer sequences, not evidence hashes.\nconst hash = (value: readonly number[] | undefined) => JSON.stringify(value);")
  .replace("from './sequence.js'", "from './kud-dice-sequence.js'")
  .replaceAll('hash(buildSequences())', 'fixedProfile.config.sequenceHash')
  .replaceAll('hash(profile())', 'fixedProfile.configurationHash')
  .replace('hash(context.config)', 'fixedProfile.configurationHash')
  .replace("Buffer.byteLength(JSON.stringify(envelope), 'utf8')", 'new TextEncoder().encode(JSON.stringify(envelope)).length');
files['context-tg07.synthetic.json'] = JSON.stringify(contextSchema.parse({ ...syntheticContext, taskId: 'TG-07', config: diceConfig,
  configurationHash: hash(diceConfig), gameBuildId: kudDice.BUILD_ID, contractVersion: kudDice.CONTRACT_VERSION }), null, 2) + '\n';
const diceSequences = buildSequences();
const diceTrial = (sequence: number[], start: number, practice = false) => {
  const open = start + 900 + sequence.length * 900;
  return { trial: 1, length: sequence.length, sequence, sequenceIndex: 0, attemptAtLength: 1, isReplacement: false,
    startedAtMs: start, presentationStartMs: start + 900, responseOpenedAtMs: open, closedAtMs: practice ? open + 1250 : open + 8000,
    responses: practice ? sequence.map((drum, i) => ({ drum, atMs: open + (i + 1) * 500, pointerType: 'mouse' })) : [],
    earlyTaps: [], valid: true, invalidReason: null, closureReason: practice ? 'response' : 'timeout' };
};
const diceEvents = [diceTrial(diceSequences.byLength[2]![0]!, 6000), { ...diceTrial(diceSequences.byLength[2]![1]!, 18200), trial: 2, sequenceIndex: 1, attemptAtLength: 2 }];
const diceEnd = diceEvents[1]!.closedAtMs + 1500;
const diceFull = kudDice.envelopeSchema.parse({ ...reference, taskId: 'TG-07', configurationHash: hash(diceConfig), gameBuildId: kudDice.BUILD_ID,
  submissionId: '40000000-0000-4000-8000-000000000007', state: 'completed', terminationReason: 'all_trials_incorrect_at_length', phaseReached: 'done',
  clock: { id: '50000000-0000-4000-8000-000000000007', timeOriginUnixMs: 1794528000000 },
  timing: { startedAtMs: 0, finishedAtMs: diceEnd, lastCheckpointAtMs: diceEnd, measurementStartedAtMs: 6000, measurementFinishedAtMs: diceEnd },
  device: { viewportWidth: 1920, viewportHeight: 1080, stageWidthCss: 1920, stageHeightCss: 1080, devicePixelRatio: 1, touchCapable: false, pointerTypes: ['mouse'] },
  audio: { source: 'files', missingFiles: [] }, preparation: { instruction: { shownAtMs: 10, acceptedAtMs: 20, repeats: 0 }, demoShown: true,
    practiceCompleted: true, practice: [{ round: 1, evidence: diceTrial(diceSequences.practice[1]!, 100, true) }] }, events: diceEvents, incidents: [] });
files['envelope-tg07.synthetic.json'] = JSON.stringify(diceFull, null, 2) + '\n';
const dicePartial = kudDice.envelopeSchema.parse({ ...diceFull, state: 'interrupted', terminationReason: 'user_exit', phaseReached: 'intro', events: [],
  timing: { startedAtMs: 0, finishedAtMs: 100, lastCheckpointAtMs: 100, measurementStartedAtMs: null, measurementFinishedAtMs: null },
  preparation: { instruction: { shownAtMs: 10, acceptedAtMs: null, repeats: 0 }, demoShown: false, practiceCompleted: false, practice: [] } });
files['envelope-tg07.partial-0.synthetic.json'] = JSON.stringify(dicePartial, null, 2) + '\n';
const manifest = { version: '1.4.0', contracts: ['1.0', '1.1', '2.0'], producer: 'Kudlab-backend', canonicalization: 'RFC8785', files: Object.fromEntries(Object.entries(files).map(([name, content]) => [name, sha(content)])) };
files['manifest.json'] = JSON.stringify(manifest, null, 2) + '\n';
for (const target of ['contract/runtime-1.4.0', ...process.argv.slice(2)]) {
  await mkdir(resolve(target), { recursive: true });
  for (const [name, body] of Object.entries(files)) await writeFile(resolve(target, name), body);
}

const path = 'docs/api/openapi.yaml', text = await readFile(path, 'utf8'), doc = parseDocument(text);
// OpenAPI-only teacher schemas: not part of the runtime artifact consumed by Play.
const teacherSchemas = { StudentAssignmentPage: jsonSchema(page(studentAssignmentSchema)),
  IndicatorDefinition: jsonSchema(indicatorDefinitionSchema), IndicatorDefinitionList: jsonSchema(indicatorDefinitionsResponseSchema),
  IndicatorValue: jsonSchema(indicatorValueSchema), IndicatorHistorySession: jsonSchema(indicatorHistorySessionSchema), IndicatorHistoryPage: jsonSchema(indicatorHistoryResponseSchema) };
for (const [name, schema] of Object.entries({ ...artifact, ...teacherSchemas })) doc.setIn(['components', 'schemas', name], schema);
doc.setIn(['components', 'securitySchemes', 'runtimeCapability'], { type: 'http', scheme: 'bearer', description: 'Secreto de runtime limitado a una sesión. Nunca sesión docente ni JWT.' });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const response = (name: string) => ({ description: 'Respuesta confirmada; no-store.', headers: { 'Cache-Control': { schema: { type: 'string', const: 'no-store' } } }, content: { 'application/json': { schema: ref(name) } } });
const definitions = [
  ['post', '/api/v1/task-assignments/{id}/access-codes', 'createAccessCodes', 'Generar códigos individuales', 'CodeBatchRequest', 'CodeBatch', 201],
  ['get', '/api/v1/task-assignments/{id}/access-codes', 'listAccessCodes', 'Listar metadatos sin secretos', '', 'CodePage', 200],
  ['post', '/api/v1/task-access-codes/{id}/reveal', 'revealAccessCode', 'Revelar un código autorizado', 'EmptyRequest', 'CodeReveal', 200],
  ['post', '/api/v1/task-access-codes/{id}/replace', 'replaceAccessCode', 'Reemplazar acceso sin reiniciar intentos', 'OperationRequest', 'CodeMetadata', 201],
  ['post', '/api/v1/task-access-codes/{id}/revoke', 'revokeAccessCode', 'Revocar nuevos inicios', 'OperationRequest', 'CodeMetadata', 200],
  ['post', '/api/v1/task-sessions/{id}/access-recovery-codes', 'createRecoveryCode', 'Autorizar recuperación en el navegador original', 'RecoveryCodeRequest', 'CodeMetadata', 201],
  ['post', '/api/v1/game-runtime/access/claim', 'claimAccessCode', 'Canjear código sin sesión docente', 'CodeClaim', 'RuntimeContext', 200],
  ['post', '/api/v1/game-runtime/access/recover', 'recoverAccessCode', 'Recuperar solo entrega y acuse', 'CodeRecover', 'RuntimeContext', 200],
  ['post', '/api/v1/task-assignments', 'createTaskAssignment', 'Crear asignación', 'AssignmentCreate', 'Assignment', 201],
  ['get', '/api/v1/task-assignments', 'listTaskAssignments', 'Consultar asignaciones del curso', '', 'AssignmentPage', 200],
  ['get', '/api/v1/task-assignments/{id}', 'getTaskAssignment', 'Consultar asignación', '', 'Assignment', 200],
  ['post', '/api/v1/task-assignments/{id}/cancel', 'cancelTaskAssignment', 'Cancelar nuevos inicios', 'OperationRequest', 'Assignment', 200],
  ['post', '/api/v1/task-assignment-recipients/{id}/launch-grants', 'createLaunchGrant', 'Preparar inicio supervisado', 'OperationRequest', 'LaunchGrant', 201],
  ['get', '/api/v1/students/{id}/task-assignments', 'listStudentTaskAssignments', 'Consultar asignaciones de un estudiante', '', 'StudentAssignmentPage', 200],
  ['get', '/api/v1/students/{id}/task-sessions', 'listStudentTaskSessions', 'Consultar sesiones individuales', '', 'SessionPage', 200],
  ['get', '/api/v1/task-sessions/{id}', 'getTaskSession', 'Consultar evidencia e indicadores disponibles', '', 'SessionDetail', 200],
  ['get', '/api/v1/task-sessions/{id}/evidence', 'listTaskEvidence', 'Paginar evidencia', '', 'EvidencePage', 200],
  ['post', '/api/v1/task-sessions/{id}/recovery-grants', 'createRecoveryGrant', 'Autorizar entrega pendiente sin otro intento', 'RecoveryRequest', 'LaunchGrant', 201],
  ['post', '/api/v1/task-sessions/{id}/processing-retries', 'retryTaskProcessing', 'Reintentar cálculo fallido', 'OperationRequest', 'ProcessingRetry', 202],
  ['post', '/api/v1/game-runtime/launches/claim', 'claimGameLaunch', 'Canjear autorización supervisada', 'ClaimRequest', 'RuntimeContext', 200],
  ['get', '/api/v1/game-runtime/sessions/{id}', 'getRuntimeContext', 'Reconciliar contexto de sesión', '', 'RuntimeContext', 200],
  ['post', '/api/v1/game-runtime/sessions/{id}/start', 'startGameSession', 'Confirmar inicio y consumir intento', 'StartRequest', 'RuntimeStart', 200],
  ['post', '/api/v1/game-runtime/sessions/{id}/results', 'submitGameEvidence', 'Guardar evidencia final inmutable', 'RuntimeEnvelope', 'EvidenceReceipt', 201],
  ['get', '/api/v1/game-runtime/sessions/{id}/receipt', 'getEvidenceReceipt', 'Reconciliar acuse de persistencia', '', 'ReceiptResponse', 200],
] as const;
for (const [method, route, operationId, summary, input, output, status] of definitions) {
  const runtime = route.includes('/game-runtime/');
  const access = route.includes('access-codes') || route.includes('access-recovery-codes') || route.includes('/access/');
  const parameters: Record<string, unknown>[] = route.includes('{id}') ? [{ name: 'id', in: 'path', required: true, schema: jsonSchema(uuid) }] : [];
  function param(name: string, schema: unknown, required = false) { parameters.push({ name, in: 'query', required, schema }); }
  if (output.endsWith('Page')) { param('cursor', { type: 'string', maxLength: 2048 }); param('limit', { type: 'integer', minimum: 1, maximum: 100, default: 25 }); }
  if (operationId === 'listTaskAssignments') param('groupId', jsonSchema(uuid), true);
  if (operationId === 'listStudentTaskSessions') param('taskId', { type: 'string', enum: ['TG-01', 'TG-03', 'TG-07'] });
  if (operationId === 'listTaskEvidence') param('kind', { type: 'string', enum: ['trials', 'incidents'] }, true);
  if (operationId === 'getEvidenceReceipt') param('submissionId', jsonSchema(uuidV4), true);
  const responses: Record<string, unknown> = { [status]: response(output) };
  if (status === 201) responses['200'] = response(output);
  for (const code of [400, 401, 403, 404, 409, 413, 503, ...(runtime ? [429] : [])]) responses[code] = { ...response('GameError'), ...(code === 429 ? { headers: { 'Retry-After': { schema: { type: 'string' } }, 'Cache-Control': { schema: { type: 'string', const: 'no-store' } } } } : {}) };
  const operation = { operationId, summary, tags: [access ? 'Accesos' : runtime ? 'Runtime' : 'Actividades'],
    description: access ? (runtime ? 'Canje público online sin cookies ni Authorization docente. Código individual de cinco caracteres; claimId/secreto de 256 bits persistidos antes de enviar. ACCESS_UNAVAILABLE neutraliza autorización/estado; 429 con Retry-After y 503 separan abuso e indisponibilidad. PostgreSQL comparte límites IP y digest entre instancias. Recuperación fija sesión/submission, nunca inicia ni devuelve evidencia. Sobres y fórmulas sin cambios. Participación institucional ausente bloquea uso real. Véase docs/acceso-codigo.md.' : 'TEACHER con sesión persistida y responsabilidad actual. Lotes atómicos de hasta 100, idempotencia por requestId, metadatos sin secretos y revelado individual no-store. Reemplazo/revocación invalidan inicios preparados, no entregas ya iniciadas. Recuperación dura 24 h; reconcileReceipt es explícito si ya existe acuse. Transferencia revoca accesos anteriores atómicamente. Véase docs/acceso-codigo.md.') : runtime ? 'Capacidad por sesión sin cookies docentes. Contratos 1.0 histórico y 1.1 adaptable; identidad/configuración resueltas por servidor. Entrega idempotente, sin reanudar medición. JSON estricto y límites 1 MiB/1000 ensayos/1000 incidencias. Véase docs/integracion-play.md.' : 'TEACHER activo con sesión persistida y responsabilidad actual. Mutaciones idempotentes con requestId; fechas UTC y destinatarios fijos. Participación institucional no implementada: deniega en composición normal. Solo test runner con BD aislada admite autorizaciones ficticias.',
    security: runtime ? access ? [] : [{ runtimeCapability: [] }] : [{ sessionCookie: [] }, { secureSessionCookie: [] }, { sessionBearer: [] }], parameters,
    ...(input ? { requestBody: { required: true, content: { 'application/json': { schema: ref(input) } } } } : {}), responses };
  if (operationId === 'listStudentTaskAssignments') operation.description = 'TEACHER activo con sesión persistida y responsabilidad actual del estudiante. Asignaciones individuales o colectivas en las que el estudiante es destinatario fijo, solo de cursos propios; la pertenencia actual al curso no crea relaciones retroactivas. Orden createdAt DESC, id DESC; cursor firmado ligado al estudiante. attemptsStarted cuenta solo los intentos de ese destinatario. No devuelve otros destinatarios, códigos, grants ni evidencia. Lista vacía es 200; ajeno o inexistente 404 indistinguible; ADMIN 403.';
  if (operationId === 'getEvidenceReceipt') operation.description = 'Consulta automática y solo de lectura de un acuse existente, ligada al secreto original de capacidad, sesión y submissionId. Acepta capacidad expirada con canReadReceipt, nunca revocada. No renueva capacidad, no habilita inicio/entrega, no devuelve evidencia ni datos nominales. Devuelve receipt:null si ese envío no fue recibido. Play valida sesión/submission/hash antes de limpiar. Conserva origen exacto, no-store y límites runtime. No depende del código corto ni su vigencia.';
  doc.setIn(['paths', route, method], operation);
}
const tags = doc.toJS().tags as { name: string; description: string }[];
const historyParams = doc.toJS().paths['/api/v1/students/{id}/indicator-history'].get.parameters as { name: string; schema: unknown }[];
for (const p of historyParams) {
  if (p.name === 'taskId') p.schema = { type: 'string', enum: ['TG-01', 'TG-03', 'TG-07'] };
  if (p.name === 'metricCode') p.schema = { type: 'string', enum: [...new Set([...INDICATOR_METRIC_CODES, ...MENTALISTA_METRICS, ...KUD_DICE_METRICS])] };
  if (p.name === 'scope') p.schema = { type: 'string', enum: [...new Set([...INDICATOR_SCOPES, ...MENTALISTA_SCOPES, ...KUD_DICE_SCOPES])] };
}
doc.setIn(['paths', '/api/v1/students/{id}/indicator-history', 'get', 'parameters'], historyParams);
for (const name of ['Actividades', 'Runtime', 'Accesos']) if (!tags.some(t => t.name === name)) tags.push({ name, description: name === 'Accesos' ? 'Códigos individuales de cinco caracteres; canje público sin cookies docentes. Uso real bloqueado.' : name === 'Runtime' ? 'API restringida del juego, sin cuentas estudiantiles.' : 'Asignación supervisada y consulta individual TEACHER.' });
doc.set('tags', tags);
await writeFile(path, String(doc));
console.log('Artefacto 1.4.0: sobres TG-01 1.0/1.1, TG-03 y TG-07 2.0; históricos preservados.');
