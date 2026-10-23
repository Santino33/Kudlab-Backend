# RF-018 (V3, propuesta): integridad y suficiencia

## Aplicación a este backend

**Diseño no implementado.** Evolución evalúa validez metodológica y suficiencia **por indicador**. Tareas ya controla autorización/estructura/idempotencia de ingesta; no repetir esas escrituras aquí. El API no puede garantizar que un estímulo se mostró solo porque recibió un evento: conserva y valida la evidencia acordada con el productor, junto con incidencias y versión.

**Bloqueos EV-01/EV-02:** mínimos/exclusiones por métrica y motivos normalizados. No copiar duración mínima del PUML ni inventar un número universal de ensayos. Distinguir sesión inválida, indicador no disponible, datos no recibidos y error técnico de procesamiento. Una incidencia localizada no invalida necesariamente todos los resultados.

**Pruebas backend:** respuesta sin presentación, omisión con ventana inválida, TR sin marcas válidas, fallo técnico localizado, denominador cero y falta de referencia TG-05. Verificar razón y evidencia consultables, sin sustituir ausencia por cero ni perder resultados aislados válidos.

## Regla original y evidencia

**Actor:** sistema antes del cálculo. [V3 RF-018](../../../../original/requisitos_V3.xlsx), [F §§5.3–5.4, 5.12 pp. 43–44, 50](../../../../original/Fundamento%20teorico.docx.pdf). **Flujo:** comprobar presentación real del estímulo y registro de respuesta; para omisión exigir ventana válida y ausencia de incidencia; identificar fallo de audio/red/interfaz, tiempo sin marca de presentación/respuesta, tarea/condición no completada; contrastar variables y cantidad contra ficha del indicador; si faltan o están afectadas, marcar `NO_DISPONIBLE` con motivo, conservar evidencia y no calcular; si suficientes, entregar entradas válidas a [cálculo](calculo.md). [Diagrama procesamiento](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/M%C3%B3dulo%20tareas%20Digitales/Diagrama%20de%20Actividades%20%E2%80%94%20Procesamiento%20de%20resultados.jpeg).

**Criterios/pruebas:** ejecución completa válida calcula; fallo técnico no equivale a error cognitivo; tiempo sin dos marcas no entra a métrica; falta condición individual TG-05 impide costo dual; sin denominador no se produce cero; motivo consultable. El ERD contiene `sufficiency_status` y `insufficiency_reason` ([modelo](../domain-model.md)). **Pendiente:** umbral por tarea, exclusiones y razones normalizadas V3 D-05/D-06; no copiar umbral arbitrario del PUML de duración mínima. El RF-018 de A §4.2 significa otra cosa.
