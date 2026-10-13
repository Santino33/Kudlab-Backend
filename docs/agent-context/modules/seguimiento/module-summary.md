# Seguimiento pedagógico y presentación

1. **Propósito:** reunir información individual/grupal, observaciones estructuradas y anotaciones cualitativas para la docente (V3 RF-021…025).
2. **Alcance:** consulta por dimensión/tarea/área, gráficos y filtros, registro individual y matriz grupal, notas contextuales; no rankings, diagnóstico ni atribución causal (F §6 pp. 53–62).
3. **Actores:** docente autorizado para sus estudiantes/grupos; administrador/coordinación solo según permisos definidos (A CU04/05 pp. 33–35).
4. **Vocabulario:** observación = escala cualitativa de conducta; anotación = contexto libre; nota académica = calificación escolar; indicador = cálculo digital; no son equivalentes.
5. **Reglas:** filtrar en servidor por responsabilidad; sin datos informar ausencia y si insuficientes no mostrar valor; mostrar siempre aviso pedagógico; gráficos identifican unidad, tarea, fecha y condición; observación/anotación conservan autor y fecha (A CU04–06 pp. 33–36; V3 RF-021…025).
6. **Entidades:** `teacher_observations` vinculada a estudiante/docente; notas e indicadores para consulta; anotación separada exigida por V3, no modelada en ERD; [modelo](domain-model.md).
7. **Flujo:** docente abre panel → autorizar → escoger estudiante/grupo/periodo/indicador → integrar observaciones, notas y tareas → advertir insuficiencia/no comparabilidad → gráfico y aviso; al fallar actualización conservar última vista válida (A CU05, pp. 34–35 y secuencia p. 46).
8. **Integraciones:** Usuarios restringe ámbito; Académico datos y notas; Evolución indicadores; Tareas estado y condiciones. Exportación grupal anonimizada aparece en PUML, sin RF V3 asignado.
9. **Restricciones:** separación visual de incidencias/resultados, no usar colores clínicos; privacidad y auditoría. F §§6.10–6.20 pp. 57–60.
10. **Dependencias:** escala cualitativa, notas, fichas de indicadores, reglas de autorización/comparación y persistencia de anotaciones pendientes.
11. **Features:** [consultar](features/consultar-resultados.md), [filtrar](features/visualizar-filtrar.md), [observaciones](features/observaciones.md), [matriz](features/matriz-grupo.md), [anotaciones](features/anotaciones.md); [evolución](../evolucion/module-summary.md).
12. **Fuentes:** [V3 RF-021…025](../../../original/requisitos_V3.xlsx), [A §6.1.2 pp. 33–36 y §7.3 p. 46](../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [F §6 pp. 53–62](../../../original/Fundamento%20teorico.docx.pdf), [PUML](../../../original/C4/UML/moduloSeguimiento.puml).
