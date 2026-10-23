# RF-017 (V3, propuesta): calcular indicadores de tareas

## Aplicación a este backend

**Diseño no implementado.** Evolución procesa evidencia que conserva Tareas, no implementa los juegos ni crea un segundo endpoint de captura de sus eventos. V3 prevé cálculo backend; si el proveedor envía indicadores ya calculados, acordar en IN-01 qué se recibe, valida/recalcula y conserva como evidencia antes de cambiar esa responsabilidad.

**Bloqueos EV-01/EV-02:** ficha aprobada, tolerancia/redondeo/unidades y regla de recálculo/versionado. Una fila del ERD contiene varias métricas; el 1:1 no contradice por sí mismo varias fórmulas. Faltan cobertura/condiciones/versiones: elegir modelo al especificar sin confundir fila con un único indicador.

**Pruebas backend:** referencias por tarea, datos insuficientes y denominador cero, incidencias específicas, práctica/cierre sin medida cognitiva, recálculo consistente y evidencia original inalterada. No prometer que cada sesión incompleta impide todos los cálculos ni que toda completada los habilita. Ver [integración](../../../games-integration.md) y [suficiencia](suficiencia.md).

## Flujo original y evidencia

**Actor:** sistema tras sesión con eventos válidos. Propósito: convertir registros en indicadores de su ficha por tarea, sin inventar puntuación global. [V3 RF-017](../../../../original/requisitos_V3.xlsx), [F §5 pp. 42–50](../../../../original/Fundamento%20teorico.docx.pdf), [procesamiento JPEG](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/M%C3%B3dulo%20tareas%20Digitales/Diagrama%20de%20Actividades%20%E2%80%94%20Procesamiento%20de%20resultados.jpeg).

**Secuencia:** consumir eventos y condiciones → [validar suficiencia](suficiencia.md) → aplicar solo fórmula de tarea aprobada → guardar valor/unidad con estudiante, tarea, sesión, fecha, versión de configuración y regla → permitir rastrear eventos originarios → ofrecer datos al consumidor docente. Entradas: ensayos, respuestas/tiempos y condiciones del [modelo de tareas](../../tareas/domain-model.md); fórmulas/denominadores en [modelo de evolución](../domain-model.md). **Alterno:** entradas requeridas inválidas/incompletas o denominador cero → estado no disponible con motivo para el indicador afectado, no cero artificial. **Verificación:** conjuntos de referencia con tolerancia *a definir* coinciden; recalcular no duplica resultados activos; práctica/cierre no calculan indicador cognitivo. Probar TG-01…05, incidente técnico, faltantes y versión distinta. ERD carece de cobertura/versionado suficiente: [pendientes](../../../unresolved-issues.md). No se ha definido endpoint público de cálculo.
