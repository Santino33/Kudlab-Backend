import { z } from 'zod';
import * as tg01 from './contract.js';
import * as tg03 from './tg03/contract.js';
import * as tg07 from './tg07/contract.js';
import { RULE as rule01 } from '../../evolucion/tg01.js';
import { RULE as rule03 } from '../../evolucion/tg03.js';
import { RULE as rule07 } from '../../evolucion/tg07.js';

export const taskIdSchema = z.enum(['TG-01', 'TG-03', 'TG-07']);
export const configSchema = z.union([tg01.configSchema, tg03.configSchema, tg07.configSchema]);
export const contextSchema = z.union([tg01.contextSchema, tg03.contextSchema, tg07.contextSchema]);
export const envelopeSchema = z.discriminatedUnion('taskId', [tg01.envelopeSchema, tg03.envelopeSchema, tg07.envelopeSchema]);
export type Config = z.infer<typeof configSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export function compatible(taskId: string, version: string, build: string, config: unknown) {
  if (taskId === 'TG-01') return tg01.compatible(version, build, config);
  const game = taskId === 'TG-03' ? tg03 : taskId === 'TG-07' ? tg07 : null;
  return game !== null && version === game.CONTRACT_VERSION && build === game.BUILD_ID && game.configSchema.safeParse(config).success;
}
export function supportedRule(rule: { taskId: string; code: string; version: number; definition: unknown; definitionHash: string }) {
  const expected = rule.taskId === 'TG-01' ? rule01 : rule.taskId === 'TG-03' ? rule03 : rule.taskId === 'TG-07' ? rule07 : null;
  return expected !== null && rule.code === expected.code && rule.version === expected.version &&
    rule.definitionHash === tg01.hash(expected) && tg01.hash(rule.definition) === rule.definitionHash;
}
