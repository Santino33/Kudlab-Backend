# Contradicciones, faltantes y preguntas

## Registro activo para desarrollar

Las filas siguientes distinguen lo que se puede implementar de lo que requiere decisión. El responsable del proyecto debe cerrar alcance/contratos; las decisiones metodológicas/institucionales requieren evidencia validada con quien corresponda. No inventar decisiones para marcar este registro como completo.

| ID / estado | Decisión necesaria | Parte bloqueada / acción para resolver |
| --- | --- | --- |
| IN-01 · abierto, responsable + equipo de juegos | Productor, autenticación, IDs, eventos vs indicadores, versiones, envío/acuse/idempotencia | Contrato externo de Tareas/Evolución. Completar [acuerdos de integración](games-integration.md) con el otro servicio antes de implementar su ingesta. |
| TA-01 · abierto, responsable/metodología | Sesión de batería vs intento por tarea, transiciones y consumo de intentos por TG | Inicio, límite y recuperación; acordar estados y pruebas concurrentes. Default ERD `2` y lote PUML `50` no son políticas ratificadas. |
| TA-02 · abierto, responsable | Destinatario individual/grupal y efecto de cambios del grupo; ventanas/zona horaria | Asignaciones y elegibilidad. V3 RF-015 amplía el ERD de solo grupo; definir destinatarios y validaciones. |
| TA-03 · abierto, responsable + juegos | Versiones históricas, parámetros permitidos y efectos de deshabilitar/revocar sobre sesiones en curso | Configuración/disponibilidad y continuación. No bloquear nuevas asignaciones/inicios de forma distinta a V3; sí decidir tratamiento de lo ya iniciado. |
| AC-01 · parcialmente resuelto, responsable | Contrato 005 define datos/ID mínimos; Cursos usa cuenta de negocio del profesor y CRUD/transferencia confirmada de responsabilidad actual | [Cursos](../feature-specs/academico/02-cursos.md) implementa ámbito actual; historia de responsabilidad y consulta histórica siguen pendientes. No se cierran consentimiento, retención ni ciclo legal. |
| AC-02 · abierto, responsable/institución | Estados legales, vigencia, revocación, evidencia, retención, retiro y permisos | Consentimientos y ciclo legal. D y draw.io discrepan sobre pendiente persistido/eliminación. No confundir inactivación ordinaria con borrado; no prometer cumplimiento legal solo por guardar hash. |
| AC-03 · abierto, institución | Escala/rango/precisión, año-periodo, unicidad y corrección de notas | Solo notas académicas. Solicitar escala institucional; no deducir rango de `NUMERIC(3,2)`. |
| EV-01 · abierto, metodología | Ficha por indicador: fórmula, entradas/exclusiones, suficiencia, unidad, redondeo/tolerancia y versión | Publicación de indicadores validados. F tiene fórmulas parciales; faltan criterios TG-04 y mínimos/exclusiones por métrica (V3 D-05). |
| EV-02 · abierto, responsable/metodología | Estados/motivos normalizados y persistencia/recálculo versionado | Registro de resultados y ausencias. Una fila ERD contiene varias métricas: no es contradicción por sí sola; decidir cobertura/versiones/condiciones. |
| EV-03 · abierto, metodología | Equivalencia de tareas/versiones/cargas y evidencia mínima para comparar | Comparaciones longitudinales, no necesariamente consulta de valores aislados. F §§6.14/6.24 no fija umbral universal. |
| SE-01 · abierto, institución | Escala/categorías de observación, edición y permisos | Observaciones/matriz; no copiar la escala grupal del instrumento del analista como escala individual aprobada. |
| SE-02 · abierto, responsable | Guardado parcial/atómico, resultado por fila e idempotencia de matriz; persistencia/edición de anotaciones | Escrituras de Seguimiento; V3 permite guardar válidos, pero no especifica contrato transaccional ni longitud de texto. |
| SE-03 · abierto, responsable/metodología | Agregados grupales, volumen/calidad, filtros/periodos y permiso administrativo sobre menores | Consultas grupales y acceso ADMIN. No asumir que rol administrativo habilita todo dato estudiantil. |
| TR-01 · abierto, responsable | Auditoría de otros módulos, conservación/exportación/retiro y controles de integridad | Features transversales futuras. La auditoría de cuentas existente no cubre automáticamente estos datos; aprobar alcance antes de añadir exportación o borrado. |
| DO-01 · operativo, responsable documental | Distribuir fuentes originales a clones/worktrees y localizar anexos faltantes | Contraste documental cuando no estén accesibles. Seguir [fuentes](sources.md); no versionar datos personales ni asumir la ruta local de esta sesión. |
| DO-02 · pendiente de ratificación de fuentes | Catálogo normativo RF/RNF, alcance RF-026… y correspondencia de IDs | Trazabilidad histórica. Usar versión/texto y decisiones por feature; no ampliar alcance por un número de RF de otro diagrama. |

### Ya aclarado o materializado (no volver a preguntar como si nada existiera)

- Usuarios humanos = profesores; estudiantes en otro servicio. Falta **autorización de integración**, no un login STUDENT en Usuarios.
- Stack backend observado: Hono/TypeScript/Better Auth/Drizzle/PostgreSQL. Los rótulos MySQL/NestJS/Prisma de las fuentes no son alternativas pendientes para cambiar el proyecto actual.
- Usuarios tiene rol único, política de credenciales/correo, invitaciones, reactivación y recuperación en código. Consultar [estado actual](modules/usuarios/module-summary.md), contratos y pruebas; no deducir aprobación general de ello.
- TG-00 y TG-06 no aportan medidas cognitivas según F y constitución III. Persiste la discrepancia nominal de V3 y faltan sus políticas operativas de intentos/configuración; no implementar cálculo cognitivo para resolverla.
- No se generan rankings, baremos clínicos, semáforos diagnósticos ni índice cognitivo único. Son límites vigentes de la constitución, no opciones abiertas de UX.

