# Indicadores y fórmulas documentadas

ERD: `calculated_indicators(id UUID PK, session_id UUID FK UNIQUE, student_id UUID FK, sufficiency_status ENUM(CALCULADO,NO_DISPONIBLE), insufficiency_reason VARCHAR(255), accuracy_pct NUMERIC(5,2), omission_rate_pct NUMERIC(5,2), commission_rate_pct NUMERIC(5,2), median_reaction_time_ms INT, rt_variability_sd NUMERIC(6,2), dual_task_cost_pct NUMERIC(5,2))`; sesión 1:1 indicador y estudiante 1:N. La tabla no cubre todas las métricas ni versión/fórmula/condición exigidas en V3 RF-017/020; `sufficiency_logs` del PUML no está en ERD. [DBML líneas 140–152, 169–170](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml), [PUML](../../../original/C4/UML/moduloEvolucion.puml).

| Tarea | Definición sustentada (solo sobre datos válidos; ×100 para porcentajes) |
| --- | --- |
| TG-01 | precisión = aciertos/objetivos válidos; omisión = omisiones/objetivos válidos; comisión = comisiones/distractores válidos. Mediana de TR, variabilidad SD o CV=SD/media ×100; desempeño por segmento opcional si duración suficiente. [F §5.5 pp. 44–45](../../../original/Fundamento%20teorico.docx.pdf). |
| TG-02 | precisión = respuestas correctas/ítems válidos; error = incorrectas/ítems válidos; TR y desempeño según dificultad. F §5.6 p. 46. |
| TG-03 | precisión = correctas/ítems válidos; por carga (pasos); diferencia = precisión de carga mayor − precisión de carga menor; TR. F §5.7 pp. 46–47. |
| TG-04 | secuencia exacta, precisión por longitud, máxima longitud correcta bajo condiciones definidas; omisiones, intrusiones, repeticiones y errores de orden; método exacto de tasa pendiente. F §5.8 pp. 47–48. |
| TG-05 | precisión matemática = correctas/ítems válidos; precisión visual = detectados/objetivos válidos; cambio descriptivo entre condiciones; DTC = (individual − dual)/individual ×100 **solo con denominador válido y métrica apropiada**; TR por demanda cuando se pueda aislar. F §5.9 pp. 48–49. |

No hay fórmula de umbral universal ni fórmula aprobada para «índice global»; no inventar. Sin estímulo/respuesta válido o si la incidencia afecta medición → dato no disponible y motivo, nunca cero. F §5.12 p. 50 y V3 RF-018. [Tareas: datos crudos](../tareas/domain-model.md).
