export const KUD_DICE_METRICS = ['accuracy_pct', 'position_accuracy_pct', 'delta_precision_pts', 'longest_correct_length', 'orderErrors', 'intrusions', 'repetitions', 'omissions', 'order_error_rate_pct', 'valid_trials', 'invalid_trials', 'correct_trials', 'total_positions', 'trials_with_order_errors', 'incomplete_trials', 'early_taps', 'median_first_tap_latency_ms', 'mean_first_tap_latency_ms', 'first_tap_latency_sd_ms', 'first_tap_latency_cv_pct', 'median_total_response_ms'] as const;
export const KUD_DICE_SCOPES = ['SESSION', 'LENGTH_2', 'LENGTH_3', 'LENGTH_4', 'LENGTH_5', 'LENGTH_6', 'LENGTH_7'] as const;
export const KUD_DICE_REASONS = ['NO_VALID_TRIALS', 'NO_CORRECT_TRIALS', 'INSUFFICIENT_LENGTH_DATA', 'INSUFFICIENT_RT_DATA', 'ZERO_MEAN_RT', 'METHOD_NOT_APPROVED'] as const;
export const KUD_DICE_LENGTH_METRICS: readonly string[] = ['accuracy_pct', 'position_accuracy_pct', 'median_first_tap_latency_ms'];
const descriptions: Record<typeof KUD_DICE_METRICS[number], [string, string, '%' | 'ms' | 'points' | 'count']> = {
  accuracy_pct: ['Precisión de secuencias', '100 × ensayos correctos / ensayos válidos.', '%'],
  position_accuracy_pct: ['Precisión por posición', '100 × posiciones correctas / posiciones de ensayos válidos.', '%'],
  delta_precision_pts: ['Diferencia de precisión', 'Precisión redondeada de la última longitud observada menos la primera; requiere dos longitudes.', 'points'],
  longest_correct_length: ['Mayor longitud correcta', 'Mayor longitud con un ensayo válido correcto; descriptivo, no span estandarizado.', 'count'],
  orderErrors: ['Errores de orden', 'Posiciones con un tambor presente en la secuencia, fuera de su posición y sin repetición inmediata.', 'count'],
  intrusions: ['Intrusiones', 'Posiciones con un tambor ausente de la secuencia, sin repetición inmediata.', 'count'],
  repetitions: ['Repeticiones', 'Posiciones incorrectas que repiten el tambor de la respuesta anterior.', 'count'],
  omissions: ['Omisiones', 'Posiciones sin respuesta en ensayos válidos cerrados.', 'count'],
  order_error_rate_pct: ['Tasa de errores de orden', '100 × errores de orden / posiciones de ensayos válidos.', '%'],
  valid_trials: ['Ensayos válidos', 'Número de ensayos evaluados y válidos.', 'count'],
  invalid_trials: ['Ensayos excluidos', 'Número de ensayos observados no incluidos, también los interrumpidos sin evaluar.', 'count'],
  correct_trials: ['Ensayos correctos', 'Número de ensayos válidos con todas sus posiciones correctas.', 'count'],
  total_positions: ['Posiciones evaluadas', 'Suma de longitudes de los ensayos válidos.', 'count'],
  trials_with_order_errors: ['Ensayos con error de orden', 'Número de ensayos válidos con al menos un error de orden.', 'count'],
  incomplete_trials: ['Ensayos incompletos', 'Número de ensayos válidos cerrados con posiciones sin responder.', 'count'],
  early_taps: ['Toques prematuros', 'Número de toques anteriores a la apertura de respuesta en ensayos válidos.', 'count'],
  median_first_tap_latency_ms: ['Mediana de latencia inicial', 'Mediana del tiempo hasta el primer toque; mínimo tres muestras globales o una por longitud, con n visible.', 'ms'],
  mean_first_tap_latency_ms: ['Media de latencia inicial', 'Suma de latencias al primer toque / n; mínimo tres muestras.', 'ms'],
  first_tap_latency_sd_ms: ['Desviación de latencia inicial', 'Desviación poblacional de latencias al primer toque, divisor n; mínimo tres muestras.', 'ms'],
  first_tap_latency_cv_pct: ['Variabilidad relativa de latencia', '100 × desviación poblacional / media; mínimo tres muestras y media distinta de cero.', '%'],
  median_total_response_ms: ['Mediana del tiempo total', 'Mediana desde apertura hasta último toque en respuestas completas válidas; mínimo tres muestras.', 'ms'],
};
export const KUD_DICE_DEFINITIONS = KUD_DICE_METRICS.map(metricCode => ({
  metricCode, taskId: 'TG-07' as const, label: descriptions[metricCode][0], description: descriptions[metricCode][1],
  calculation: descriptions[metricCode][1], unit: descriptions[metricCode][2], scopes: KUD_DICE_LENGTH_METRICS.includes(metricCode) ? [...KUD_DICE_SCOPES] : ['SESSION' as const],
  inputs: 'Secuencias y toques de medición; latencias desde la apertura de respuesta. Redondeo a un decimal.',
  unavailabilityReasons: [...KUD_DICE_REASONS], exclusions: 'Práctica y ensayos invalidados o interrumpidos no aportan al rendimiento. Toques extra conservados; se puntúan solo las posiciones de la secuencia. Sin diagnóstico ni baremos.',
}));
