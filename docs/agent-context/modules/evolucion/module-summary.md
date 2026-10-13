# Evolución e indicadores

1. **Propósito:** catálogo, validación de suficiencia, cálculo por tarea y evolución longitudinal (V3 RF-016…020).
2. **Alcance:** procesar eventos válidos y consulta de historia; no emitir diagnósticos, puntuación cognitiva única ni baremos externos (F §§5–6).
3. **Actores:** sistema valida y calcula; docente consulta catálogo/historia de estudiantes autorizados; definición metodológica por administrador solo condicional en A §6.2 p. 37.
4. **Vocabulario:** variable observable, indicador, unidad/fórmula, suficiencia, comparabilidad, sesión/versiones, contexto de ejecución.
5. **Reglas:** validar estímulo/respuesta e incidencia antes de contar; dato insuficiente = no disponible con razón, no cero; no comparar sesiones heterogéneas sin advertir; sin clasificación clínica (F §§5.2–5.12, 6.24).
6. **Entidades:** `raw_events` 1:N por sesión, `calculated_indicators` propuesto 1:1 por sesión y estudiante 1:N; [modelo](domain-model.md).
7. **Flujo:** recibir ejecución → validar integridad/incidencia → comprobar variables y suficiencia → calcular si válido, o marcar no disponible → trazar insumos y condiciones → presentar al docente valor contextual y aviso no diagnóstico; sin registros comparables, mostrar solo resultado disponible ([procesamiento](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/M%C3%B3dulo%20tareas%20Digitales/Diagrama%20de%20Actividades%20%E2%80%94%20Procesamiento%20de%20resultados.jpeg)).
8. **Interfaces:** Tareas provee sesiones/eventos; Académico notas y Seguimiento observaciones para lectura conjunta; Usuarios impone ámbito.
9. **Restricciones:** fórmulas explícitas de F §5, sin umbral universal; captura temporal local D ADR-01; catálogo y versiones pendientes; algunos indicadores son opcionales («podrá»).
10. **Dependencias:** fichas por indicador aprobadas, equivalencia entre condiciones/versiones, exclusiones y tolerancias por decidir (V3 D-05, D-06).
11. **Features:** [catálogo](features/catalogo.md), [cálculo](features/calculo.md), [suficiencia](features/suficiencia.md), [no diagnóstico](features/no-diagnostico.md), [longitudinal](features/longitudinal.md); [tareas](../tareas/module-summary.md).
12. **Fuentes:** [V3 RF-016…020](../../../original/requisitos_V3.xlsx), [F §§5–6 pp. 42–62](../../../original/Fundamento%20teorico.docx.pdf), [A §6.2–6.3 pp. 37–39](../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [PUML](../../../original/C4/UML/moduloEvolucion.puml), [ERD](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/ERD-plantuml.puml).
