# RF-022 (V3, propuesta): gráficos y filtros

## Aplicación a este backend y al frontend

**Diseño no implementado.** V3 asigna la visualización al frontend. Seguimiento valida filtros/ámbito y devuelve datos con unidad/tarea/fecha/condición y estado; no renderiza Chart.js, decide colores ni conserva la última vista del navegador. Evolución provee comparabilidad; no volver a calcularla con otra regla dentro del panel.

**Decidir SE-03/EV-03:** filtros/combinaciones, periodo/año, paginación/orden, agregación y límites comparables. No aceptar `teacherId` arbitrario ni devolver opciones/totales de alumnos ajenos. Una combinación sin resultados difiere de petición inválida, falta de autorización y error de servicio.

**Pruebas del API:** cada filtro limita correctamente registros/unidades/contexto; consultas directas ajenas denegadas; ausencia/insuficiencia distintas de cero. Actualización de gráficos, aviso y última vista válida son verificaciones del consumidor, no endpoints adicionales por sí mismas.

## Comportamiento original de plataforma y evidencia

**Actor:** docente autorizado en panel; administrador/coordinación solo según permisos. [V3 RF-022](../../../../original/requisitos_V3.xlsx), [A CU05 pp. 34–35 y secuencia p. 46](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf). Entradas documentadas: estudiante, grupo (A), periodo, área (V3) e indicador; se filtran opciones al ámbito del usuario.

**Flujo:** ofrecer filtros autorizados → usuario modifica combinación → validar ámbito/combinación en servidor → consultar y procesar → actualizar gráficos y etiquetas con escala/unidad/tarea/sesión/condición; preservar aviso no diagnóstico. Sin resultados → estado sin datos; insuficiencia/no comparabilidad → anotación sin cero; filtro ajeno → rechazo; fallo de actualización → conservar último estado válido e informar (A CU05). [F §§6.4–6.14 pp. 54–59](../../../../original/Fundamento%20teorico.docx.pdf) pide contexto y distinguir condición técnica del resultado.

**Verificación:** al cambiar cada filtro cambia la información correspondiente y nunca aparecen valores ajenos; unidad/escala coherentes; ausencia no se grafica como 0; aviso persistente. Probar filtros mixtos, sin resultados, ID ajeno, incidencia y error temporal de carga. Gráfico grupal solo si volumen/calidad suficientes; condiciones y umbrales pendientes. [Autorización](../../usuarios/features/autorizacion.md), [longitudinal](../../evolucion/features/longitudinal.md).
