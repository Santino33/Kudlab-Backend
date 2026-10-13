# Registros del seguimiento

| Elemento | Campos explicitados / relaciones | Límite |
| --- | --- | --- |
| `teacher_observations` ERD | `id UUID PK`, `student_id/teacher_id UUID FK`, `category VARCHAR(100)`, `qualitative_scale VARCHAR(50)`, `observation_text TEXT`, `created_at TIMESTAMP`; estudiante y docente 1:N. | V3 RF-023 añade periodo, escala aprobada; no se especifican valores ni ediciones temporales. |
| Anotación cualitativa V3 RF-025 / A CU06 | estudiante, docente/autor, fecha y contenido obligatorio; se distingue de observación e indicador. | No tiene tabla ERD ni tipo/longitud definidos. |
| Ficha/panel | `IndividualDashboardDto` PUML: `studentInfo`, `cognitiveIndicators[]`, `teacherObservations[]`, `academicNotes[]`. | DTO de diseño, no contrato HTTP ni exposición irrestricta. |

Integrar no significa sumar notas académicas y puntuaciones digitales en una calificación. [DBML líneas 61–79](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml), [V3 RF-021…025](../../../original/requisitos_V3.xlsx), [A CU06 pp. 35–36](../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [PUML](../../../original/C4/UML/moduloSeguimiento.puml).
