// Catálogo descriptivo de los indicadores TG-01 (regla TG01-DESCRIPTIVE-1). Solo describe lo que
// `tg01.ts` ya calcula: no define fórmulas nuevas. Fuente: F §5.5 pp. 44–45.
export const INDICATOR_METRIC_CODES = ['accuracy_pct', 'omission_rate_pct', 'commission_rate_pct', 'median_reaction_time_ms', 'rt_sd_ms', 'rt_cv_pct'] as const;
export const INDICATOR_SCOPES = ['SESSION', 'SEGMENT_1', 'SEGMENT_2', 'SEGMENT_3'] as const;
export const UNAVAILABILITY_REASONS = ['NO_VALID_TARGETS', 'NO_VALID_DISTRACTORS', 'NO_VALID_RT', 'INSUFFICIENT_RT_FOR_VARIABILITY',
  'SEGMENT_NOT_REACHED', 'TECHNICAL_EXCLUSION', 'ZERO_MEAN_RT', 'METHOD_NOT_APPROVED'] as const;
export type IndicatorMetricCode = (typeof INDICATOR_METRIC_CODES)[number];
export type IndicatorScope = (typeof INDICATOR_SCOPES)[number];
export type UnavailabilityReason = (typeof UNAVAILABILITY_REASONS)[number];

export type IndicatorDefinition = {
  metricCode: IndicatorMetricCode; taskId: 'TG-01'; label: string; description: string; calculation: string; unit: '%' | 'ms';
  scopes: readonly IndicatorScope[]; inputs: string; unavailabilityReasons: readonly UnavailabilityReason[]; exclusions: string;
};

const exclusions = 'No cuentan los ensayos sin presentación, los no evaluados ni los afectados por una incidencia técnica de la medición.';
const targetReasons = ['METHOD_NOT_APPROVED', 'SEGMENT_NOT_REACHED', 'TECHNICAL_EXCLUSION', 'NO_VALID_TARGETS'] as const;
const rtReasons = ['METHOD_NOT_APPROVED', 'SEGMENT_NOT_REACHED', 'TECHNICAL_EXCLUSION', 'NO_VALID_RT'] as const;
const variabilityReasons = [...rtReasons, 'INSUFFICIENT_RT_FOR_VARIABILITY'] as const;

export const INDICATOR_DEFINITIONS: readonly IndicatorDefinition[] = [
  { metricCode: 'accuracy_pct', taskId: 'TG-01', label: 'Precisión', unit: '%', scopes: INDICATOR_SCOPES,
    description: 'Porcentaje de estrellas objetivo a las que la persona respondió.',
    calculation: 'Aciertos entre el total de ensayos con estrella válidos (aciertos más omisiones), por cien.',
    inputs: 'Ensayos con estrella presentados y evaluados.', unavailabilityReasons: [...targetReasons], exclusions },
  { metricCode: 'omission_rate_pct', taskId: 'TG-01', label: 'Omisión', unit: '%', scopes: INDICATOR_SCOPES,
    description: 'Porcentaje de estrellas objetivo a las que la persona no respondió.',
    calculation: 'Omisiones entre el total de ensayos con estrella válidos (aciertos más omisiones), por cien.',
    inputs: 'Ensayos con estrella presentados y evaluados.', unavailabilityReasons: [...targetReasons], exclusions },
  { metricCode: 'commission_rate_pct', taskId: 'TG-01', label: 'Comisión', unit: '%', scopes: INDICATOR_SCOPES,
    description: 'Porcentaje de lunas distractoras a las que la persona respondió.',
    calculation: 'Falsas alarmas entre el total de ensayos con luna válidos (falsas alarmas más rechazos correctos), por cien.',
    inputs: 'Ensayos con luna presentados y evaluados.',
    unavailabilityReasons: ['METHOD_NOT_APPROVED', 'SEGMENT_NOT_REACHED', 'TECHNICAL_EXCLUSION', 'NO_VALID_DISTRACTORS'], exclusions },
  { metricCode: 'median_reaction_time_ms', taskId: 'TG-01', label: 'Mediana del tiempo de respuesta', unit: 'ms', scopes: INDICATOR_SCOPES,
    description: 'Valor central de los tiempos de respuesta en los aciertos válidos.',
    calculation: 'Mediana de los tiempos entre la presentación y la respuesta, solo en aciertos válidos.',
    inputs: 'Tiempos de respuesta de aciertos válidos.', unavailabilityReasons: [...rtReasons], exclusions },
  { metricCode: 'rt_sd_ms', taskId: 'TG-01', label: 'Desviación del tiempo de respuesta', unit: 'ms', scopes: INDICATOR_SCOPES,
    description: 'Cuánto se dispersan los tiempos de respuesta en los aciertos válidos.',
    calculation: 'Desviación estándar de esos tiempos, con divisor n (número de aciertos válidos).',
    inputs: 'Al menos dos tiempos de respuesta de aciertos válidos.', unavailabilityReasons: [...variabilityReasons], exclusions },
  { metricCode: 'rt_cv_pct', taskId: 'TG-01', label: 'Variabilidad relativa del tiempo de respuesta', unit: '%', scopes: INDICATOR_SCOPES,
    description: 'Dispersión de los tiempos de respuesta en relación con su promedio.',
    calculation: 'Desviación estándar entre la media de los tiempos, por cien (coeficiente de variación).',
    inputs: 'Al menos dos tiempos de respuesta de aciertos válidos con media distinta de cero.',
    unavailabilityReasons: [...variabilityReasons, 'ZERO_MEAN_RT'], exclusions },
];
