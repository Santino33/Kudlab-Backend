import type { Envelope, Trial } from '../tareas/runtime/contract.js';

export const RULE = { code: 'TG01-DESCRIPTIVE-1', version: 1, rtPopulation: 'VALID_HITS', varianceDivisor: 'n', minimumRtForVariability: 2,
  technicalIncidents: ['focus_lost', 'visibility_lost', 'script_error', 'storage_failure', 'frame_gap', 'layout_changed', 'resource_error', 'evidence_limit'] };
export type Indicator = { metricCode: string; scope: string; status: 'CALCULATED' | 'NOT_AVAILABLE'; value: number | null; unit: '%' | 'ms';
  numerator: number | null; denominator: number | null; sampleSize: number; unavailabilityReason: string | null };
export function calculate(e: Envelope, methodAllowed: boolean) {
  const decisions = e.events.map(t => {
    const technical = t.presentedAtMs !== null && e.incidents.some(i => RULE.technicalIncidents.includes(i.type) && i.atMs !== null &&
      i.atMs <= t.closedAtMs && (i.endedAtMs ?? e.timing.finishedAtMs) >= t.presentedAtMs!);
    const included = !technical && t.presentedAtMs !== null && t.result !== 'not_evaluated';
    return { trial: t.trial, included, rtIncluded: included && t.result === 'hit', reason: technical ? 'TECHNICAL_EXCLUSION' : included ? null : 'NOT_EVALUATED' };
  });
  const indicators: Indicator[] = [];
  for (const [index, scope] of ['SESSION', 'SEGMENT_1', 'SEGMENT_2', 'SEGMENT_3'].entries()) {
    const observed = e.events.filter(t => index === 0 || t.segment === index);
    const included = observed.filter(t => decisions.find(d => d.trial === t.trial)!.included);
    const count = (result: Trial['result']) => included.filter(t => t.result === result).length;
    const targets = count('hit') + count('miss'), distractors = count('false_alarm') + count('correct_rejection');
    const rt = included.filter(t => t.result === 'hit').map(t => t.respondedAtMs! - t.presentedAtMs!).sort((a, b) => a - b);
    const mean = rt.reduce((a, b) => a + b, 0) / rt.length;
    const sd = Math.sqrt(rt.reduce((a, b) => a + (b - mean) ** 2, 0) / rt.length);
    const reached = index === 0 || e.timing.finishedAtMs - e.timing.startedAtMs > (index - 1) * 40000;
    function add(metricCode: string, value: number, unit: '%' | 'ms', numerator: number | null, denominator: number | null, sampleSize: number, missing: string | null, population: 'star' | 'moon' | 'rt') {
      const candidates = observed.filter(t => t.presentedAtMs !== null && t.result !== 'not_evaluated' && (population === 'rt' ? t.result === 'hit' : t.stimulus === population));
      const allExcluded = candidates.length > 0 && candidates.every(t => decisions.find(d => d.trial === t.trial)!.reason === 'TECHNICAL_EXCLUSION');
      const reason = !methodAllowed ? 'METHOD_NOT_APPROVED' : !reached ? 'SEGMENT_NOT_REACHED' : allExcluded ? 'TECHNICAL_EXCLUSION' : missing;
      indicators.push({ metricCode, scope, status: reason ? 'NOT_AVAILABLE' : 'CALCULATED', value: reason ? null : value, unit, numerator, denominator, sampleSize, unavailabilityReason: reason });
    }
    add('accuracy_pct', count('hit') / targets * 100, '%', count('hit'), targets, targets, targets ? null : 'NO_VALID_TARGETS', 'star');
    add('omission_rate_pct', count('miss') / targets * 100, '%', count('miss'), targets, targets, targets ? null : 'NO_VALID_TARGETS', 'star');
    add('commission_rate_pct', count('false_alarm') / distractors * 100, '%', count('false_alarm'), distractors, distractors, distractors ? null : 'NO_VALID_DISTRACTORS', 'moon');
    add('median_reaction_time_ms', rt.length % 2 ? rt[Math.floor(rt.length / 2)]! : (rt[rt.length / 2 - 1]! + rt[rt.length / 2]!) / 2, 'ms', null, null, rt.length, rt.length ? null : 'NO_VALID_RT', 'rt');
    const variability = !rt.length ? 'NO_VALID_RT' : rt.length < 2 ? 'INSUFFICIENT_RT_FOR_VARIABILITY' : null;
    add('rt_sd_ms', sd, 'ms', null, null, rt.length, variability, 'rt');
    add('rt_cv_pct', sd / mean * 100, '%', null, null, rt.length, variability ?? (mean === 0 ? 'ZERO_MEAN_RT' : null), 'rt');
  }
  return { indicators, decisions, summary: { observed: e.events.length, included: decisions.filter(d => d.included).length, excluded: decisions.filter(d => !d.included).length } };
}
