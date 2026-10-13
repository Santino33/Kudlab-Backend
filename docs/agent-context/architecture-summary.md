# Arquitectura documentada (diseño, no inventario de implementación)

SPA cliente → API REST → BD relacional, más almacenamiento de objetos para audios/imágenes y evidencias privadas. C4 distingue UI, API con Usuarios, Académico, Tareas, Evolución y Seguimiento, BD y objetos. Tres capas: presentación, negocio y persistencia; autorización transversal. [D §§2.1–2.4 pp. 4–8](../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf), [contenedores](../original/C4/contenedores.jpeg), [componentes](../original/C4/componentes.jpeg).

| Componente | Responsabilidad documentada |
| --- | --- |
| UI | Vistas por actor; captura de eventos/tiempos en navegador; audio y gráficos. |
| Usuarios | Identidad, sesiones y control por rol/ámbito; diseño de intercambio Better Auth → JWT. |
| Académico | Estudiantes, grupos, notas, consentimiento; metadatos en BD y archivos en R2 propuesto. |
| Tareas | Configuración, asignación, sesiones, estados y eventos recuperables. |
| Evolución | Suficiencia, cálculo por tarea y trayectoria individual. |
| Seguimiento | Ficha que reúne indicadores, observaciones y notas; presentación y anotaciones. |

**Stack propuesto** en D §§6.1–6.4 pp. 14–16: Node.js/TypeScript + Hono, Better Auth plugins JWT/Bearer + jose/JWKS, Drizzle/PostgreSQL, React/JavaScript + Vite, Chart.js/react-chartjs-2, Fetch/Web Audio API, Cloudflare R2 Standard, Docker/Compose. D §§2.1/2.4 también sugiere PostgreSQL/**MySQL** y JWT directo; los PUML C4 rotulan **NestJS** y **TypeORM/Prisma**. No convertir alternativas en tecnología confirmada: [pendientes](unresolved-issues.md).

**Contrato explícito y limitado:** D §2.2 flujo B p. 6 menciona `POST /api/v1/tasks/results` con paquete JSON comprimido de métricas, HTTPS/TLS 1.2+ y confirmación/persistencia; no documenta campos JSON, código de éxito ni errores. D §6 pp. 14–16 propone `/api/auth/*`, `/api/v1/*` y `Authorization: Bearer <JWT>`; métodos en PUML son firmas de diseño, no rutas. D §2.2 flujo A p. 6 menciona HTTP 400 por datos inválidos al registrar estudiante, sin ruta.

**Calidad:** A §3.2 pp. 16–18: observación <3 min tras inducción ≤15 min, botones ≥44px/audio, API p95 <2s, panel ≤3s, recálculo ≤10s, 30 usuarios, assets ≤5 MB/tarea, disponibilidad ≥95% horario escolar, respaldo ≤24h, sesión 30 min. D §4 pp. 11–12 propone TLS 1.2+, AES-256, bitácora append-only, OpenAPI y Docker. A §4.3 pp. 24–26 usa ID RNF-008…014 con otro significado: citar siempre fuente y texto.

**Modelo lógico:** [DBML](../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml), [ERD PUML](../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/ERD-plantuml.puml) proponen 13 tablas; modelos por módulo conservan tipos/cardinalidades. No se determina nulabilidad general, ni hay tabla para anotaciones, catálogo de fórmulas o versión histórica de configuración. [Decisiones](decisions.md).
