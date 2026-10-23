# TG-01: Lluvia de estrellas (~2 min)

## Responsabilidad local y externa

**Ficha metodológica, no juego implementado aquí.** El servicio externo presenta estrella/luna y captura acciones/tiempos locales; Tareas conserva evidencia y condiciones; Evolución valida ensayos y deriva indicadores según ficha aprobada. No calcular el TR con la hora de recepción del API.

**Datos necesarios para acordar:** ensayo/objetivo o distractor, presentación y ventana válida, respuesta o ausencia, incidencia, segmento/carga y versión. `is_correct` aislado no permite reconstruir todos los denominadores ni diferenciar omisión de fallo de captura. No asumir el payload mínimo del ERD como contrato suficiente.

**Verificación backend:** eventos trazables/deduplicados; en Evolución objetivos y distractores tienen denominadores distintos, sin dato válido se informa motivo y no cero. Velocidad/frecuencia/segmentación y mínimos siguen sujetos a ficha/pilotaje, no al tiempo aproximado del título. Ver [integración](../../../games-integration.md) y [suficiencia](../../evolucion/features/suficiencia.md).

## Mecánica y evidencia original (servicio de juegos)

**Objetivo:** observar atención sostenida y control de respuesta (Go/No-Go adaptado); no prueba diagnóstica. Estudiante tras TG-00. [F ficha TG-01 pp. 25–28; §5.5 pp. 44–45](../../../../original/Fundamento%20teorico.docx.pdf).

**Secuencia:** presentar sucesivamente estímulos visuales móviles → tocar estrella (objetivo) y no tocar luna (distractor) → registrar respuesta/inhibición y pasar al siguiente ensayo. Dificultad puede variar por velocidad/frecuencia sin etiquetar desempeño. **Variables:** objetivos/distractores válidos presentados, aciertos, omisiones (objetivo sin respuesta en ventana válida), comisiones (luna tocada), TR, número/segmento del ensayo, duración de estímulo, carga, marca temporal y dispositivo. **Indicadores:** precisión=aciertos/objetivos válidos ×100; omisión=omisiones/objetivos válidos ×100; comisión=comisiones/distractores válidos ×100; mediana/variabilidad de TR y segmentos si suficientes datos. [F §5.5](../../../../original/Fundamento%20teorico.docx.pdf), [fórmulas](../../evolucion/domain-model.md).

**Excepciones/aceptación:** estímulo/ventana fallida o incidencia → no contar como omisión; ausencia de denominador → no disponible, nunca cero. Probar toques de estrella/luna, no respuesta con ventana válida, incidencia técnica, tramo de tiempo y dos cargas. Limitar interpretaciones: un error/omisión no indica déficit/TDAH; contexto (fatiga, dispositivo, comprensión) visible. [Reglas comunes](../module-summary.md), [suficiencia](../../evolucion/features/suficiencia.md).
