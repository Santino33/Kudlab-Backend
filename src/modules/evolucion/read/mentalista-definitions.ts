export const MENTALISTA_METRICS = ['accuracy_pct', 'error_rate_pct', 'omission_rate_pct', 'median_reaction_time_ms', 'mean_reaction_time_ms', 'rt_sd_ms', 'rt_cv_pct', 'delta_precision_pts', 'delta_precision_rel_pct', 'chance_level_pct', 'selection_position_1_count', 'selection_position_2_count', 'selection_position_3_count', 'selection_position_4_count'] as const;
export const MENTALISTA_SCOPES = ['SESSION', 'LOAD_1', 'LOAD_2', 'LOAD_3', 'LOAD_4'] as const;
export const MENTALISTA_REASONS = ['NO_VALID_ITEMS', 'INSUFFICIENT_RT_DATA', 'INSUFFICIENT_LOAD_DATA', 'ZERO_BASELINE', 'LOAD_NOT_REACHED', 'METHOD_NOT_APPROVED', 'TECHNICAL_EXCLUSION', 'ZERO_MEAN_RT'] as const;
const descriptions: Record<typeof MENTALISTA_METRICS[number], [string, string, '%' | 'ms' | 'points' | 'count']> = {
  accuracy_pct: ['Precisión', '100 × respuestas correctas / ítems válidos, incluidas omisiones.', '%'],
  error_rate_pct: ['Error', '100 × respuestas incorrectas / ítems válidos, incluidas omisiones.', '%'],
  omission_rate_pct: ['Omisión', '100 × omisiones / ítems válidos.', '%'],
  median_reaction_time_ms: ['Mediana del tiempo de respuesta', 'Mediana de TR correctos válidos ≥400 ms; mínimo 5 global o 3 por carga.', 'ms'],
  mean_reaction_time_ms: ['Media del tiempo de respuesta', 'Suma de TR correctos válidos ≥400 ms / n; mínimo 5 global o 3 por carga.', 'ms'],
  rt_sd_ms: ['Desviación del tiempo de respuesta', 'Raíz de la media de diferencias cuadradas respecto a la media, divisor n; mínimo 5 TR global o 3 por carga.', 'ms'],
  rt_cv_pct: ['Variabilidad relativa del tiempo de respuesta', '100 × desviación poblacional / media de TR; mínimo 5 global o 3 por carga.', '%'],
  delta_precision_pts: ['Diferencia de precisión entre cargas', 'Precisión de carga 4 menos carga 1; mínimo 2 válidos en cada extremo.', 'points'],
  delta_precision_rel_pct: ['Diferencia relativa de precisión', '100 × diferencia de precisión / precisión carga 1; mínimo 2 válidos por extremo y base no cero.', '%'],
  chance_level_pct: ['Referencia de azar', '25% por cuatro opciones; referencia, no puntuación personal ni corrección por azar.', '%'],
  selection_position_1_count: ['Selecciones en posición 1', 'Número de selecciones válidas de la primera opción.', 'count'],
  selection_position_2_count: ['Selecciones en posición 2', 'Número de selecciones válidas de la segunda opción.', 'count'],
  selection_position_3_count: ['Selecciones en posición 3', 'Número de selecciones válidas de la tercera opción.', 'count'],
  selection_position_4_count: ['Selecciones en posición 4', 'Número de selecciones válidas de la cuarta opción.', 'count'],
};
export const MENTALISTA_DEFINITIONS = MENTALISTA_METRICS.map((metricCode, index) => ({
  metricCode, taskId: 'TG-03' as const, label: descriptions[metricCode][0], description: descriptions[metricCode][1],
  calculation: descriptions[metricCode][1], unit: descriptions[metricCode][2], scopes: index < 7 ? [...MENTALISTA_SCOPES] : ['SESSION' as const],
  inputs: 'Ítems de medición válidos del banco 1.0.0. TR desde opciones hasta primera respuesta correcta no anticipatoria.',
  unavailabilityReasons: [...MENTALISTA_REASONS], exclusions: 'Práctica, entradas extra, ítems incompletos e incidencias técnicas excluidos. Anticipatorias <400 ms cuentan en precisión, no en TR. No implica equivalencia entre sesiones ni diagnóstico.',
}));
