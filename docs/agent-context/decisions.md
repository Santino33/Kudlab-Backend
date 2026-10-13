# Decisiones registradas y condición

| Decisión | Estado, fundamento y fuente |
| --- | --- |
| Captura de latencias en cliente | ADR-01 declara adoptada: evitar sesgo Wi-Fi, transmitir resultados posteriormente. [D §5 p. 13](../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf); [F §5.3.3 pp. 43–44](../original/Fundamento%20teorico.docx.pdf). |
| SPA + REST por capas | ADR-02 declara adoptada para desacoplar juegos/backend; frameworks concretos conflictivos. D §5 p. 13, [C4](../original/C4/contenedores.jpeg). |
| Consentimiento antes de activar | ADR-03 declara adoptada; V3 RF-008 propone verificar también antes de tarea y revocación. D §5 p. 13, [V3 RF-008 y D-04](../original/requisitos_V3.xlsx). |
| Auditoría append-only | ADR-04 declara adoptada en diseño; V3 D-07 reclama garantía técnica antes de declarar inmutabilidad. D §5 p. 13; V3 D-07. |
| Práctica / cinco tareas / cierre separados | Decisión metodológica: TG-00 y TG-06 no aportan indicador cognitivo. [F §§3.3–4 pp. 17–40](../original/Fundamento%20teorico.docx.pdf). |
| Perfil multidimensional, no diagnóstico ni ranking | Decisión metodológica: variable → indicador → contexto, sin baremos importados ni causalidad individual. F §§2.8–2.10 pp. 12–14, §§5.16–6.20 pp. 52–60. |
| Cinco módulos y 25 RF en V3 | **Propuesta pendiente**: todas las filas RF dicen «Propuesto - corregido para validación»; D-01…10 abiertos. [V3 ambas hojas](../original/requisitos_V3.xlsx). |
| Better Auth/Google, PostgreSQL/Drizzle, R2, Hono y React | «Uso propuesto» D §§6.1–6.4 pp. 14–16; no confundir con PUML NestJS/TypeORM ni afirmar despliegue. |

Para preparar `spec.md`, indicar estado de la fuente y [conflictos pendientes](unresolved-issues.md); un ADR documentado no demuestra implementación ni aprobación de los RF V3.
