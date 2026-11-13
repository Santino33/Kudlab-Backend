import { BANK, LOADS } from '../tareas/runtime/tg03/bank.js';
import type { Envelope, Trial } from '../tareas/runtime/tg03/contract.js';

export const RULE = {
  code: 'TG03-DESCRIPTIVE-1', version: 1, rtPopulation: 'VALID_CORRECT_NON_ANTICIPATORY',
  anticipatoryMs: 400, varianceDivisor: 'n', minimumRtOverall: 5, minimumRtByLoad: 3, minimumValidForDelta: 2,
  precisionPopulation: 'VALID_RESOLVED_ITEMS_INCLUDING_OMISSIONS', deltaLoads: [1, 4],
  technicalIncidents: ['focus_lost', 'visibility_lost', 'script_error', 'storage_failure', 'frame_gap', 'layout_changed', 'resource_error', 'evidence_limit'],
} as const;
export type MissingReason = 'NO_VALID_ITEMS' | 'INSUFFICIENT_RT_DATA' | 'INSUFFICIENT_LOAD_DATA' | 'ZERO_BASELINE' |
  'LOAD_NOT_REACHED' | 'METHOD_NOT_APPROVED' | 'TECHNICAL_EXCLUSION' | 'ZERO_MEAN_RT';
export type Indicator = {
  metricCode: string; scope: string; status: 'CALCULATED' | 'NOT_AVAILABLE'; value: number | null;
  unit: '%' | 'ms' | 'points' | 'count'; numerator: number | null; denominator: number | null; sampleSize: number;
  unavailabilityReason: MissingReason | null;
};
type Outcome = 'correct' | 'incorrect' | 'omission' | 'not_evaluated';
export type Decision = {
  trial: number; itemId: string; load: number; included: boolean; rtIncluded: boolean;
  reason: 'TECHNICAL_EXCLUSION' | 'NOT_EVALUATED' | null; result: Outcome; correctAnswer: number;
  selectedAnswer: number | null; diff: number | null; rtMs: number | null; anticipatory: boolean;
};
type Counts = {
  nPlanned: number; nObserved: number; nPresented: number; nValid: number; nCorrect: number; nIncorrect: number;
  nOmission: number; nAnticipatory: number; nRt: number;
};

