# Modelo académico (ERD propuesto)

| Tabla | Atributos y tipos explícitos | Cardinalidad / límites |
| --- | --- | --- |
| `groups` | `id UUID PK`, `teacher_id UUID FK`, `name VARCHAR(50)`, `grade VARCHAR(20)`, `school_year INT` | usuario 1:N grupos; grupo 1:N estudiantes, asignaciones. |
| `students` | `id UUID PK`, `group_id UUID FK`, `student_code VARCHAR(50) UNIQUE`, `first_name/last_name VARCHAR(100)`, `is_active BOOLEAN` | estudiante 1:N observaciones/notas/sesiones/indicadores; 1:1 consentimiento según ERD. |
| `informed_consents` | `id UUID PK`, `student_id UUID FK UNIQUE`, `status ENUM(APROBADO,PENDIENTE,RECHAZADO)`, `r2_file_key VARCHAR(255)`, `file_hash_sha256 VARCHAR(64)`, `signed_at DATE` | V3 RF-008 añade recepción, vigencia/revocación, quién registra, no modelados aquí. |
| `academic_notes` | `id UUID PK`, `student_id UUID FK`, `teacher_id UUID FK`, `subject ENUM(LENGUAJE,MATEMATICAS)`, `term INT` (nota 1–4), `score NUMERIC(3,2)` | estudiante/docente 1:N notas; V3 pide autor y fecha de actualización, escala/unicidad por definir. |

**Advertencia:** D §2.2 p. 6 pide nombre/documento/grado y estado PENDIENTE_CONSENTIMIENTO, no presentes como columnas de `students`; ERD solo student_code e is_active. La revocación requiere historia pese a 1:1. Sin nulabilidad general documentada. [DBML líneas 44–87 y 156–162](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml); [V3 RF-005…009](../../../original/requisitos_V3.xlsx); [D pp. 5–6](../../../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf).
