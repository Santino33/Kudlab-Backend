# RF-021 (V3, propuesta): consultar indicadores por dimensiones

## Aplicación a este backend

**Diseño no implementado.** Seguimiento compone consultas de ficha/notas (Académico), recorrido/incidencias (Tareas) e indicadores/historia (Evolución), preservando propiedad/autoría. No escribe resultados originales ni crea una fórmula de promedio global. Las dimensiones organizan, no son puntuaciones únicas.

**Decidir SE-03:** permisos y campos expuestos, filtros/año-periodo, orden/paginación y reglas de agregado. El resumen grupal debe considerar calidad/volumen y ámbito; no promediar indicadores de diferentes condiciones sin metodología. La falta de una fuente no se sustituye por cero ni se presenta como fallo cognitivo.

**Pruebas del API:** profesor ajeno/filtros manipulados, sin registros, indicador no disponible, sesión inválida y fallo de dependencia; fuentes distinguibles y traza a origen. No prometer tolerancia a fallo parcial sin definirla en el contrato. Ver [modelo](../domain-model.md).

## Flujo original de plataforma y evidencia

**Actor:** docente autenticado, solo sus estudiantes. [V3 RF-021](../../../../original/requisitos_V3.xlsx), [A CU04 pp. 33–34 y secuencia p. 46](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [F §6.21 pp. 60–61](../../../../original/Fundamento%20teorico.docx.pdf).

**Pasos:** autorizar docente y estudiante/grupo → integrar observaciones, notas académicas y métricas de tareas por periodo → organizar por dimensión/eje, tarea y área académica → mostrar valor calculado con unidad/condición o estado no disponible/inválido y motivo → aviso pedagógico visible. CU04 admite resumen agregado de grupo cuando aplica. Sin datos → estado vacío; insuficiencia → advertencia sin valor consolidado; error de consulta → informar; fuera de ámbito → denegar. [Modelo](../domain-model.md), [evolución](../../evolucion/module-summary.md).

**Aceptar/probar:** docente ve su historia y agregado autorizado; un resultado inválido no parece cero; tres fuentes no se confunden; otro docente no ve información; mensaje no diagnóstico presente. Probar estudiante sin datos, ejecución afectada, periodo vacío y dos docentes. Sin contrato API documentado; criterio de agregación grupal por acordar.
