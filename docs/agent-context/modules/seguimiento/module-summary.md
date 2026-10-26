# Seguimiento pedagógico y presentación

## Responsabilidad del backend

**Diseño, sin módulo implementado en esta base.** Es propietario de observaciones estructuradas y anotaciones cualitativas; construye consultas pedagógicas integrando datos de otros módulos. «Presentación» aquí significa datos y contexto para el frontend de profesores, no renderizar gráficos ni desarrollar una aplicación web.

### Entradas, salidas y límites

- Recibe observaciones/anotaciones del profesor autorizado, conserva autor/estudiante/fecha/periodo cuando aplique y aplica escala aprobada.
- Consulta ficha/notas de Académico, recorrido/incidencias de Tareas y resultados/historia/comparabilidad de Evolución. No modifica esas fuentes ni implementa una segunda fórmula de cálculo.
- Devuelve valores con unidad, tarea, fecha/condición, disponibilidad y limitaciones; la UI muestra gráficos, aviso no diagnóstico y conserva su última vista válida ante error.
- Las consultas individuales y agregadas deben filtrar ámbito en servidor. Ser ADMIN no confiere por defecto lectura irrestricta de menores; definir permiso explícito antes de exponer datos.

### Estructura recomendada (no creada)

Dentro de `src/modules/seguimiento/`: `queries/` (panel/filtros/agrupación), `observations/` (registro individual y matriz), `annotations/` (texto contextual). No crear un submódulo que vuelva a gestionar notas o indicadores. Esquemas/migraciones de sus escrituras en `src/db/`; aplicar [guía](../../implementation-guide.md).

### Antes de implementar

Resolver escala/campos/edición de observaciones; persistencia de anotaciones; atomicidad y respuesta de guardado de matriz; criterios de agregado y permisos. Un listado vacío, indicador no disponible, sesión inválida y error de consulta son estados distintos, no un único cero. Exportación aparece en fuentes históricas, pero no tiene contrato ni alcance aprobado por esta actualización. Ver [pendientes SE-01…03](../../unresolved-issues.md).

Pruebas de dos profesores, filtros/IDs ajenos, periodo vacío, insuficiencia, fuentes separadas, fila inválida en matriz y edición autorizada. Las pruebas visuales descritas por F pertenecen al consumidor; la API debe ofrecer información suficiente para realizarlas.

## Referencia funcional de las fuentes

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
