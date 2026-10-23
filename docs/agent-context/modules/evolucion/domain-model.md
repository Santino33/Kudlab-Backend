# Indicadores y fórmulas documentadas

**Estado:** diseño no implementado. Evolución es propietario de fichas/reglas/resultados; los eventos son evidencia de Tareas y no otra colección a duplicar. Las fórmulas documentadas no reemplazan una ficha aprobada ni resuelven el reparto de cálculo con el productor externo.

ERD: `calculated_indicators(id UUID PK, session_id UUID FK UNIQUE, student_id UUID FK, sufficiency_status ENUM(CALCULADO,NO_DISPONIBLE), insufficiency_reason VARCHAR(255), accuracy_pct NUMERIC(5,2), omission_rate_pct NUMERIC(5,2), commission_rate_pct NUMERIC(5,2), median_reaction_time_ms INT, rt_variability_sd NUMERIC(6,2), dual_task_cost_pct NUMERIC(5,2))`; sesión 1:1 indicador y estudiante 1:N. La tabla no cubre todas las métricas ni versión/fórmula/condición exigidas en V3 RF-017/020; `sufficiency_logs` del PUML no está en ERD. [DBML líneas 140–152, 169–170](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml), [PUML](../../../original/C4/UML/moduloEvolucion.puml).

| Tarea | Definición sustentada (solo sobre datos válidos; ×100 para porcentajes) |
| --- | --- |
| TG-01 | precisión = aciertos/objetivos válidos; omisión = omisiones/objetivos válidos; comisión = comisiones/distractores válidos. Mediana de TR, variabilidad SD o CV=SD/media ×100; desempeño por segmento opcional si duración suficiente. [F §5.5 pp. 44–45](../../../original/Fundamento%20teorico.docx.pdf). |
| TG-02 | precisión = respuestas correctas/ítems válidos; error = incorrectas/ítems válidos; TR y desempeño según dificultad. F §5.6 p. 46. |
| TG-03 | precisión = correctas/ítems válidos; por carga (pasos); diferencia = precisión de carga mayor − precisión de carga menor; TR. F §5.7 pp. 46–47. |
| TG-04 | secuencia exacta, precisión por longitud, máxima longitud correcta bajo condiciones definidas; omisiones, intrusiones, repeticiones y errores de orden; método exacto de tasa pendiente. F §5.8 pp. 47–48. |
| TG-05 | precisión matemática = correctas/ítems válidos; precisión visual = detectados/objetivos válidos; cambio descriptivo entre condiciones; DTC = (individual − dual)/individual ×100 **solo con denominador válido y métrica apropiada**; TR por demanda cuando se pueda aislar. F §5.9 pp. 48–49. |

No hay fórmula de umbral universal ni fórmula aprobada para «índice global»; no inventar. Sin estímulo/respuesta válido o si la incidencia afecta medición → dato no disponible y motivo, nunca cero. F §5.12 p. 50 y V3 RF-018. [Tareas: datos crudos](../tareas/domain-model.md).

## Cómo interpretar el modelo sin sobrediseñarlo

El 1:1 de `calculated_indicators` representa **una fila con varias columnas de métricas por sesión**. No demuestra un conflicto con tener varios indicadores. Sí faltan medidas específicas de TG-02…05, condiciones/cargas, versiones y fechas/traza exigidas por V3 RF-017/020. Elegir extensión de columnas o resultados por indicador/condición/versionado al especificar; no imponer una tabla genérica solo por el 1:1.

Para cada resultado, definir identificador de indicador, tarea/estudiante/sesión, condición, valor/unidad o disponibilidad/motivo, versión de configuración/regla y evidencia/procedencia. Es contenido conceptual requerido por V3/F, **no un payload HTTP aprobado**. Si el cálculo viene del otro servicio, registrar productor y versión; no presentarlo como cálculo backend verificado sin contrato.

La suficiencia se decide por indicador: una incidencia puede invalidar un tiempo y no necesariamente todos los conteos. `CALCULADO`/`NO_DISPONIBLE` del ERD no cubre por sí solo ausencia de sesiones, error de procesamiento, sesión inválida o falta de comparabilidad. No mezclar esos conceptos en un único estado ni elegir motivos normalizados sin acordarlos.

Precisar antes del cálculo: selección de ensayos, redondeo/tolerancias, población de tiempos, unidades y denominadores. **F §5.5.5 p. 45, verificado visualmente:** `SD = sqrt(sum((xi - media)^2) / n)` y `CV = SD / media × 100`; la extracción de texto pierde la raíz. No implementar varianza como SD ni cambiar el divisor a `n-1` silenciosamente; confirmar la ficha y controlar denominadores válidos. TG-03 expresa diferencia en puntos porcentuales si se restan porcentajes; no etiquetarla automáticamente como cambio porcentual relativo. DTC no debe reutilizarse indiscriminadamente para tiempos y precisión. No asumir que desconocer duración/umbral obliga a inventar un mínimo universal.

El recálculo debe decidir si sustituye un resultado de la misma versión o conserva revisiones, sin alterar evidencia original ni duplicar valores activos. Comparabilidad temporal es distinta de poder calcular un valor aislado. Ver [pendientes EV-01…03](../../unresolved-issues.md).
