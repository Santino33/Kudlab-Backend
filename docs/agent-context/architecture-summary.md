# Arquitectura: backend actual y diseño de referencia

## Estado observado en esta base

**Actualización Cursos 2026-10-26:** sobre base `c989fae`, esta rama monta siete operaciones adicionales de grupos/cursos, con sesión persistida y rol exacto revalidado transaccionalmente. ADMIN organiza/asigna, TEACHER consulta cursos propios y sus estudiantes; ADMIN sin acceso estudiantil. OpenAPI actual: **35 operaciones / 9 tags**, incluyendo Tareas ya existente. [Fuentes, alcance y evidencia](../feature-specs/academico/02-cursos.md). Las exclusiones y cifras del párrafo histórico siguiente no describen esta ampliación.

Revisión del catálogo sobre la base `096a8fa`, actualizada por la feature 006. Existe una API Node.js 24/TypeScript, Hono, Better Auth, Drizzle y PostgreSQL; versiones en [package.json](../../package.json). Usuarios implementa cuentas, recuperación, invitaciones y solicitudes de ascenso. Académico implementa cinco operaciones de estudiantes bajo `/api/v1/students`, operadas por profesores TEACHER sobre su ámbito propio; los estudiantes no acceden ni tienen cuentas aquí. No hay endpoints de grupos, consentimiento, notas, Tareas, Evolución o Seguimiento disponibles. El [catálogo OpenAPI actual](../api/openapi.yaml) cubre las 26 operaciones; Swagger UI `/docs` y `/openapi.yaml` solo están habilitados en desarrollo/pruebas explícitos. Ver también [mapa de implementación](implementation-guide.md), contrastando sus referencias históricas con el código.

El frontend de profesores y el servicio externo de juegos no viven aquí. Los diagramas antiguos agrupan las interfaces de profesores y estudiantes como «UI»; eso describe la plataforma completa, **no el límite de este repositorio**. Ver [alcance](project-context.md) y [límites](module-boundaries.md).

**Autenticación real:** `requireActive` resuelve una sesión persistida de Better Auth, verifica identidad/cuenta activa y actividad en servidor. Un JWT firmado por sí solo no pasa esa guarda. Existen plugins JWT/Bearer y rutas de emisión, pero no confundirlo con el flujo JWT exclusivo propuesto por D/PUML. Google aparece en el diseño, no está habilitado en la configuración actual. Consultar [guardas](../../src/auth/session-guard.ts), [configuración](../../src/auth/auth.ts) y contratos de [autenticación](../../specs/003-autenticar-usuarios/contracts/auth.openapi.yaml).

## Diseño original y su alcance

SPA cliente → API REST → BD relacional, más almacenamiento de objetos para audios/imágenes y evidencias privadas. C4 distingue UI, API con Usuarios, Académico, Tareas, Evolución y Seguimiento, BD y objetos. Tres capas: presentación, negocio y persistencia; autorización transversal. [D §§2.1–2.4 pp. 4–8](../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf), [contenedores](../original/C4/contenedores.jpeg), [componentes](../original/C4/componentes.jpeg).

| Componente | Responsabilidad documentada |
| --- | --- |
| UI | Vistas por actor; captura de eventos/tiempos en navegador; audio y gráficos. |
| Usuarios | Identidad, sesiones y control por rol/ámbito; diseño de intercambio Better Auth → JWT. |
| Académico | Estudiantes, grupos, notas, consentimiento; metadatos en BD y archivos en R2 propuesto. |
| Tareas | Configuración, asignación, sesiones, estados y eventos recuperables. |
| Evolución | Suficiencia, cálculo por tarea y trayectoria individual. |
| Seguimiento | Ficha que reúne indicadores, observaciones y notas; presentación y anotaciones. |

**Stack histórico** en D §§6.1–6.4 pp. 14–16: Hono/Better Auth/Drizzle/PostgreSQL, React/Vite/gráficos, R2 y Docker; §§2.1/2.4 y PUML muestran alternativas MySQL/NestJS/TypeORM/Prisma. Para modificar este backend usar el stack implementado arriba; no reabrir esa elección ni añadir frameworks de diagramas. R2, despliegue y frontend siguen siendo propuestas, no capacidades verificadas.

**Contrato explícito y limitado:** D §2.2 flujo B p. 6 menciona `POST /api/v1/tasks/results` con paquete JSON comprimido de métricas, HTTPS/TLS 1.2+ y confirmación/persistencia; no documenta campos JSON, código de éxito ni errores. D §6 pp. 14–16 propone `/api/auth/*`, `/api/v1/*` y `Authorization: Bearer <JWT>`; métodos en PUML son firmas de diseño, no rutas. D §2.2 flujo A p. 6 menciona HTTP 400 por datos inválidos al registrar estudiante, sin ruta.

**Calidad:** A §3.2 pp. 16–18: observación <3 min tras inducción ≤15 min, botones ≥44px/audio, API p95 <2s, panel ≤3s, recálculo ≤10s, 30 usuarios, assets ≤5 MB/tarea, disponibilidad ≥95% horario escolar, respaldo ≤24h, sesión 30 min. D §4 pp. 11–12 propone TLS 1.2+, AES-256, bitácora append-only, OpenAPI y Docker. A §4.3 pp. 24–26 usa ID RNF-008…014 con otro significado: citar siempre fuente y texto.

**Modelo lógico:** [DBML](../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml), [ERD PUML](../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/ERD-plantuml.puml) proponen 13 tablas; modelos por módulo conservan tipos/cardinalidades. No se determina nulabilidad general, ni hay tabla para anotaciones, catálogo de fórmulas o versión histórica de configuración. [Decisiones](decisions.md).

## Reglas para evolucionar la arquitectura

- No convertir nombres de clases o patrones UML en obligación de crear interfaces, repositorios, factories o colas. Separar rutas, negocio y persistencia proporcionalmente al caso; conservar las convenciones actuales.
- Los esquemas Drizzle y migraciones de `src/db/` son la evidencia de tablas existentes, no el ERD de las fuentes. Identidad de autenticación y cuenta de negocio ya son distintas.
- Acordar contratos entre módulos antes de escribir datos de otro dominio; la matriz está en [responsabilidades](module-boundaries.md).
- Las cifras de calidad anteriores son referencias de diseño, no mediciones ni criterios aprobados para cualquier endpoint. Distinguir latencia del API de tiempo de reacción del estudiante medido por el servicio de juegos.
- No declarar cumplimiento legal, cifrado de columnas, inmutabilidad global o recuperación ante fallos sin verificar controles y pruebas. La auditoría existente de cuentas no cubre automáticamente datos académicos futuros.
