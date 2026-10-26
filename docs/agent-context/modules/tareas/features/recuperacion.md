# RF-013 (V3, propuesta): persistir y recuperar progreso

## Aplicación a este backend

**Diseño no implementado.** El servicio externo conserva temporalmente interacción no confirmada; Tareas persiste y devuelve el último estado confirmado según contrato. No desarrollar LocalStorage ni restauración visual aquí. El acuse debe distinguir datos recibidos de datos durables; no prometer guardar eventos que nunca llegaron.

**Bloqueos IN-01/TA-01:** frecuencia/granularidad de envío, checkpoints, identificadores de deduplicación, conflictos/reordenamiento y condiciones de reanudación por tarea. TA-03: vigencia/consentimiento/disponibilidad al retomar. La reanudación operacional no prueba comparabilidad metodológica de tiempos; conservar pausas/incidencias.

**Pruebas del API:** reenvío tras perder acuse, reinicio del backend tras persistir, recuperación del mismo intento sin duplicar, checkpoint incompleto y tarea no reanudable con evidencia conservada. Los cortes/recargas de navegador son pruebas coordinadas con el servicio externo. Ver [integración](../../../games-integration.md).

## Recorrido original y evidencia

**Resultado:** guardar periódicamente último estado válido y eventos confirmados; ante desconexión reanudar si la tarea lo admite o marcar incompleta, sin duplicados ni nuevos intentos espurios. [V3 RF-013](../../../../original/requisitos_V3.xlsx), [F §§5.11–5.12 pp. 49–50](../../../../original/Fundamento%20teorico.docx.pdf). Datos conservados: tarea actual, ensayos/respuestas/tiempos válidos, condiciones, fecha, incidencias y estado; [modelo](../domain-model.md).

**Flujo textual del [diagrama de ejecución](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/M%C3%B3dulo%20tareas%20Digitales/UML%20%E2%80%94%20Ejecuci%C3%B3n%20de%20una%20tarea%20digital.jpeg):** interacción → guardar estado válido al pausar; reanudación habilitada → restaurar; incidencia → registrar y evaluar recuperabilidad → restaurar último estado válido o marcar interrumpida/incompleta; finalización → cerrar. D §2.2 p. 6 propone LocalStorage + memoria cliente para desconexión, limpiar al confirmar en §6.4 p. 16; [diagrama de estados](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/04-estados/01-estado-seccion-tarea/01-estado-sesion-tarea.png) advierte progreso local hasta confirmación. **Pruebas:** cortar red tras ítem, recargar, reanudar sin duplicar evento; no recuperable conserva incompleta e incidencia; no transformar abandono/ausencia en error o cero. Pendiente frecuencia, confirmación e idempotencia ([conflictos](../../../unresolved-issues.md)).
