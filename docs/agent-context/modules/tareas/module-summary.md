# Tareas digitales

## Responsabilidad del backend

**Actualización vertical 01 (2026-10-26):** consulta de catálogo/ficha implementada
en esta rama: `/api/v1/tasks` y `/api/v1/tasks/:taskId`, para ADMIN/TEACHER activos.
Solo TG-01 en el catálogo inicial; integración no comprobada y segundo juego sin
definir. TG-00/TG-06 son apoyos no independientes. El diseño histórico inferior no
amplía el alcance a todos los TG. Ver [contrato, fuentes y evidencia](../../../feature-specs/tareas/01-catalogo-y-ficha.md).
No hay recursos/configuración editable, asignación, ejecución ni métricas.

**Diseño, sin módulo implementado en esta base.** Es la frontera del ciclo operativo de juegos: registrar/gestionar actividades del banco fijo, configuración/versiones y disponibilidad, asignar, autorizar/controlar intentos y sesiones, recibir y conservar evidencia, progreso e incidencias. Registrar una actividad no autoriza crear o borrar mecánicas nuevas fuera de TG-00…06.

Los estudiantes ejecutan en **otro servicio**. Las fichas TG describen lo que sucede allí para entender qué datos necesita la API; no implementar aquí instrucciones, animaciones, botones, captura temporal ni almacenamiento del navegador. Usuarios gestiona solo el acceso de profesores.

### Entradas, salidas y límites

- Profesor: registro/configuración autorizada, habilitación y asignación a su ámbito; API devuelve definición/versiones/asignaciones/recorrido según contrato.
- Servicio externo: solicitudes/envíos autorizados de ejecución; Tareas verifica asociación/estado/forma y deduplicación, conserva evidencia y confirma persistencia. Autenticación y formato siguen pendientes: ver [integración](../../games-integration.md).
- Académico: fuente de participante activo, responsabilidad y consentimiento. Revalidar los controles pertinentes en servidor; no basta con que el juego los haya mostrado antes.
- Evolución: consume evidencia/condiciones sin apropiarse de `raw_events`. La suficiencia por indicador y las fórmulas no son reglas de ingesta de Tareas.
- Seguimiento: consulta estado/incidencias/recorrido; no los interpreta como rendimiento ni reescribe respuestas.

### Estructura recomendada (no creada)

Dentro de `src/modules/tareas/`: `catalog/` (registro/configuración/versiones), `assignments/`, `sessions/` (intentos y recuperación), `ingestion/` (eventos/incidencias y confirmación). Añadir adaptador de recursos solo cuando se concrete almacenamiento. Rutas/servicios por feature; no crear un motor de juego ni una carpeta por cada TG. Ver [guía](../../implementation-guide.md).

### Antes de implementar

Cerrar contrato con el productor externo; distinguir sesión de batería de intento por tarea; definir transiciones, consumo de intentos, destinatario individual/grupal, deshabilitación y reanudación; no tratar el default de dos intentos ni lotes de 50 como políticas aprobadas. TG-00/TG-06 no generan medidas cognitivas conforme a F y constitución III, aunque V3 use «evaluativas» de forma conflictiva. Ver [pendientes IN-01, TA-01…03](../../unresolved-issues.md).

Pruebas de integración: identidad de productor inválida, asignación ajena, consentimiento revocado, inicios concurrentes, reenvío idéntico/conflictivo, corte de red y cierre repetido. Un envío persistido no garantiza indicadores suficientes ni un resultado calculado.

## Referencia funcional de las fuentes (plataforma completa)

1. **Propósito:** administrar recursos/banco fijo, asignar y conservar telemetría/progreso de ejecuciones realizadas en el servicio externo (V3 RF-010…015; F §§3–5, ajustado al alcance confirmado del repositorio).
2. **Alcance/límites:** TG-00 práctica, TG-01…05 medición, TG-06 cierre; no prueba estandarizada ni ranking. TG-06 llamado «evaluativo» en V3: [conflicto](../../unresolved-issues.md).
3. **Actores:** administrador cambia recursos/parámetros y disponibilidad; docente asigna dentro de su ámbito y consulta resultados; estudiante ejecuta; sistema captura, valida y registra incidencias (A §6.2 pp. 36–37).
4. **Vocabulario:** tarea fija, versión de configuración, asignación, sesión/intento, ensayo, respuesta, incidencia; Kud guía al alumno.
5. **Reglas:** no activar tareas para menor sin consentimiento; respetar disponibilidad y límite de intentos; conservar eventos/estado sin duplicados; práctica y cierre no suman indicadores cognitivos; tiempos medidos en cliente; error técnico ≠ error del alumno. [F §§3.3–3.11, 4.11, 5.3–5.4 pp. 17–22, 40–44](../../../original/Fundamento%20teorico.docx.pdf).
6. **Entidades:** `tasks` 1:N `task_assignments` 1:N `task_sessions` 1:N `raw_events`; [modelo](domain-model.md).
7. **Flujo de la plataforma:** administrador guarda versión/dispone tareas → docente asigna → servicio externo presenta asignadas y ejecuta TG-00…06 → Tareas conserva sesiones/evidencia → Evolución procesa según contrato y ficha ([diagrama original](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/M%C3%B3dulo%20tareas%20Digitales/Flujo%20general%20del%20modulo%20de%20tareas%20digitales.jpeg), que no separa los servicios actuales).
8. **Interfaces:** Usuarios autentica/autoriza; Académico da estado y consentimiento; Evolución consume eventos; Seguimiento consulta resultados. Contrato HTTP explícito limitado en [arquitectura](../../architecture-summary.md).
9. **Restricciones:** recuperación último estado válido y no calificar incompletos; ≤5 MB de recursos por tarea (D §4 p. 12), accesibilidad botones ≥44px/audio (A pp. 9, 16), protocolo de ingesta conflictivo.
10. **Dependencias:** parámetros, criterios de consumo de intento, posibilidad de reanudar y condiciones de comparación por aprobar.
11. **Features:** [configuración](features/recursos-configuracion.md), [ejecución](features/ejecucion.md), [intentos](features/intentos.md), [recuperación](features/recuperacion.md), [disponibilidad](features/disponibilidad.md), [asignación](features/asignacion.md); [TG-00](features/tg-00-practica.md), [TG-01](features/tg-01-estrellas.md), [TG-02](features/tg-02-palabra.md), [TG-03](features/tg-03-kud-dice.md), [TG-04](features/tg-04-recuerda.md), [TG-05](features/tg-05-doble-mision.md), [TG-06](features/tg-06-cierre.md).
12. **Fuentes:** [V3 RF-010…015](../../../original/requisitos_V3.xlsx), [F pp. 10–50](../../../original/Fundamento%20teorico.docx.pdf), [A §6.2 pp. 36–39](../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [ejecución JPEG](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/M%C3%B3dulo%20tareas%20Digitales/UML%20%E2%80%94%20Ejecuci%C3%B3n%20de%20una%20tarea%20digital.jpeg), [PUML](../../../original/C4/UML/moduloTareas.puml).
