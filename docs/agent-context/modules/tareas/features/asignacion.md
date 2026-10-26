# RF-015 (V3, propuesta): asignar tareas

## Aplicación a este backend

**Diseño no implementado.** El profesor crea asignaciones desde este API, limitadas por responsabilidad, participante activo/consentimiento y tarea disponible. Académico posee la responsabilidad docente; Tareas posee la asignación de actividad. El servicio externo presenta al estudiante las que su contrato permita, sin acceso a listados ajenos ni sesión de profesor compartida.

**Decidir TA-02/IN-01:** destinatario individual/grupo, miembros al asignar vs grupo actual, periodo/zona horaria, IDs externos y cómo consulta el servicio de juegos; TA-01 limita intentos. No implementar solo `group_id` ignorando el caso individual de V3 ni copiar el grupo a una segunda fuente de autoridad.

**Pruebas del API:** profesor/grupo ajeno, individual válido, tarea deshabilitada, ventana inválida, inactivo/sin consentimiento y revocación antes del inicio. Definir semántica de doble envío y cambios de grupo antes de fijar unicidad. Ver [modelo](../domain-model.md).

## Flujo original y evidencia

**Actor:** docente autenticado, solo estudiantes o grupos de su responsabilidad. **Entradas:** tarea habilitada, destinatario individual o grupo, periodo de disponibilidad y parámetros permitidos; servidor exige estudiante activo y consentimiento vigente. [V3 RF-015](../../../../original/requisitos_V3.xlsx), [A CU-TD-03 pp. 36–37](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [flujo general](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/M%C3%B3dulo%20tareas%20Digitales/Flujo%20general%20del%20modulo%20de%20tareas%20digitales.jpeg).

**Flujo:** seleccionar estudiante(s)/grupo propio y tarea disponible → validar rol/ámbito, estado y consentimiento al asignar → fijar ventana/parámetros → crear asignación → estudiante ve solo las suyas dentro de vigencia → al iniciar repetir chequeo de consentimiento. Tarea deshabilitada, fuera de ventana, menor inactivo/sin consentimiento o docente ajeno → no asignar/iniciar. **Criterios/pruebas:** asignación visible solo al destinatario, probar grupo ajeno y estudiante individual, revocación entre asignación e inicio. **Conflicto:** [ERD](../domain-model.md) solo modela `group_id`, no destinatario individual; `max_attempts DEFAULT 2` no es política aprobada. Fechas, zona horaria y destinatario final pendientes. Dependencias [Académico](../../academico/features/consentimiento.md) y [disponibilidad](disponibilidad.md).
