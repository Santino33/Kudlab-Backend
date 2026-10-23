# Fuentes, disponibilidad y trazabilidad

Actualización documental: 2026-10-23. Código contrastado sobre base `cd3c2b4`; verificar cambios posteriores antes de reutilizar el inventario como estado actual.

## Acceso en un clon o worktree nuevo

Los enlaces originales de este contexto esperan `docs/original/`. En la base revisada esa carpeta no está versionada y Git **no la traslada** al crear worktrees. Esta revisión leyó la copia local en `/home/santino/Universidad/TrabajoCampo/Kudlab-backend/docs/original/`; no se agregaron binarios, copias ni enlaces simbólicos al repositorio.

Solicitar al responsable la carpeta documental autorizada y colocarla en `docs/original/` del entorno de trabajo, o leer su copia disponible indicando la ruta real. No asumir que la ruta de esta máquina existirá para otro agente. Si falta una fuente necesaria, declarar el bloqueo y pedirla; no decir que se contrastó. No incorporar expedientes ni datos reales de menores a Git.

## Inventario leído en esta actualización

Las páginas siguientes son posiciones del PDF (base 1), no los números de su tabla de contenido; F tiene numeración interna irregular. Para XLSX se cita hoja, RF/D y fila.

| Fuente | Lectura y puntos de entrada |
| --- | --- |
| A: `3 ANALISIS DEL PROYECTO.docx.pdf` | Completo, 52 páginas. §§1–2: contexto y elicitación, pp. 4–14; §3 calidad, pp. 15–18; §4 RF/RNF, pp. 19–26; §6 CU, pp. 26–39; §7 diagramas, pp. 40–50; anexos/referencias, pp. 51–52. |
| D: `DESCRIPCIÓN DE DISEÑO DE SOFTWARE.docx.pdf` | Completo, 19 páginas. §§1–2 arquitectura/flujos, pp. 3–8; §3 datos/seguridad, pp. 8–11; §4 calidad, pp. 11–12; §5 ADR, p. 13; §6 stack, pp. 14–16; §7 diagramas, pp. 16–19. |
| F: `Fundamento teorico.docx.pdf` | Completo, 64 páginas. Fundamento conceptual pp. 3–14; arquitectura de batería pp. 14–22; fichas TG pp. 23–40; variables/indicadores §§5.2–5.17 pp. 42–53; interpretación §6 pp. 53–62; bibliografía al final. Verificar por título de sección si cambia la edición. |
| V3: `requisitos_V3.xlsx` | Ambas hojas completas: «RF corregidos» filas 2–26 = RF-001…025; «Decisiones y pendientes» filas 2–11 = D-01…10. Todos los RF figuran «Propuesto - corregido para validación». |
| C4 | `componentes.jpeg`, `contenedores.jpeg`; seis PUML: usuarios, Tareas, Evolución, Seguimiento, consentimiento/R2 y ERD (este último bajo DIAGRAMAS-ANALISIS). Se contrastaron con D §§3/7. |
| Datos | `DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml` y `ERD-plantuml.puml`, completos; 13 tablas de diseño, no migraciones vigentes. |
| Casos de uso/contexto | Tres PNG: contexto general, CU general y CU estudiantes; draw.io `02-cu-gestion-estudiantes1`, leído como XML. El CU general usa IDs hasta RF-085, no equivalentes a V3. |
| Estados/actividades | PNG sesión; draw.io ciclo del estudiante y actividad de gestión; tres JPEG de Tareas: flujo general, ejecución y procesamiento. Nueve imágenes externas en total, además de diagramas incrustados en A/D. |

Se revisaron nodos y conexiones de draw.io, no solo las etiquetas. Las latencias y reglas de interfaz descritas en F se conservan como contexto del servicio externo, no instrucciones para programar frontend aquí.

## Cómo usar la evidencia

1. Identificar si se busca el comportamiento actual, una regla de dominio o una propuesta histórica.
2. Para código existente, contrastar [implementación](implementation-guide.md), especificación/contrato y pruebas; registrar discrepancias en vez de cambiar silenciosamente el comportamiento.
3. Para reglas nuevas, abrir el pasaje citado y su contexto en cada fuente contradictoria. «RF-018» sin versión no identifica una regla.
4. Registrar decisión y responsable si falta una definición. Las aclaraciones de alcance del responsable no hacen que todas las propuestas V3 estén aprobadas.
5. La [constitución](../../.specify/memory/constitution.md) rige los cambios. Si una decisión exige enmendarla, presentar la propuesta y solicitar aprobación; este trabajo no la enmienda.

## Material citado pero no suministrado

A §8 p. 51 y §§2–3 cita SRS independiente, Plan de Trabajo, instrumentos/apéndices diligenciados, evidencias de entrevistas/campo, validación SQA y registros institucionales. No estaban como archivos independientes en la carpeta revisada. F PDF sí estaba: la ausencia de su `.docx` no significa ausencia de su contenido. No inventar escalas, políticas de conservación ni aprobación institucional a partir de referencias bibliográficas.
