import { CONFIG, scoreTrial } from '../tareas/runtime/tg07/sequence.js';

export const RULE = { code: 'TG07-DESCRIPTIVE-1', version: 1, minimumRtOverall: CONFIG.minRtForStats,
  minimumRtByLength: 1, varianceDivisor: 'n', decimalPlaces: 1 } as const;

// Internal calculation input. The runtime boundary must validate the envelope before dispatching.
export type Trial = {
  trial: number; sequence: readonly number[]; valid: boolean; invalidReason: string | null;
  closureReason: 'response' | 'timeout' | 'interruption'; responseOpenedAtMs: number | null;
  responses: readonly { drum: number; atMs: number }[]; earlyTaps: readonly { drum: number; atMs: number }[];
};
type MissingReason = 'NO_VALID_TRIALS' | 'NO_CORRECT_TRIALS' | 'INSUFFICIENT_LENGTH_DATA' |
  'INSUFFICIENT_RT_DATA' | 'ZERO_MEAN_RT' | 'METHOD_NOT_APPROVED';
export type Indicator = {
  metricCode: string; scope: string; status: 'CALCULATED' | 'NOT_AVAILABLE'; value: number | null;
  unit: '%' | 'ms' | 'points' | 'count'; numerator: number | null; denominator: number | null;
  sampleSize: number; unavailabilityReason: MissingReason | null;
};
const round = (value: number) => Math.round(value * 10) / 10;
const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b), middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

