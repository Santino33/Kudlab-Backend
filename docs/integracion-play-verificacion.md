# J-02 · Evidencia de verificación · 2026-10-27

Entrega técnica sintética, no habilitación con participantes reales.

## Bases y aislamiento

| Proyecto | Base consultada | Implementación local sin commits automáticos |
| --- | --- | --- |
| Backend | `49eb040` | `/tmp/opencode/kudlab-backend-integracion-play`, rama `feat/integracion-play` |
| Frontend | `52369c0` | `/tmp/opencode/kudlab-frontend-integracion-review`, rama `feat/integracion-play` |
| Play | `3d82ca9` | `/tmp/opencode/kudlab-play-integracion`, rama `feat/integracion-kudlab` |

Los checkouts originales permanecen sin cambios. La carpeta original no versionada
`Kudlab-play/especificaciones-juegos/` se conservó y no se sobrescribió.

PostgreSQL 17 en contenedor nuevo `kudlab-j02-isolated`, puerto loopback 55439:
`kudlab_j02_test` para suite destructiva, `kudlab_j02_browser_test` para navegador y
`kudlab_j02_migration_test` para preservar filas al migrar. No se usaron la BD
existente, SMTP real ni datos de menores. Los profesores/participantes son ficticios.

## Comandos y resultados observados

