# RF-011 (V3, propuesta): ejecutar y registrar tareas

## Aplicación a este backend

**Diseño no implementado.** La interacción del estudiante descrita abajo ocurre en el servicio externo. Tareas ofrece el ciclo de sesión y recepción/persistencia de evidencia autorizado; no renderiza instrucciones, mide reacciones en el servidor ni usa el login de profesores como login del menor.

**Bloquea IN-01/TA-01:** cerrar [contrato de integración](../../../games-integration.md), distinguir batería/intento, identidad del productor, formato/versiones, transiciones y confirmación/idempotencia. `POST /api/v1/tasks/results` es ruta histórica propuesta, no endpoint existente. El servidor valida elegibilidad/estructura/consistencia; Evolución decide suficiencia y cálculo por indicador.

**Pruebas del API:** sesión autorizada y evidencia trazable; productor/estudiante/asignación ajenos, consentimiento revocado, duplicados idénticos/conflictivos, versión desconocida, orden y cierre repetido. Persistido ≠ calculado ≠ metodológicamente válido.

## Recorrido original de plataforma y evidencia

**Actor:** estudiante con tarea propia asignada y vigente; servidor valida participante activo, consentimiento y límite de intentos. [V3 RF-011](../../../../original/requisitos_V3.xlsx), [A CU-TD-05/07 y §6.3 pp. 37–39](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf). **Secuencia de [diagrama original](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/M%C3%B3dulo%20tareas%20Digitales/UML%20%E2%80%94%20Ejecuci%C3%B3n%20de%20una%20tarea%20digital.jpeg):** 1) iniciar/recuperar estado; 2) mostrar configuración, instrucciones y condiciones; 3) registrar interacción/respuesta, estímulo, tiempos e intento por tarea; 4) pausa opcional conserva estado; 5) fallo técnico registra incidencia y último estado válido, reanuda si habilitado o marca incompleta; 6) al terminar registra cierre y deriva datos para indicadores. [F §§3.3–3.11, 4.11 pp. 17–22, 40–41](../../../../original/Fundamento%20teorico.docx.pdf).

**Eventos documentados por V3:** inicio, respuesta, selección, marca temporal, pausa, reanudación, finalización, incidencia; asociados a estudiante/tarea/sesión/versión; no capturar datos ajenos a finalidad. Tiempo medido en navegador, distinguir ausencia de respuesta de fallo técnico; [modelo](../domain-model.md). **Contrato parcial:** D §2.2 p. 6 menciona `POST /api/v1/tasks/results`, JSON comprimido final, HTTPS y confirmación; PUML tareas propone lotes `batchSequence` sin ruta: [conflicto](../../../unresolved-issues.md). **Verificación:** sesión válida genera trazas correctas; tarea ajena/inactiva o consentimiento revocado no comienza; incidencia no cuenta error cognitivo; interrupción no duplica eventos; revisar [TG específicas](../module-summary.md).