export function calculate(envelope: { events: readonly Trial[] }, methodAllowed: boolean) {
  const decisions = envelope.events.map(trial => {
    const evaluated = trial.closureReason !== 'interruption' && trial.responseOpenedAtMs !== null;
    const score = evaluated ? scoreTrial(trial.sequence, trial.responses) : { ...scoreTrial([], []), outcome: 'not_evaluated' as const };
    const included = trial.valid && trial.invalidReason === null && evaluated;
    const first = trial.responses[0], last = trial.responses.at(-1);
    const latency = first && trial.responseOpenedAtMs !== null ? first.atMs - trial.responseOpenedAtMs : null;
    const total = last && trial.responseOpenedAtMs !== null ? last.atMs - trial.responseOpenedAtMs : null;
    if (latency !== null && (!Number.isFinite(latency) || latency < 0) || total !== null && (!Number.isFinite(total) || total < 0))
      throw new Error('INVALID_KUD_DICE_TIMING');
    return { trial: trial.trial, length: trial.sequence.length, included,
      reason: included ? null : trial.invalidReason ?? 'NOT_EVALUATED', ...score,
      firstTapLatencyMs: latency === null ? null : round(latency), totalResponseMs: total === null ? null : round(total), earlyTaps: trial.earlyTaps.length };
  });
  const valid = decisions.filter(row => row.included), correct = valid.filter(row => row.outcome === 'correct');
  const indicators: Indicator[] = [];
  function add(metricCode: string, scope: string, value: number | null, unit: Indicator['unit'], sampleSize: number,
    missing: MissingReason | null = null, numerator: number | null = null, denominator: number | null = null) {
    const reason = methodAllowed ? missing : 'METHOD_NOT_APPROVED';
    if (!reason && (value === null || !Number.isFinite(value))) throw new Error('NON_FINITE_KUD_DICE_INDICATOR');
    indicators.push({ metricCode, scope, status: reason ? 'NOT_AVAILABLE' : 'CALCULATED', value: reason ? null : round(value!),
      unit, sampleSize, numerator, denominator, unavailabilityReason: reason });
  }
  function accuracy(rows: typeof valid, scope: string) {
    const hits = rows.filter(row => row.outcome === 'correct').length;
    const positions = rows.reduce((sum, row) => sum + row.length, 0);
    const positionsCorrect = rows.reduce((sum, row) => sum + row.positionsCorrect, 0);
    const missing = rows.length ? null : 'NO_VALID_TRIALS';
    const precision = rows.length ? round(100 * hits / rows.length) : null;
    add('accuracy_pct', scope, precision, '%', rows.length, missing, hits, rows.length);
    add('position_accuracy_pct', scope, positions ? 100 * positionsCorrect / positions : null, '%', rows.length, missing, positionsCorrect, positions);
    return precision;
  }
  accuracy(valid, 'SESSION');
  const lengths = [...new Set(valid.map(row => row.length))].sort((a, b) => a - b);
  const byLength = lengths.map(length => {
    const rows = valid.filter(row => row.length === length), scope = `LENGTH_${length}`;
    const latencies = rows.flatMap(row => row.firstTapLatencyMs === null ? [] : [row.firstTapLatencyMs]);
    const precisionPct = accuracy(rows, scope);
    add('median_first_tap_latency_ms', scope, latencies.length ? median(latencies) : null, 'ms', latencies.length,
      latencies.length ? null : 'INSUFFICIENT_RT_DATA');
    return { length, validTrials: rows.length, correctTrials: rows.filter(row => row.outcome === 'correct').length, precisionPct, rtValidN: latencies.length };
  });
  const first = byLength[0], last = byLength.at(-1);
  // Original subtracts the already rounded per-length percentages.
  add('delta_precision_pts', 'SESSION', byLength.length > 1 ? last!.precisionPct! - first!.precisionPct! : null,
    'points', byLength.length > 1 ? first!.validTrials + last!.validTrials : valid.length,
    byLength.length > 1 ? null : 'INSUFFICIENT_LENGTH_DATA');
  add('longest_correct_length', 'SESSION', correct.length ? Math.max(...correct.map(row => row.length)) : null, 'count', correct.length,
    correct.length ? null : valid.length ? 'NO_CORRECT_TRIALS' : 'NO_VALID_TRIALS');
  const totalPositions = valid.reduce((sum, row) => sum + row.length, 0);
  for (const key of ['orderErrors', 'intrusions', 'repetitions', 'omissions'] as const) {
    const count = valid.reduce((sum, row) => sum + row[key], 0);
    add(key, 'SESSION', count, 'count', valid.length);
    if (key === 'orderErrors') add('order_error_rate_pct', 'SESSION', totalPositions ? 100 * count / totalPositions : null,
      '%', valid.length, totalPositions ? null : 'NO_VALID_TRIALS', count, totalPositions);
  }
  for (const [code, count] of [
    ['valid_trials', valid.length], ['invalid_trials', decisions.length - valid.length], ['correct_trials', correct.length],
    ['total_positions', totalPositions], ['trials_with_order_errors', valid.filter(row => row.orderErrors > 0).length],
    ['incomplete_trials', valid.filter(row => row.outcome === 'incomplete').length],
    ['early_taps', valid.reduce((sum, row) => sum + row.earlyTaps, 0)],
  ] as const) add(code, 'SESSION', count, 'count', valid.length);
  const latencies = valid.flatMap(row => row.firstTapLatencyMs === null ? [] : [row.firstTapLatencyMs]);
  const totals = valid.flatMap(row => row.outcome === 'incomplete' || row.totalResponseMs === null ? [] : [row.totalResponseMs]);
  const enough = latencies.length >= RULE.minimumRtOverall;
  const mean = enough ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : null;
  const sd = mean === null ? null : Math.sqrt(latencies.reduce((sum, value) => sum + (value - mean) ** 2, 0) / latencies.length);
  const missing = enough ? null : 'INSUFFICIENT_RT_DATA';
  add('median_first_tap_latency_ms', 'SESSION', enough ? median(latencies) : null, 'ms', latencies.length, missing);
  add('mean_first_tap_latency_ms', 'SESSION', mean, 'ms', latencies.length, missing);
  add('first_tap_latency_sd_ms', 'SESSION', sd, 'ms', latencies.length, missing);
  add('first_tap_latency_cv_pct', 'SESSION', mean && sd !== null ? 100 * sd / mean : null, '%', latencies.length,
    missing ?? (mean === 0 ? 'ZERO_MEAN_RT' : null));
  add('median_total_response_ms', 'SESSION', totals.length >= RULE.minimumRtOverall ? median(totals) : null, 'ms', totals.length,
    totals.length >= RULE.minimumRtOverall ? null : 'INSUFFICIENT_RT_DATA');
  return { indicators, decisions, summary: { observed: decisions.length, included: valid.length, excluded: decisions.length - valid.length,
    validTrials: valid.length, correctTrials: correct.length, totalPositions, byLength,
    status: !valid.length ? 'insufficient_data' : !correct.length ? 'no_correct_trials' : 'ok' } };
}
