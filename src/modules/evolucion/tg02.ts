import { buildSequence, CONFIG } from '../tareas/runtime/tg02/sequence.js';

export const RULE = { code: 'TG02-DESCRIPTIVE-1', version: 1, minimumRtOverall: 5,
  minimumRtGroup: 3, anticipatoryMs: 400, varianceDivisor: 'n', decimalPlaces: 1 } as const;

// Internal input; the HTTP boundary must validate timing, pauses and identity before dispatch.
export type Trial = {
  trial: number; itemId: string; selectedIdx: number | null; rtMs: number | null;
  valid: boolean; invalidReason: string | null; closureReason: 'response' | 'timeout' | 'interruption';
};
type MissingReason = 'NO_VALID_ITEMS' | 'INSUFFICIENT_RT_DATA' | 'METHOD_NOT_APPROVED';
export type Indicator = {
  metricCode: string; scope: string; status: 'CALCULATED' | 'NOT_AVAILABLE'; value: number | null;
  unit: '%' | 'ms'; numerator: number | null; denominator: number | null;
  sampleSize: number; unavailabilityReason: MissingReason | null;
};
const round = (value: number) => Math.round(value * 10) / 10;
const sequence = buildSequence().seq;

export function calculate(envelope: { events: readonly Trial[] }, methodAllowed: boolean) {
  if (envelope.events.length > sequence.length) throw new Error('INVALID_PALABRA_INTRUSA_SEQUENCE');
  const decisions = envelope.events.map((trial, i) => {
    const reference = sequence[i]!;
    if (trial.trial !== i + 1 || trial.itemId !== reference.item.id) throw new Error('INVALID_PALABRA_INTRUSA_SEQUENCE');
    const responded = trial.closureReason === 'response';
    if (responded ? trial.selectedIdx === null || !Number.isInteger(trial.selectedIdx) || trial.selectedIdx < 0 || trial.selectedIdx > 3 ||
      trial.rtMs === null || !Number.isFinite(trial.rtMs) || trial.rtMs < 0 : trial.selectedIdx !== null || trial.rtMs !== null)
      throw new Error('INVALID_PALABRA_INTRUSA_RESPONSE');
    const rtMs = trial.rtMs === null ? null : round(trial.rtMs);
    const result = responded ? trial.selectedIdx === reference.targetIdx ? 'correct' : 'incorrect' :
      trial.closureReason === 'timeout' ? 'omission' : null;
    const included = trial.valid && trial.invalidReason === null && result !== null;
    return { trial: trial.trial, itemId: trial.itemId, level: reference.item.level, segment: reference.plannedSegment,
      selectedIdx: trial.selectedIdx, rtMs, result, anticipatory: rtMs !== null && rtMs < CONFIG.anticipatoryMs,
      included, reason: included ? null : trial.invalidReason ?? 'NOT_EVALUATED' };
  });
  const indicators: Indicator[] = [];
  function block(rows: typeof decisions, minRt: number, scope: string) {
    const valid = rows.filter(row => row.included);
    const nCorrect = valid.filter(row => row.result === 'correct').length;
    const nIncorrect = valid.filter(row => row.result === 'incorrect').length;
    const nOmission = valid.filter(row => row.result === 'omission').length;
    const rts = valid.filter(row => row.result === 'correct' && !row.anticipatory && row.rtMs !== null).map(row => row.rtMs!);
    const enough = rts.length >= minRt;
    const mean = enough ? rts.reduce((sum, value) => sum + value, 0) / rts.length : null;
    const sd = mean === null ? null : Math.sqrt(rts.reduce((sum, value) => sum + (value - mean) ** 2, 0) / rts.length);
    const sorted = [...rts].sort((a, b) => a - b), middle = sorted.length >> 1;
    const median = enough ? sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2 : null;
    function add(metricCode: string, value: number | null, unit: Indicator['unit'], sampleSize: number,
      missing: MissingReason | null, numerator: number | null = null, denominator: number | null = null) {
      const reason = methodAllowed ? missing : 'METHOD_NOT_APPROVED';
      const rounded = reason || value === null ? null : round(value);
      indicators.push({ metricCode, scope, value: rounded, unit, sampleSize, numerator, denominator,
        status: reason ? 'NOT_AVAILABLE' : 'CALCULATED', unavailabilityReason: reason });
      return rounded;
    }
    const ratio = (code: string, count: number) => add(code, valid.length ? count / valid.length * 100 : null,
      '%', valid.length, valid.length ? null : 'NO_VALID_ITEMS', count, valid.length);
    const timing = (code: string, value: number | null, unit: Indicator['unit'] = 'ms') =>
      add(code, value, unit, rts.length, enough ? null : 'INSUFFICIENT_RT_DATA');
    return { nPresented: rows.length, nValid: valid.length, nCorrect, nIncorrect, nOmission,
      nAnticipatory: valid.filter(row => row.anticipatory).length,
      precisionPct: ratio('accuracy_pct', nCorrect), errorRatePct: ratio('error_rate_pct', nIncorrect),
      omissionRatePct: ratio('omission_rate_pct', nOmission), nRt: rts.length,
      rtMedianMs: timing('median_reaction_time_ms', median), rtMeanMs: timing('mean_reaction_time_ms', mean),
      rtSdMs: timing('rt_sd_ms', sd), rtCvPct: timing('rt_cv_pct', mean && sd !== null ? sd / mean * 100 : null, '%'),
      status: !methodAllowed ? 'method_not_approved' : !valid.length ? 'insufficient_data' : enough ? 'ok' : 'insufficient_rt_data' };
  }
  const selectionPositionCounts = [0, 0, 0, 0];
  for (const row of decisions) if (row.included && row.selectedIdx !== null) selectionPositionCounts[row.selectedIdx]!++;
  const overall = { ...block(decisions, CONFIG.minRtOverall, 'SESSION'), selectionPositionCounts };
  const byLevel = [1, 2, 3].map(level => ({ level, ...block(decisions.filter(row => row.level === level), CONFIG.minRtGroup, `LEVEL_${level}`) }));
  const bySegment = [1, 2, 3].map(segment => ({ segment, ...block(decisions.filter(row => row.segment === segment), CONFIG.minRtGroup, `SEGMENT_${segment}`) }));
  return { indicators, decisions, summary: { formulasRef: 'Fundamento teórico 5.6.1–5.6.4', overall, byLevel, bySegment } };
}
