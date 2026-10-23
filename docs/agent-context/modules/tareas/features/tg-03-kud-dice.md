# TG-03: Kud dice (~2 min)

## Responsabilidad local y externa

**Ficha metodológica, no juego implementado aquí.** El servicio externo presenta/desvanece instrucciones y captura resultado definitivo; Tareas conserva secuencia/condiciones; Evolución procesa precisión por carga y tiempos. No desarrollar teclado ni clasificar errores automáticamente como memoria o cálculo.

**Datos necesarios para acordar:** ítem/versión, valor inicial, operaciones/pasos, respuesta y referencia esperada, marcas temporales, carga, dispositivo pertinente e incidencias. Los pasos de ejemplo no fijan un banco ni rango permitido; aprobar parámetros. `memorySpan` y `semanticTaskScore` del PUML no justifican añadir esas medidas a TG-03.

**Verificación backend:** condición/carga trazables, versión correcta, reenvíos y fallo de captura diferenciados. Evolución contrasta fórmulas/referencias y diferencia mayor−menor carga, sin inferencias causales. El ocultamiento de instrucciones se prueba en el servicio externo. Ver [integración](../../../games-integration.md).

## Mecánica y evidencia original (servicio de juegos)

**Objetivo:** registrar mantenimiento/manipulación de información bajo instrucciones matemáticas, no aislar causas de error. [F ficha TG-03 pp. 30–33, §5.7 pp. 46–47](../../../../original/Fundamento%20teorico.docx.pdf).

**Pasos:** Kud presenta valor inicial y operaciones sucesivas una por una; cada instrucción desaparece antes de la siguiente → estudiante mantiene resultado intermedio y opera → ingresa resultado final por teclado/campo numérico → envía respuesta definitiva (no editable). Ejemplo ilustrativo F: 5 + 3 − 2; no es banco de ítems. La carga varía principalmente por número de pasos; rangos y selección de operaciones definitivos no se especifican. **Registrar:** ítem, valor inicial, cantidad/secuencia de operaciones, solución esperada, respuesta final, corrección, TR, carga, intento y dispositivo. **Indicadores:** precisión=correctas/ítems válidos ×100; precisión por carga; diferencia entre cargas (mayor − menor), tiempo y variabilidad si datos válidos. [F §5.7](../../../../original/Fundamento%20teorico.docx.pdf).

**Verificación:** secuencia no expone simultáneamente instrucciones previas; respuesta irrevocable; variación de pasos queda asociada al resultado; errores no se etiquetan automáticamente «de memoria» ni «de cálculo»; fallo de captura/denominador → no disponible. Pruebas: resultado correcto/incorrecto, respuesta repetida, 1 vs varios pasos, incidencia. Dependencias [práctica](tg-00-practica.md), [cálculo](../../evolucion/features/calculo.md).
