# RF-023 (V3, propuesta): observaciones estructuradas

## Aplicación a este backend

**Diseño no implementado.** Seguimiento escribe conducta/categoría y escala aprobada con estudiante/autor/fecha/periodo; Académico proporciona ámbito. No guardar una observación como nota escolar, evento de juego ni indicador digital. El instrumento grupal del analista de A §2.2.2 no es una escala individual aprobada del producto.

**Bloqueo SE-01:** campos/categorías/escala y permisos de edición/corrección/ventana temporal. Definir autor de servidor y referencia a cuenta/identidad, no confiar en `teacherId` enviado por el cliente. La matriz reutiliza estas mismas validaciones, no otra escala/persistencia.

**Pruebas del API:** registro válido, escala desconocida, autor manipulado, profesor ajeno, edición no autorizada y corrección trazable. La meta <3 min tras inducción es de usabilidad del flujo completo; no una garantía de latencia del endpoint.

## Flujo original y evidencia

**Actor:** docente autorizado sobre alumno propio. Objetivo: capturar conductas observables de atención/seguimiento de instrucciones como evidencia pedagógica, no diagnóstico. [V3 RF-023](../../../../original/requisitos_V3.xlsx), [A §2.2.2 pp. 9–10 y §3.2 p. 16](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf). Entradas V3: estudiante, fecha, periodo, docente/autor y escala cualitativa aprobada; categoría/texto aparecen en [ERD](../domain-model.md). A §2.2.2 describe guía de observación grupal con frecuencia/impacto/alerta, **no equivale** automáticamente a escala de observación individual de V3.

**Flujo:** seleccionar estudiante propio → elegir conducta/categoría y escala aprobada → anotar contexto si aplica → validar campos y autorización → guardar con autor/fecha → ofrecer consulta posterior. Escala fuera de catálogo, campos incompletos o alumno ajeno → no guardar observación completa; modificación sujeta a permiso/auditoría y ventana temporal por definir (A §4.2 RF-007 de versión anterior). **Pruebas/aceptación:** registro válido vinculado a autor/periodo; inválido o ajeno rechazado; meta de tiempo <3 min tras inducción ≤15 min de A §3.2. Escala exacta/edición pendientes. Dependencia [matriz grupal](matriz-grupo.md).
