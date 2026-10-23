# Integración con el servicio externo de juegos

## Confirmado y no confirmado

El responsable confirmó que los estudiantes interactúan con un servicio separado y este backend debe ofrecer endpoints para registrar tareas, asignarlas y registrar los datos asociados. No hay contrato vigente de ese servicio en los archivos suministrados.

Las fuentes originales no son equivalentes a ese contrato:

- D §2.2 flujo B p. 6 propone `POST /api/v1/tasks/results`, JSON comprimido al finalizar y confirmación de persistencia.
- A §3.2 p. 18 menciona envío al finalizar cada ítem.
- `C4/UML/moduloTareas.puml` propone `submitEventBatch`, `batchSequence` y buffer de 50 eventos; son firmas de diseño, no rutas ni tamaño obligatorio.
- V3 RF-011/013 exige evidencia ligada a estudiante/tarea/sesión/versión, progreso confirmado y no duplicación; RF-017/018 propone cálculo backend desde eventos válidos.

**No publicar el endpoint histórico como disponible. No construir tres protocolos a la vez.**

## Decisiones que bloquean el contrato de ingesta

| Tema a acordar con el otro servicio | Información que debe quedar explícita |
| --- | --- |
| Productor y autorización | Quién llama realmente (servidor externo o navegador), credencial, permisos, revocación y vínculo permitido con estudiante/asignación/sesión. No aceptar IDs arbitrarios ni dar privilegios de profesor al productor. |
| Responsabilidad del cálculo | ¿Envía eventos, indicadores calculados o ambos? Si calcula fuera, qué valida/recalcula Evolución, qué evidencia conserva y qué constituye un resultado validado. Cambiar el cálculo backend previsto por V3 requiere decisión trazable. |
| Identificadores | Identificador local/external de tarea, participante, asignación, sesión de batería/intento y ensayo; emisor de cada ID, mapeo y unicidad. No enviar nombres/documentos del menor si un ID basta. |
| Versiones y contexto | Versión de contrato, juego/configuración/regla; condición, dificultad, dispositivo pertinente, fechas y unidades. Definir incompatibilidades, no asumir equivalencia por nombre de juego. |
| Envío y confirmación | Final/por ítem/lotes, límites, compresión y confirmación posterior a persistencia; tratamiento de parcialidad y errores. Un acuse de recepción no prueba suficiencia metodológica. |
| Reintentos y orden | Clave de deduplicación, mismo ID con contenido distinto, envíos fuera de orden, concurrencia, cierre repetido y eventos posteriores al cierre. |
| Ciclo de vida | Inicio autorizado, consumo de intento, pausa, recuperación, abandono y cierre; cambios de consentimiento o disponibilidad durante una ejecución. |
| Resultados y errores | Estados HTTP/cuerpos y causas normalizadas, diferencia entre envío rechazado, ejecución incompleta, indicador no disponible y procesamiento fallido; posibilidad de reintentar. |

Es una **lista de decisiones**, no nombres de campos JSON ya aprobados. Acordarlas antes de implementar las partes afectadas; no elegir OAuth, claves compartidas, colas o un event bus sin necesidad demostrada.

## División del trabajo

- Tareas es la entrada del ciclo de ejecución y conserva evidencia/progreso/incidencias. Para resultados calculados externos, acordar la recepción/orquestación y su entrega a Evolución, sin duplicar endpoints de eventos.
- Evolución conserva las fichas y la procedencia de indicadores; no trata cualquier número externo como verdad metodológica ni inventa evidencia faltante.
- Académico mantiene consentimiento y responsabilidad. El mecanismo de integración debe permitir aplicar esos controles en servidor, no delegarlos únicamente a la pantalla del juego.
- Seguimiento consume el resultado contextualizado y separado de notas/observaciones.

## Pruebas mínimas al cerrar el contrato

Con datos ficticios: envío válido con acuse verificable; credencial inválida; participante/asignación ajenos; consentimiento ausente/revocado; duplicado idéntico y conflictivo; envío parcial/fuera de orden; dos inicios concurrentes; interrupción y reanudación; cierre repetido; versión desconocida; duración sin marcas válidas; incidencia que afecta un indicador pero no necesariamente todos. Probar las fórmulas contra referencias solo cuando estén aprobadas y se hayan asignado responsabilidades.
