import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { envelopeSchema as browser, contextSchema as browserContext } from '../../contract/runtime-1.5.0/palabra-intrusa-validation.js';
import { envelopeSchema as producer, contextSchema } from '../../src/modules/tareas/runtime/tg02/contract.js';
import { envelope } from '../tg02-envelope.js';
import manifest from '../../contract/runtime-1.5.0/manifest.json' with { type: 'json' };
import context from '../../contract/runtime-1.5.0/context-tg02.synthetic.json' with { type: 'json' };
import partial from '../../contract/runtime-1.5.0/envelope-tg02.partial-0.synthetic.json' with { type: 'json' };

describe('TG02 generated browser contract / CA-03,05,08,09', () => {
  it('matches producer for full/partial evidence and rejects mutations identically', () => {
    for (const valid of [envelope(), partial]) {
      expect(browser.parse(valid)).toEqual(producer.parse(valid));
    }
    const base = envelope();
    const mutations = [
      { ...base, score: 1 }, { ...base, configurationHash: '0'.repeat(64) },
      { ...base, events: base.events.slice(1) }, { ...base, pauses: [{ startMs: 10, endMs: 20 }] },
      { ...base, events: base.events.map((t, i) => i ? t : { ...t, words: ['altered', ...t.words.slice(1)] }) },
      { ...base, events: base.events.map((t, i) => i ? t : { ...t, rtMs: 501 }) },
      { ...base, timing: { ...base.timing, measurementFinishedAtMs: null } },
    ];
    for (const value of mutations) {
      expect(producer.safeParse(value).success).toBe(false);
      expect(browser.safeParse(value).success).toBe(false);
    }
    expect(browserContext.parse(context)).toEqual(contextSchema.parse(context));
    expect(browserContext.safeParse({ ...context, config: { ...context.config, seed: 1 } }).success).toBe(false);
  });
  it('verifies every artifact digest and keeps the browser validator free of Node dependencies', () => {
    for (const [file, digest] of Object.entries(manifest.files)) {
      const content = readFileSync(`contract/runtime-1.5.0/${file}`);
      expect(createHash('sha256').update(content).digest('hex')).toBe(digest);
    }
    const source = readFileSync('contract/runtime-1.5.0/palabra-intrusa-validation.ts', 'utf8');
    expect(source).not.toMatch(/node:|Buffer\.|\.\.\/contract|\.\/profile\.js/);
  });
});
