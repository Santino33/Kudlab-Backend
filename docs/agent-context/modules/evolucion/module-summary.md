# Evolución e indicadores

## Responsabilidad del backend

**Diseño, sin módulo implementado en esta base.** Es propietario del catálogo metodológico, evaluación de suficiencia/exclusión, indicadores derivados y su procedencia, historia y comparabilidad. Consume evidencia de Tareas; **no es otro módulo de juegos**, no asigna actividades ni recibe una segunda copia de eventos por un endpoint paralelo.

### Entradas, salidas y límites

- Las fuentes V3 RF-017/018 y A CU-GI-02/03 prevén cálculo backend desde eventos válidos. El servicio externo podría enviar métricas ya calculadas, pero esa distribución no está confirmada: decidir validación/recálculo/evidencia en [integración](../../games-integration.md) antes de implementarla.
- Tareas conserva respuestas, condiciones e incidencias; Evolución decide si **cada indicador** puede usarlas y registra motivo al excluir. Completar o persistir una sesión no garantiza suficiencia de todas sus métricas.
- Provee a Seguimiento valores/unidades/definiciones/contexto/ausencias y criterios de comparación; no escribe notas académicas ni observaciones y no las suma para fabricar un índice cognitivo.
- Usuarios/Académico autorizan consultas por identidad/ámbito. La autorización de un productor externo no equivale a permitirle consultar historias completas.

### Estructura recomendada (no creada)

Dentro de `src/modules/evolucion/`: `catalog/` (fichas/versiones), `processing/` (suficiencia y reglas de cálculo puras por tarea cuando apliquen), `history/` (cronología/comparabilidad). `processing/` no requiere endpoint público, cola, Strategy o Factory solo porque aparezcan en un PUML. Persistencia en `src/db/`; seguir [guía](../../implementation-guide.md).

### Antes de implementar

Resolver contrato de entrada; fórmulas, unidades, tolerancia/redondeo, suficiencia/exclusiones por indicador; persistencia versionada y comportamiento al recalcular. El ERD tiene **una fila con varias métricas por sesión**, no un único valor: la carencia es que no cubre versiones/condiciones/todas las medidas, no que una fila sea intrínsecamente incorrecta. Ver [modelo](domain-model.md) y [pendientes EV-01…03](../../unresolved-issues.md).

Pruebas: conjuntos de referencia por TG, denominador cero, tiempo sin presentación válida, incidente parcial, práctica/cierre excluidos del cálculo cognitivo, recálculo sin duplicación y sesiones no comparables. Las reglas de la constitución no permiten inventar umbrales universales, etiquetas clínicas ni puntuación global.

## Referencia funcional de las fuentes

1. **Propósito:** catálogo, validación de suficiencia, cálculo por tarea y evolución longitudinal (V3 RF-016…020).
2. **Alcance:** procesar eventos válidos y consulta de historia; no emitir diagnósticos, puntuación cognitiva única ni baremos externos (F §§5–6).
3. **Actores:** sistema valida y calcula; docente consulta catálogo/historia de estudiantes autorizados; definición metodológica por administrador solo condicional en A §6.2 p. 37.
4. **Vocabulario:** variable observable, indicador, unidad/fórmula, suficiencia, comparabilidad, sesión/versiones, contexto de ejecución.
5. **Reglas:** validar estímulo/respuesta e incidencia antes de contar; dato insuficiente = no disponible con razón, no cero; no comparar sesiones heterogéneas sin advertir; sin clasificación clínica (F §§5.2–5.12, 6.24).
6. **Entidades:** consume `raw_events` de Tareas; es propietario de resultados `calculated_indicators` (fila con múltiples métricas, 1:1 por sesión en ERD) y ficha/versiones aún por diseñar; [modelo](domain-model.md).
7. **Flujo:** recibir ejecución → validar integridad/incidencia → comprobar variables y suficiencia → calcular si válido, o marcar no disponible → trazar insumos y condiciones → presentar al docente valor contextual y aviso no diagnóstico; sin registros comparables, mostrar solo resultado disponible ([procesamiento](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/M%C3%B3dulo%20tareas%20Digitales/Diagrama%20de%20Actividades%20%E2%80%94%20Procesamiento%20de%20resultados.jpeg)).
8. **Interfaces:** Tareas provee sesiones/eventos; Seguimiento reúne indicadores con notas de Académico y observaciones propias. Usuarios/Académico imponen identidad y ámbito; esa lectura conjunta no convierte notas/observaciones en insumos de una fórmula cognitiva.
9. **Restricciones:** fórmulas explícitas de F §5, sin umbral universal; captura temporal local D ADR-01; catálogo y versiones pendientes; algunos indicadores son opcionales («podrá»).
10. **Dependencias:** fichas por indicador aprobadas, equivalencia entre condiciones/versiones, exclusiones y tolerancias por decidir (V3 D-05, D-06).
11. **Features:** [catálogo](features/catalogo.md), [cálculo](features/calculo.md), [suficiencia](features/suficiencia.md), [no diagnóstico](features/no-diagnostico.md), [longitudinal](features/longitudinal.md); [tareas](../tareas/module-summary.md).
12. **Fuentes:** [V3 RF-016…020](../../../original/requisitos_V3.xlsx), [F §§5–6 pp. 42–62](../../../original/Fundamento%20teorico.docx.pdf), [A §6.2–6.3 pp. 37–39](../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [PUML](../../../original/C4/UML/moduloEvolucion.puml), [ERD](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/ERD-plantuml.puml).
