# Registros del seguimiento

**Estado:** diseño no implementado. Seguimiento escribe observaciones/anotaciones; ficha, notas e indicadores son lecturas de otros módulos. Un DTO de panel no autoriza escrituras directas sobre sus tablas.

| Elemento | Campos explicitados / relaciones | Límite |
| --- | --- | --- |
| `teacher_observations` ERD | `id UUID PK`, `student_id/teacher_id UUID FK`, `category VARCHAR(100)`, `qualitative_scale VARCHAR(50)`, `observation_text TEXT`, `created_at TIMESTAMP`; estudiante y docente 1:N. | V3 RF-023 añade periodo, escala aprobada; no se especifican valores ni ediciones temporales. |
| Anotación cualitativa V3 RF-025 / A CU06 | estudiante, docente/autor, fecha y contenido obligatorio; se distingue de observación e indicador. | No tiene tabla ERD ni tipo/longitud definidos. |
| Ficha/panel | `IndividualDashboardDto` PUML: `studentInfo`, `cognitiveIndicators[]`, `teacherObservations[]`, `academicNotes[]`. | DTO de diseño, no contrato HTTP ni exposición irrestricta. |

Integrar no significa sumar notas académicas y puntuaciones digitales en una calificación. [DBML líneas 61–79](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml), [V3 RF-021…025](../../../original/requisitos_V3.xlsx), [A CU06 pp. 35–36](../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [PUML](../../../original/C4/UML/moduloSeguimiento.puml).

## Diferencias que debe preservar la API

- **Observación estructurada:** conducta/categoría y valor de escala aprobada; autor, fecha, periodo y estudiante. No inferir la escala individual desde el instrumento de observación grupal del analista.
- **Anotación cualitativa:** texto contextual, autor/fecha/estudiante; no cambia una observación ni un indicador. Persistencia, longitud y edición requieren diseño propio.
- **Nota académica:** valor institucional de Académico por área/periodo, no registro de Seguimiento.
- **Indicador:** valor/motivo, unidad y condiciones de Evolución; conservar su traza al componer una respuesta.
- **Incidencia/recorrido:** condición técnica/operativa de Tareas, no una observación de comportamiento ni fallo cognitivo.

Definir ID de autor compatible con Usuarios, fecha de creación/edición, permiso para correcciones y respuesta por fila de matriz. La matriz reutiliza observaciones; no necesita por defecto otra tabla de «observaciones grupales». Acordar duplicados y atomicidad sin deducirlos de la interfaz.

Para consultas nuevas precisar filtros, periodo/año, orden/paginación, permiso y datos expuestos, unidad/condición y diferencia entre ausencia de registros, no disponibilidad y error. Agregados grupales requieren metodología y volumen/calidad acordados, no promediar métricas heterogéneas. El frontend renderiza gráficos/aviso; este backend devuelve datos suficientes y no conclusiones clínicas. Ver [límites](../../module-boundaries.md).
