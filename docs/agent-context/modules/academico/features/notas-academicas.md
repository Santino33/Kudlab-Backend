# RF-009 (V3, propuesta): notas por área y periodo

## Aplicación a este backend

**Diseño no implementado.** Académico escribe y consulta notas escolares de profesores autorizados; Seguimiento las lee sin duplicarlas ni convertirlas en indicadores de juego. No es integración con un sistema académico externo ni una calificación automática calculada por Evolución.

**Bloqueo específico AC-03:** obtener escala institucional, año/periodo, precisión, combinación única y reglas de actualización/corrección. `NUMERIC(3,2)` no significa escala 0–5 ni 0–10; no elegir un rango por conveniencia técnica. La ausencia de escala bloquea esta feature, no toda gestión de participantes/grupos.

**Pruebas del API:** valores límite de escala aprobada, ambas áreas, periodos/años distintos, doble envío, corrección trazable y profesor ajeno. Ver [modelo](../domain-model.md) y [pendientes](../../../unresolved-issues.md).

## Flujo original y evidencia

**Actor:** docente autorizado en su ámbito; resultado: registro y consulta de notas de Lenguaje/Lectura y Matemáticas por periodo escolar. [V3 RF-009](../../../../original/requisitos_V3.xlsx), [D §3.1 p. 8](../../../../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf). Entradas: estudiante, área, periodo, valor, autor y fecha de registro/actualización exigidos por V3. ERD: `academic_notes(student_id, teacher_id, subject ENUM(LENGUAJE,MATEMATICAS), term INT, score NUMERIC(3,2))`; no define escala ni fechas. [Modelo](../domain-model.md).

**Flujo:** seleccionar estudiante propio → elegir periodo y área → ingresar valor → validar escala institucional aprobada y combinación estudiante/área/periodo → guardar o actualizar explícitamente → consultar histórico. Fuera de escala, duplicado sin actualización o estudiante ajeno → rechazo sin cambios. **Verificación:** valor permitido queda vinculado a docente/estudiante/área/periodo; valor fuera de escala y duplicado rechazados; actualización permitida preserva trazabilidad; otro docente no modifica. Pruebas con ambas áreas, dos periodos, doble envío y valor límite. **Pendiente bloqueante:** registros institucionales/escala, regla de unicidad exacta y política de correcciones; no usar rango derivado de `NUMERIC(3,2)` como escala real. [Seguimiento](../../seguimiento/module-summary.md).
