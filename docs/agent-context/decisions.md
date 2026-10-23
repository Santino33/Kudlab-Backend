# Decisiones registradas y condición

## Alcance confirmado y hechos actuales

| Registro | Estado y evidencia |
| --- | --- |
| Usuarios humanos de este proyecto = profesores; estudiantes en otro servicio | **Confirmado por el responsable en esta sesión.** ADMIN/TEACHER son roles del personal. Los actores estudiantes de los diagramas corresponden al sistema completo, no a cuentas nuevas aquí. |
| Backend API sin motor de juegos ni frontend | Alcance confirmado; coherente con D ADR-02 (p. 13) y el repositorio. Conserva registro/gestión de tareas, asignaciones y endpoints de integración; no elimina las reglas pedagógicas de las fuentes. |
| Stack actual Hono/TypeScript/Better Auth/Drizzle/PostgreSQL | **Implementación observada**, `package.json`, `src/app.ts`, `src/auth/auth.ts`, `src/db/`. Las alternativas históricas no son motivo para cambiar el stack. |
| Sesión persistida para las rutas actuales | **Implementación observada**, `requireActive` y actividad en servidor. JWT disponible no equivale a autorización JWT exclusiva; Google histórico no está habilitado. |
| Roles y política de perfil/credencial | **Implementación observada**, rol único ADMIN/TEACHER, correo `.edu.co`, contraseña 8–128 con mayúscula/minúscula/número; ver [Usuarios](modules/usuarios/module-summary.md). No son reglas nuevas deducidas del ERD. |
| Límites de escritura por módulo | Guía documentada en [responsabilidades](module-boundaries.md), basada en constitución IV y C4/V3. No fija un protocolo de integración ni autoriza cálculos externos sin decisión. |

Estos registros no ratifican automáticamente todos los RF V3 ni enmiendan la constitución. Las decisiones de integración y metodología que siguen abiertas se identifican en [pendientes](unresolved-issues.md).

## Registro histórico de las fuentes

| Decisión | Estado, fundamento y fuente |
| --- | --- |
| Captura de latencias en cliente | ADR-01 declara adoptada: evitar sesgo Wi-Fi, transmitir resultados posteriormente. [D §5 p. 13](../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf); [F §5.3.3 pp. 43–44](../original/Fundamento%20teorico.docx.pdf). |
| SPA + REST por capas | ADR-02 declara adoptada para desacoplar juegos/backend; frameworks concretos conflictivos. D §5 p. 13, [C4](../original/C4/contenedores.jpeg). |
| Consentimiento antes de activar | ADR-03 declara adoptada; V3 RF-008 propone verificar también antes de tarea y revocación. D §5 p. 13, [V3 RF-008 y D-04](../original/requisitos_V3.xlsx). |
| Auditoría append-only | ADR-04 declara adoptada en diseño; V3 D-07 reclama garantía técnica antes de declarar inmutabilidad. D §5 p. 13; V3 D-07. |
| Práctica / cinco tareas / cierre separados | Decisión metodológica: TG-00 y TG-06 no aportan indicador cognitivo. [F §§3.3–4 pp. 17–40](../original/Fundamento%20teorico.docx.pdf). |
| Perfil multidimensional, no diagnóstico ni ranking | Decisión metodológica: variable → indicador → contexto, sin baremos importados ni causalidad individual. F §§2.8–2.10 pp. 12–14, §§5.16–6.20 pp. 52–60. |
| Cinco módulos y 25 RF en V3 | **Propuesta pendiente**: todas las filas RF dicen «Propuesto - corregido para validación»; D-01…10 abiertos. [V3 ambas hojas](../original/requisitos_V3.xlsx). |
| Better Auth/Google, PostgreSQL/Drizzle, R2, Hono y React | «Uso propuesto» D §§6.1–6.4 pp. 14–16. Parte del stack backend ya está implementada; Google/R2/React y despliegue no se deducen de ello. |

Para preparar `spec.md`, indicar estado de la fuente y [conflictos pendientes](unresolved-issues.md); un ADR documentado no demuestra implementación ni aprobación de los RF V3.