## Evidencia histórica de contradicciones

La tabla siguiente conserva el conflicto entre **fuentes originales**, no declara pendiente toda su resolución en el código actual. Para decisiones activas usar el registro anterior y [decisiones actuales](decisions.md).

| Tema | Evidencia e implicación |
| --- | --- |
| IDs RF incompatibles | [A §4.2 pp. 19–24](../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf) dice 31 RF 001–032 y 010 vacante, pero reutiliza 024–029 entre módulos; §6 pp. 26–36 también reasigna RF. [V3](../original/requisitos_V3.xlsx) usa RF-001 usuarios, RF-005 estudiante, RF-008 consentimiento, RF-025 anotaciones. [CU general](../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/02-casos-de-uso/01-cu-general/01-cu-general.png) llega a RF-085. ¿Cuál versión es normativa? Nunca citar RF sin versión. |
| Cantidades y módulos | A resumen ES/EN p. 4: 26/24 frente a 30/18; §4.2 31/14; D p. 3 30/18, §2.1 afirma seis módulos pero enumera cinco; V3 D-01: 25 RF propuestos, RF-026…030 por confirmar. ¿Alcance aprobado? |
| RNF homónimos | A §3.2 pp. 16–18 y D §4 pp. 11–12: RNF-008 = sesión; A §4.3 pp. 24–26: RNF-008 = disponibilidad, RNF-009 = recuperación, RNF-011 = modularidad. ¿Catálogo normativo? |
| TG-06 | [F §4 pp. 38–40](../original/Fundamento%20teorico.docx.pdf): cierre no cognitivo; V3 RF-010, 014, 016 llama TG-01…06 «evaluativas». ¿Excluir TG-06 de cálculo, intentos y catálogo de indicadores? Aquí se trata como cierre. |
| Consentimiento/estados | [DBML](../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml): 1:1, APROBADO/PENDIENTE/RECHAZADO, sin fechas de revocación. V3 RF-008 pide vigencia/revocación/traza; D §2.2 p. 6 usa VIGENTE y PENDIENTE_CONSENTIMIENTO. [Estado estudiante](../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/04-estados/02-estados-gestion-estudiantes/02-estados-gestion-estudiantes) sugiere retiro → eliminado/anonimizado frente a conservación V3 RF-006. ¿Modelo temporal, retención, tratamiento al revocar? |
| Stack y sesiones | D §§2, 6 pp. 4–8, 14–16 alterna PostgreSQL/MySQL, JWT directo y Better Auth/opaque→JWT, Hono/Drizzle; [PUML tareas](../original/C4/UML/moduloTareas.puml) muestra NestJS, TypeORM/Prisma. ¿Qué stack y mecanismo de expiración/revocación? |
| Ingesta | D §2.2 p. 6 propone envío JSON comprimido al final vía `POST /api/v1/tasks/results`; PUML tareas propone `submitEventBatch`, `batchSequence` y lotes de 50. ¿Envío final/lotes/por ítem, idempotencia y confirmación? |
| Indicadores | F §5 pp. 42–50: fórmulas parciales sin umbral universal; V3 RF-016…018 requiere fichas, exclusiones, tolerancias/versiones por aprobar (D-05); [PUML evolución](../original/C4/UML/moduloEvolucion.puml) añade `memorySpan`, `semanticTaskScore` a TG-03 y `sufficiency_logs` ausente en ERD. ¿Fórmulas y persistencia finales? |
| Valores ausentes | V3 RF-018 y F §5.12 p. 50 prohíben cero artificial; A §4.4 p. 26 denomina RF-018 «suficiencia» pero §4.2 p. 21 RF-018 «aviso». ¿Estados/motivos y umbrales por tarea? |
| Escalas y campos | V3 RF-009, 023/024 exige escalas institucional/cualitativa aprobadas; no están registros escolares ni acta. DBML `score numeric(3,2)` y `term int` nota 1–4, sin rango confirmado. ¿Escala, categoría, obligatoriedad, unicidad y ventana de edición? |
| Modelo incompleto | V3 RF-025 separa anotaciones, pero DBML carece de tabla; asignación grupal en DBML vs individual/grupal V3 RF-015; fila de indicadores 1:1 con varias métricas, sin versiones/condiciones suficientes para V3 RF-017. El 1:1 no obliga a cambiar cardinalidad: diseñar cobertura e historial. |
| UX interpretativa | D §2.2 p. 6 propone rangos Bajo/Medio/Alto; A §2.2 p. 8 contempla semáforos; F §§5.16, 6.15–20 pp. 52, 59–60 prohíbe categorías «bajo» de desempeño cognitivo y semáforos diagnósticos. ¿Representación descriptiva aprobada? |
| Acceso de estudiante (alcance aclarado) | [C4 contenedores](../original/C4/contenedores.jpeg) dice «se identifica con código»; D §6 trata Better Auth para usuarios. El responsable aclaró estudiante en otro servicio: no añadir cuentas STUDENT aquí. IN-01 debe resolver autorización de integración. |
| Fuentes citadas ausentes | A pp. 6–12, 51 cita Plan de Trabajo, SRS, apéndices de entrevistas/observación, registros académicos, validación SQA e instrumentos: no hay copias independientes en `docs/original/`. No inventar respuestas de campo, escalas ni políticas. |

**Inferencia organizativa:** cinco módulos de V3/C4 se usan como mapa de consulta, no como aprobación de límites. Auditoría, exportación y retiro figuran en A/D/diagramas pero no en 25 RF V3; revisar V3 D-01…D-10 antes de especificarlos.