export function calculate(envelope: Pick<Envelope, 'events' | 'incidents'>, methodAllowed: boolean) {
  const decisions: Decision[] = envelope.events.map(trial => {
    const item = BANK.items.find(item => item.id === trial.itemId);
    if (!item || item.load !== trial.load) throw new Error('UNKNOWN_MENTALISTA_ITEM');
    const technical = envelope.incidents.some(incident => incident.category !== 'CONTEXT_ONLY' && incident.atMs !== null &&
      RULE.technicalIncidents.some(type => type === incident.type) && incident.atMs < trial.closedAtMs &&
      (incident.endedAtMs ?? trial.closedAtMs) >= trial.startedAtMs);
    const resolved = trial.optionsShownAtMs !== null && trial.closureReason !== 'interruption';
    const result: Outcome = !resolved ? 'not_evaluated' : trial.closureReason === 'timeout' ? 'omission' : trial.selectedIdx === item.correctIdx ? 'correct' : 'incorrect';
    const selectedAnswer = trial.selectedIdx === null ? null : item.options[trial.selectedIdx]!;
    const rtMs = trial.optionsShownAtMs !== null && trial.selectedAtMs !== null ? trial.selectedAtMs - trial.optionsShownAtMs : null;
    const anticipatory = rtMs !== null && rtMs < RULE.anticipatoryMs;
    const included = resolved && !technical;
    return { trial: trial.trial, itemId: item.id, load: item.load, included, rtIncluded: included && result === 'correct' && !anticipatory && rtMs !== null,
      reason: technical ? 'TECHNICAL_EXCLUSION' : included ? null : 'NOT_EVALUATED', result, correctAnswer: item.answer,
      selectedAnswer, diff: selectedAnswer === null ? null : selectedAnswer - item.answer, rtMs, anticipatory };
  });
  const indicators: Indicator[] = [];
  function add(metricCode: string, scope: string, value: number | null, unit: Indicator['unit'], sampleSize: number,
    missing: MissingReason | null, numerator: number | null = null, denominator: number | null = null) {
    const reason = methodAllowed ? missing : 'METHOD_NOT_APPROVED';
    if (!reason && (value === null || !Number.isFinite(value))) throw new Error('NON_FINITE_MENTALISTA_INDICATOR');
    indicators.push({ metricCode, scope, status: reason ? 'NOT_AVAILABLE' : 'CALCULATED', value: reason ? null : value,
      unit, sampleSize, numerator, denominator, unavailabilityReason: reason });
  }
  function block(trials: readonly Trial[], rows: readonly Decision[], scope: string, nPlanned: number, minRt: number): Counts {
    const valid = rows.filter(row => row.included);
    const count = (result: Outcome) => valid.filter(row => row.result === result).length;
    const rts = rows.filter(row => row.rtIncluded).map(row => row.rtMs!).sort((a, b) => a - b);
    const nValid = valid.length, nCorrect = count('correct'), nIncorrect = count('incorrect'), nOmission = count('omission');
    const counts: Counts = { nPlanned, nObserved: rows.length, nPresented: trials.filter(trial => trial.optionsShownAtMs !== null).length,
      nValid, nCorrect, nIncorrect, nOmission, nAnticipatory: valid.filter(row => row.anticipatory).length, nRt: rts.length };
    const missing: MissingReason | null = nValid ? null : rows.length === 0 && scope !== 'SESSION' ? 'LOAD_NOT_REACHED'
      : rows.some(row => row.reason === 'TECHNICAL_EXCLUSION') ? 'TECHNICAL_EXCLUSION' : 'NO_VALID_ITEMS';
    for (const [metric, n] of [['accuracy_pct', nCorrect], ['error_rate_pct', nIncorrect], ['omission_rate_pct', nOmission]] as const)
      add(metric, scope, nValid ? 100 * n / nValid : null, '%', nValid, missing, n, nValid);
    const rtMissing = missing ?? (rts.length < minRt ? 'INSUFFICIENT_RT_DATA' : null);
    const mean = rts.length ? rts.reduce((sum, value) => sum + value, 0) / rts.length : null;
    const median = rts.length ? rts.length % 2 ? rts[Math.floor(rts.length / 2)]! : (rts[rts.length / 2 - 1]! + rts[rts.length / 2]!) / 2 : null;
    const sd = mean === null ? null : Math.sqrt(rts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / rts.length);
    add('median_reaction_time_ms', scope, median, 'ms', rts.length, rtMissing);
    add('mean_reaction_time_ms', scope, mean, 'ms', rts.length, rtMissing);
    add('rt_sd_ms', scope, sd, 'ms', rts.length, rtMissing);
    add('rt_cv_pct', scope, mean && sd !== null ? 100 * sd / mean : null, '%', rts.length, rtMissing ?? (mean === 0 ? 'ZERO_MEAN_RT' : null));
    return counts;
  }
  const overall = block(envelope.events, decisions, 'SESSION', 12, RULE.minimumRtOverall);
  const byLoad = LOADS.map(load => ({ load, ...block(envelope.events.filter(trial => trial.load === load), decisions.filter(row => row.load === load), `LOAD_${load}`, 3, RULE.minimumRtByLoad) }));
  const lo = byLoad[0]!, hi = byLoad[3]!;
  const enough = lo.nValid >= RULE.minimumValidForDelta && hi.nValid >= RULE.minimumValidForDelta;
  const loPct = lo.nValid ? 100 * lo.nCorrect / lo.nValid : null;
  const delta = enough ? 100 * hi.nCorrect / hi.nValid - loPct! : null;
  add('delta_precision_pts', 'SESSION', delta, 'points', lo.nValid + hi.nValid, enough ? null : 'INSUFFICIENT_LOAD_DATA');
  add('delta_precision_rel_pct', 'SESSION', enough && loPct ? 100 * delta! / loPct : null, '%', lo.nValid + hi.nValid,
    !enough ? 'INSUFFICIENT_LOAD_DATA' : loPct === 0 ? 'ZERO_BASELINE' : null);
  add('chance_level_pct', 'SESSION', 25, '%', 0, null);
  const selectionPositionCounts = [0, 1, 2, 3].map(position => decisions.filter(row => row.included && envelope.events.find(trial => trial.trial === row.trial)!.selectedIdx === position).length);
  selectionPositionCounts.forEach((value, index) => add(`selection_position_${index + 1}_count`, 'SESSION', overall.nValid ? value : null,
    'count', overall.nValid, overall.nValid ? null : 'NO_VALID_ITEMS'));
  return { indicators, decisions, summary: { observed: decisions.length, included: overall.nValid, excluded: decisions.length - overall.nValid,
    ...overall, byLoad, selectionPositionCounts, itemBankVersion: BANK.itemBankVersion } };
}
