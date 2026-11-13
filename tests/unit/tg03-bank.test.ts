import { describe, expect, it } from 'vitest';
import { BANK, LOADS, bankSchema, buildSequence, itemSchema } from '../../src/modules/tareas/runtime/tg03/bank.js';

describe('TG-03 bank / CA-04', () => {
  it('retains the 12 measurement and two practice items of the authorized reference', () => {
    expect(BANK.items.map(item => [item.id, item.start, item.ops.map(op => op.op === 'suma' ? op.n : -op.n), item.options])).toEqual([
      ['M1-1', 7, [3], [7, 8, 9, 10]], ['M1-2', 8, [-6], [0, 2, 3, 4]], ['M1-3', 9, [5], [12, 13, 14, 16]],
      ['M2-1', 1, [6, -5], [0, 2, 3, 4]], ['M2-2', 9, [6, -1], [14, 15, 16, 17]], ['M2-3', 5, [-3, 4], [3, 4, 5, 6]],
      ['M3-1', 2, [1, 6, -3], [6, 7, 8, 9]], ['M3-2', 7, [-2, -5, 2], [0, 1, 2, 4]], ['M3-3', 5, [4, 3, -2], [7, 8, 9, 10]],
      ['M4-1', 7, [-2, 5, 4, 4], [16, 17, 18, 20]], ['M4-2', 3, [2, -3, -2, 6], [6, 7, 8, 9]], ['M4-3', 6, [-3, 6, 2, 3], [12, 14, 15, 16]],
    ]);
    expect(BANK.practice.map(item => [item.id, item.load, item.answer])).toEqual([['P1', 1, 2], ['P2', 2, 6]]);
    expect(Object.isFrozen(BANK.items[0]!.ops)).toBe(true);
  });
  it.each([0, 1, 30303, 0xffffffff])('reproduces balanced blocks for seed %s', seed => {
    const sequence = buildSequence(BANK, seed);
    expect(sequence).toEqual(buildSequence(BANK, seed));
    expect(new Set(sequence.map(entry => entry.item.id)).size).toBe(12);
    for (const block of [1, 2, 3]) expect(sequence.filter(entry => entry.plannedBlock === block).map(entry => entry.item.load).sort()).toEqual(LOADS);
    for (let i = 2; i < sequence.length; i++) {
      const last = sequence.slice(i - 2, i + 1).map(entry => entry.item);
      expect(new Set(last.map(item => item.load)).size).toBeGreaterThan(1);
      expect(new Set(last.map(item => item.correctIdx)).size).toBeGreaterThan(1);
    }
  });
  it.each([-1, NaN, Infinity, 1.5, 0x100000000])('rejects invalid seed %s', seed => expect(() => buildSequence(BANK, seed)).toThrow('INVALID_SEQUENCE_SEED'));
  it('rejects incorrect chains, duplicate options, cancellation and same-operation high loads', () => {
    const base = structuredClone(BANK.items[0]!);
    expect(itemSchema.safeParse({ ...base, answer: 11 }).success).toBe(false);
    expect(itemSchema.safeParse({ ...base, options: [10, 10, 10, 10] }).success).toBe(false);
    expect(itemSchema.safeParse({ ...base, load: 2, ops: [{ op: 'suma', n: 3 }, { op: 'resta', n: 3 }], intermediates: [10], answer: 7 }).success).toBe(false);
    expect(itemSchema.safeParse({ ...base, load: 2, ops: [{ op: 'suma', n: 1 }, { op: 'suma', n: 2 }], intermediates: [8] }).success).toBe(false);
  });
  it('rejects wrong IDs, altered balance and unknown fields instead of trusting version alone', () => {
    const bank = structuredClone(BANK);
    expect(bankSchema.safeParse({ ...bank, extra: true }).success).toBe(false);
    const items = bank.items.map(item => ({ ...item }));
    items[0] = { ...items[0]!, id: 'M2-1' };
    expect(bankSchema.safeParse({ ...bank, items }).success).toBe(false);
    expect(bankSchema.safeParse({ ...bank, items: bank.items.slice(1) }).success).toBe(false);
  });
});
