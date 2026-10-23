# RF-019 (V3, propuesta): aviso pedagógico

## Aplicación a este backend y al consumidor

**Regla metodológica vigente en constitución I; feature de presentación no implementada aquí.** V3 asigna este RF al frontend. El consumidor docente muestra el aviso en vistas/reportes; Evolución/Seguimiento entregan valores/contexto/limitaciones y no generan etiquetas clínicas ni puntuación global. Esta API no renderiza banners y no hay motivo para crear un endpoint solo para un texto estático.

**Antes de cerrar contrato:** acordar cómo el consumidor obtiene avisos y disponibilidad sin duplicar textos/versiones contradictorios. Exportación/reportes no quedan aprobados por mencionarse en este RF (TR-01). El aviso no legitima una fórmula sin suficiencia ni sustituye autorización.

**Pruebas:** backend sin diagnósticos, rankings ni cero artificial; pruebas visuales coordinadas con frontend para aviso persistente y etiquetas. La gamificación del otro servicio permanece separada de la interpretación pedagógica.

## Comportamiento original de plataforma y evidencia

**Resultado:** todas las vistas/reportes con indicadores comunican que son información complementaria para seguimiento docente y no diagnóstico clínico; no generan categorías clínicas. [V3 RF-019](../../../../original/requisitos_V3.xlsx), [A CU04/05 pp. 33–35](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [F §§2.9, 6.15–6.20 pp. 14, 59–60](../../../../original/Fundamento%20teorico.docx.pdf).

**Flujo:** generar resultado contextual desde [cálculo](calculo.md) → al renderizar panel o reporte añadir aviso visible → conservarlo al filtrar/exportar → expresar resultados observados por tarea/condición, sin etiquetas normal/anormal, déficit, riesgo, mejor/peor ni semáforos cognitivos. D §2.2 p. 7 propone un banner permanente, texto literal allí pero su RF-020 es de otra versión; [conflictos](../../../unresolved-issues.md). **Pruebas/aceptación:** inspeccionar vista individual, grupal, filtro, datos insuficientes y reporte; el aviso no desaparece, ni aparece diagnóstico automático. Dependencias [Seguimiento](../../seguimiento/module-summary.md) y diseño de reportes por aprobar. Sin contrato API.