| Comprobación | Resultado |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` en los tres worktrees | Correcto; sin dependencias nuevas. |
| Backend `npm run typecheck` | Correcto. |
| Backend `DATABASE_URL=…/kudlab_j02_test npm test` | **42 archivos, 262 pruebas correctas**, incluida regresión y carga sintética de 30 clientes Hono/PostgreSQL. |
| Backend `npm run docs:check` | **22 pruebas correctas**; OpenAPI completo y publicación por entorno. La regresión completa incluye estos controles. |
| Drizzle `npm run db:migrate` en ambas BDs de pruebas | `0010`/`0011` aplicadas correctamente. |
| `NODE_ENV=test DATABASE_URL=…/kudlab_j02_migration_test node --import tsx tests/game-migration.ts` | Aplica SQL previo, inserta filas ficticias y aplica J-02: cuentas/cursos/estudiantes/catálogo/versiones sin cambios; versiones sin configuración siguen sin configuración. Solo admite BD vacía identificada, no trunca ni borra. |
| Backend `npm run game:contract -- …/Play/contract/kudlab-runtime-1.1.0` | Artefacto generado desde backend y fijado por hashes; tipos consumidos por Play. |
| Frontend `npm test` + build | Tipos y build correctos. `npm test` por sí solo **no** es prueba funcional. |
| Frontend `test:auth`, `test:usuarios`, `test:tareas`, `test:estudiantes` | **66 + 72 + 16 + 26 = 180 pruebas correctas**. |
| Play `npm run typecheck`, `npm run lint`, `npm test` | Correctos; **7 archivos, 51 pruebas correctas**. |
| Play build y `npm run check:production` | Correctos; sin simulador, bypass, fixtures ni CDN en dist. |
| `git diff --check` en los tres worktrees | Correcto. |
| Inspector real de UI docente autenticada, 1440/768/390 | **0 FAIL, 0 WARN**; consola sin errores en esas vistas. |

Las claves de pruebas y las URLs literales son sintéticas. Los comandos completos
de preparación/ejecución están en [la guía](integracion-play.md).

## Recorrido de navegador real

Play `playwright.integration.config.ts` con builds estáticas, cabeceras CSP aplicadas,
API Hono por TCP y PostgreSQL reales. Sin simulador J-01, sin consultas de resultados
mockeadas ni duración acelerada. Comando exitoso con ambas variables de pruebas:

```sh
KUDLAB_J02_BACKEND_DIR=/tmp/opencode/kudlab-backend-integracion-play \
KUDLAB_J02_DATABASE_URL=postgres://postgres:j02_synthetic_only@127.0.0.1:55439/kudlab_j02_browser_test \
npx playwright test --config=playwright.integration.config.ts
```

**1 prueba integrada correcta, aproximadamente 2,6 minutos**, que comprueba:

1. Login TEACHER, curso/estudiante ficticio, asignación explícita con dos intentos.
2. Puente seguro, claim real, comenzar autorizado y ejecución de **120 segundos**.
3. Pérdida de conexión, finalización, evidencia pendiente y **recarga del iframe offline**.
4. Reconexión, mismo paquete recibido y confirmación docente desde la API.
5. Procesamiento real, consulta de evidencia y captura a 1440/768/390/320 sin
   desbordamiento horizontal de la página; las tablas tienen desplazamiento propio.
6. Segundo inicio consciente de esa asignación, interrupción y entrega bloqueada.
7. CLI exclusivo de fixtures caduca su capacidad en la BD sintética; la API real
   devuelve 401. Recuperación supervisada, grant nuevo solo de entrega y acuse.
8. Evidencia de esa misma sesión guardada, parcialidad visible e **intento 2**, no 3.

La indisponibilidad inicial y un selector de prueba incorrecto se corrigieron antes
de esa pasada. La prueba también detectó y corrigió una consulta docente prematura
al terminar offline: ahora se confirma al reconectar, sin relajar AuthRoot.

## Transacciones, permisos y recuperación

Las pruebas PostgreSQL comprueban: duplicado idéntico/conflictivo, respuesta perdida
reconciliable, canjes/inicios concurrentes, una sola ejecución activa, consumo único,
transferencia de responsabilidad, ADMIN/ajeno denegados, consentimiento sintético
revocado, capacidad caducada, recuperación sin otro intento, lease vencido y dos
procesadores, reintento idempotente de cálculo, paginación ligada a filtros y falta
de bypass de participación en composición normal.

Inyección SQL temporal **solo en BD aislada** provoca fallo al insertar el segundo
ensayo: ni acuse ni eventos ni job parciales sobreviven. Al quitar ese fallo, el
mismo paquete se acepta. Los triggers impiden editar evidencia y las condiciones
históricas. Fórmulas: fixture 75/25/50 %, mediana 500 ms, SD 163,299316 ms y
CV 32,659863 %, con tolerancia 1e-6; motivos explícitos para insuficiencia/exclusión.

## Revisión visual

Se conserva la dirección/marca docente, familia system-ui y componentes locales;
no se sorteó otro sistema visual ni se incorporaron activos externos. Pregunta de
la pantalla: **¿se recibió y procesó este intento y qué evidencia lo respalda?**
La respuesta aparece primero, seguida por contexto, conteos, tabla e incidencias.

Se revisaron las capturas de todos los anchos, se corrigieron el enlace de retorno
estirado, el orden de indicadores (sesión antes de segmentos), la representación
JSON de decisiones y los saltos dentro de etiquetas/unidades. Las ausencias usan
raya y motivo; no se inventan ceros ni categorías clínicas. El aviso de unidades
queda fuera de la región desplazable para seguir legible en móvil.

Inspector mediante `tests/browser/inspect-activities.mjs`, autenticación real contra
el runner sin exportar cookies. Evidencia temporal: `/tmp/opencode/j02-inspect/`;
capturas E2E: `Kudlab-play` worktree, `test-results/kudlab-integration/`.
Lint visual sin FAIL; la advertencia sobre rayas se justifica porque representan
valores ausentes exigidos por contrato, no ornamentación de texto.

Valoración cualitativa: claridad y coherencia correctas; densidad aún mejorable
en una tabla de 24 indicadores. No es una evaluación con profesores ni una nota
de accesibilidad. No se atribuyen resultados de producción a una captura estática.
Autoevaluación visual orientativa: claridad 8/10, coherencia 9/10 y densidad 7/10.

## Límites y aceptación pendiente

- **G-01…G-04 siguen abiertos para uso real**: consentimiento/activación,
  conservación/revocación, metodología/pilotaje y distribución. El adaptador
  institucional no se implementó ni se sustituyó por isActive, seeds o checkbox.
- La carga de 30 clientes es sintética sobre API/BD; **no** demuestra 30 navegadores
  ejecutando el juego ni capacidad de hardware. J2-AC22 queda parcialmente verificado.
- No se probaron dispositivo táctil físico, Safari/iOS, lector de pantalla, zoom
  400 % ni auditoría WCAG. No se afirma equivalencia entre tamaños/orientaciones.
- Se verificó recuperación de trabajo/lease con BD real; no se ejecutó un ensayo
  de apagado forzado de todo el despliegue ni una restauración completa de backups.
- No se desplegó hosting productivo ni se certificaron cabeceras fuera de loopback.
  El `_headers` debe aplicarse en hosting. No se realizó downgrade destructivo de BD.
- No se repitió la suite de navegador del **simulador J-01**: sus puertos 4173/4174
  estaban ocupados por procesos ajenos. No se detuvieron ni se reutilizaron para
  afirmar pruebas del worktree. Sí se ejecutaron sus unitarias y la nueva suite
  integrada contra builds de este trabajo en puertos separados.
- Sin commits, merges, despliegue ni habilitación con datos reales automáticos.
