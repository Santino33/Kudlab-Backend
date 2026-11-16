import bank from './items.json' with { type: 'json' };
import { hash } from '../contract.js';
import { buildSequence, CONFIG, originalSequenceHash, REFERENCE_COMMIT } from './sequence.js';

const sequence = buildSequence();
export const PROFILE = Object.freeze({
  ...CONFIG, gameBuildId: 'tg02-palabra-intrusa-1', algorithmVersion: 'original-5ce3bdc',
  referenceCommit: REFERENCE_COMMIT, itemBankVersion: bank.itemBankVersion,
  validationStatus: bank.validationStatus, bankHash: hash(bank),
  sequenceHash: hash(sequence), originalSequenceHash: originalSequenceHash(sequence.seq),
});
