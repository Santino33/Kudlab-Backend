# TG-04: Recuerda y repite (~2–3 min)

## Responsabilidad local y externa

**Ficha metodológica, no juego implementado aquí.** El servicio externo presenta secuencia y captura orden definitivo; Tareas conserva evidencia; Evolución interpreta errores de orden/omisión/intrusión/repetición según reglas aprobadas. El máximo alcanzado no es un span estandarizado.

**Datos necesarios para acordar:** secuencia/longitud presentada y elegida, orden, ítem/versión/carga, respuesta final, tiempos/incidencias. ERD `is_correct`/`reaction_time_ms` no representa por sí solo esas secuencias. No perder el orden al persistir ni inventar tasas cuyo denominador no esté definido (EV-01).

**Verificación backend:** exactitud vs permutación, elemento extra/omitido/repetido y evidencia inválida son distinguibles según ficha. Las restricciones de selección de la UI no autorizan corregir silenciosamente datos recibidos ni fabricar un cero. Ver [integración](../../../games-integration.md).

## Mecánica y evidencia original (servicio de juegos)

**Objetivo:** recordar secuencia verbal inmediata en orden, sin manipulación matemática ni inferencia de capacidad general estandarizada. [F ficha TG-04 pp. 33–35, §5.8 pp. 47–48](../../../../original/Fundamento%20teorico.docx.pdf).

**Pasos:** Kud presenta palabras una por una, cada una desaparece → se presentan mezcladas → estudiante selecciona en orden y ve secuencia construida → envía. Una palabra seleccionada queda fijada durante intento; longitud puede crecer progresivamente. Palabras familiares/comparables en longitud, evitar similitud fonológica extrema/asociaciones. **Registrar:** secuencia/longitud, palabras presentadas/elegidas, orden, corrección, errores de orden, omisiones, intrusiones/sustituciones, repeticiones, tiempo, dificultad, intento y dispositivo. **Indicadores:** secuencia correcta según criterio por definir, precisión por longitud, mayor longitud exacta alcanzada, errores de orden, patrones de omisión/intrusión/repetición y tiempo. No llamar «span estandarizado» al máximo.

**Aceptación/pruebas:** reproducción exacta se distingue de mismas palabras en orden diferente; selección fijada no se reordena; omisión/intrusión/repetición distinguibles; sin ensayos suficientes no asignar cero. Probar longitud corta/larga, permutación, elemento extra y fallo técnico. Método formal de tasas por aprobar; [modelo](../domain-model.md), [indicadores](../../evolucion/domain-model.md).
