import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { envelope } from '../tg07-envelope.js';
import { calculate } from '../../src/modules/evolucion/tg07.js';
import { KUD_DICE_DEFINITIONS } from '../../src/modules/evolucion/read/kud-dice-definitions.js';
import { indicatorDefinitionSchema, indicatorHistoryQuerySchema, indicatorValueSchema } from '../../src/modules/evolucion/read/dto.js';
import { envelopeSchema, contextSchema } from '../../src/modules/tareas/runtime/profiles.js';

describe('TG07 generated/read contract / CA-04,05,06,08', () => {
  it('defines each calculated metric with its actual unit and supported scope', () => {
    const definitions = KUD_DICE_DEFINITIONS.map(d => indicatorDefinitionSchema.parse({ ...d, rule: null }));
    for (const value of calculate(envelope(), true).indicators) {
      expect(indicatorValueSchema.safeParse(value).success).toBe(true);
      const definition = definitions.find(d => d.metricCode === value.metricCode)!;
      expect(definition.unit).toBe(value.unit);
      expect(definition.scopes).toContain(value.scope);
    }
  });
  it('rejects crossed game scopes and global-only metrics on a length filter', () => {
    expect(indicatorHistoryQuerySchema.safeParse({ taskId: 'TG-07', metricCode: 'accuracy_pct', scope: 'LENGTH_2' }).success).toBe(true);
    for (const query of [
      { taskId: 'TG-07', scope: 'LOAD_1' }, { taskId: 'TG-07', metricCode: 'longest_correct_length', scope: 'LENGTH_2' },
      { taskId: 'TG-03', scope: 'LENGTH_2' }, { taskId: 'TG-01', metricCode: 'orderErrors' },
    ]) expect(indicatorHistoryQuerySchema.safeParse(query).success).toBe(false);
  });
  it('verifies every generated artifact hash and TG07 full/partial/context refinements', () => {
    const root = 'contract/runtime-1.4.0/';
    const manifest = JSON.parse(readFileSync(root + 'manifest.json', 'utf8'));
    expect(manifest.version).toBe('1.4.0');
    for (const [name, digest] of Object.entries(manifest.files))
      expect(createHash('sha256').update(readFileSync(root + name)).digest('hex'), name).toBe(digest);
    for (const name of ['envelope-tg07.synthetic.json', 'envelope-tg07.partial-0.synthetic.json'])
      expect(envelopeSchema.parse(JSON.parse(readFileSync(root + name, 'utf8'))).taskId).toBe('TG-07');
    expect(contextSchema.parse(JSON.parse(readFileSync(root + 'context-tg07.synthetic.json', 'utf8'))).taskId).toBe('TG-07');
  });
});
