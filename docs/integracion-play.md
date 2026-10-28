# J-02 · Integración supervisada con Kudlab Play

**Actualización de la vista de pruebas (2026-10-28 UTC):** `tests/game-server.ts` usa [participación sintética de registros activos y altas activas](pruebas-estudiantes-play.md), también para estudiantes nuevos. El runner normal de suites conserva autorizaciones explícitas por ID para probar revocación. El arranque normal sigue sin otorgar participación real.

**Ampliación posterior J-03:** la vía supervisada se conserva. La guía actual de
códigos, configuración y artefacto aditivo 1.2.0 está en [acceso por código](acceso-codigo.md).
Las cifras de 50 operaciones/sin códigos inferiores describen la entrega J-02;
el catálogo actual tiene 58 operaciones/12 tags. No sobrescribir el artefacto histórico 1.1.0.

## Alcance y decisiones

Fuente: `Kudlab-play/especificaciones-juegos/{README.md,02-integracion-kudlab-extremo-a-extremo.md,contrato-runtime-v1.md}` y `Kudlab-play/docs/contract-1.1.md`.
El responsable confirmó el 2026-10-27: nuevas partidas con contrato **1.1**, conservación
del 1.0 histórico, entrega técnica ficticia/aislada y propuestas P-02/P-04/P-05/P-08/P-09/P-10.
La adaptación gráfica existente no añade mecánicas: TG-01 sigue durando 120 s con tres
segmentos de 40 s. No se declara equivalencia entre tamaños de pantalla ni validación clínica.

Implementación: asignaciones inmutables por destinatario, preparación sin consumo,
inicio confirmado, capacidad por sesión, paquete final inmutable, ingesta atómica,
acuse estable, procesamiento recuperable y consulta individual docente. Sin J-03,
cuentas estudiantiles, Redis, otro backend o endpoints paralelos de evidencia.

## Seguridad y elegibilidad

- Solo TEACHER activo con sesión persistida y responsabilidad **actual** del curso.
  ADMIN no obtiene acceso nominal. Una transferencia cambia los permisos actuales,
  no el historial ni el creador de la asignación.
- El arranque normal **no implementa ni concede consentimiento**. El proveedor de
  participación devuelve indisponibilidad y bloquea asignación/inicio/primera ingesta.
- Solo `tests/game-server.ts`/runner de tests inyecta `tests/game-fixture.ts`.
  Se exige `NODE_ENV=test` y BD cuyo nombre coincida con `kudlab_j02_*test`.
  Solo los IDs sintéticos registrados explícitamente y activos son autorizados.
  No hay query, cabecera, ruta ni `demo=true` que cambie esta decisión.
- Configuración y regla se publican mediante `npm run game:publish`: idempotente,
  no habilita TG-01 ni aprueba metodología. El perfil 1.1 queda ligado al build
  `tg01-viewport-rebuild-2`. Las versiones anteriores sin configuración no se rellenan.
- `GAME_RUNTIME_ORIGIN` exacto y separado de `SPA_ORIGIN`; CORS runtime sin cookies,
  negocio docente solo SPA. Las mutaciones nuevas exigen Origin docente. Play usa
  `credentials: omit`. Configurar hosts separados para no compartir cookies con el frame.
- Grants aleatorios de 256 bits, digest de bytes, ciphertext AES-256-GCM con AAD de
  sesión/grant. Claves dedicadas por ID, externas a BD y nunca `VITE_*`.
  Conservar claves antiguas mientras haya grants utilizables; rotar seleccionando
  `GAME_ACTIVE_KEY_ID`, sin quitar claves antiguas a ciegas. No hay purga legal automática.
- Cursores HMAC ligados a filtros. API no-store incluso en errores. No registrar
  cuerpos, Authorization, nombres, códigos escolares ni secretos.
- Límite de cuerpo 1 MiB antes de JSON, 1.000 ensayos/1.000 incidencias sin truncar;
  control de admisión por capacidad/instancia con Retry-After. No acredita defensa
  distribuida contra DDoS; el perímetro necesita sus límites de tráfico.

## Persistencia y cálculo

Migraciones aditivas `0010_game_integration.sql` y `0011_game_history_guards.sql`: 13 tablas nuevas, claves foráneas,
unicidad de intento/acuse, índice parcial de sesión activa y protección SQL del
historial/evidencia. No borra ni renombra tablas previas. El trigger de condiciones
solo permite cancelar una asignación; destinatarios/configuración/evidencia no se editan.

Bloqueo de participante serializa tareas simultáneas incluso entre asignaciones.
READY expira al vencer la preparación; RUNNING pasa a UNCONFIRMED operativamente
tras 32 minutos desde autorización. No se confunde falta de cierre con abandono.
El estado visible se deriva también al consultar, sin depender de cron.

Entrega: 201 tras commit de evidencia, incidencias, cierre y run PENDING. Repetición
idéntica 200 con el mismo acuse; contenido/submission diferente da conflicto.
Una sesión preparada no admite resultados. Cancelación ordinaria/vencimiento de
asignación no destruye una entrega ya autorizada; revocación académica bloquea una
primera ingesta, pero no una reconciliación mínima de evidencia previamente aceptada.

El procesador arranca con la API, consulta cada 5 s, usa lease de 30 s y token de
claim. Solo publica si el token/lease sigue vigente. Cuatro intentos técnicos con
esperas 5/15/60 s; después FAILED permite reintento docente con la misma evidencia.
El cálculo no condiciona el acuse y no hay indicadores parciales publicados.

`TG01-DESCRIPTIVE-1`: precisión, omisión, comisión, mediana de TR de hits válidos,
SD poblacional y CV, por sesión/segmento. Incidencias se evalúan por solapamiento;
red no invalida tiempos locales. Datos ausentes conservan null y motivo; truncados
no se convierten en omisiones/rechazos correctos. Regla PROPOSED solo se calcula
como prueba sintética con la composición de tests. No se publica aprobación real.

## Contrato compartido y puente

Fuente canónica: `src/modules/tareas/runtime/{contract,dto}.ts`.
`npm run game:contract -- /ruta/al/consumidor/contract/kudlab-runtime-1.2.0` genera
JSON Schema, tipos estructurales, fixture sintético, vectores RFC 8785 y manifiesto
SHA-256. J-02 fijó `contract/runtime-1.1.0`; esta rama genera `contract/runtime-1.2.0` sin cambiar sobres. Play consume una copia fijada
sin imports del filesystem de otro repo ni secretos. Los refinamientos cruzados de
tiempo/geometría se prueban además de JSON Schema. OpenAPI incorpora las **50 operaciones**
montadas (15 nuevas); J-03 no está publicado.

RUNTIME_READY → LAUNCH_AUTHORIZATION conserva validación de origen, source, bridgeId
y generación docente. URLs solo llevan IDs públicos de correlación. Los mensajes
de finalización no son acuses: el host consulta su API.

Recuperación desde la ficha: iframe en el **mismo sitio/partición de almacenamiento**,
`recoverySessionId` público. Play busca solo esa sesión y comunica
`RECOVERY_REQUESTED {bridgeId,sessionId,submissionId}` o
`RECOVERY_UNAVAILABLE {bridgeId,sessionId}`. El host revalida y obtiene un grant
restringido a sesión/submission; Play solo sustituye credencial si conserva la copia
local compatible y desbloquea los mismos bytes. Nunca nuevo inicio ni reconstrucción.

## Prueba local reproducible

Usar Node 24, npm y un PostgreSQL **nuevo y desechable**, nunca una BD compartida/escolar.
Ejemplo ejecutado: contenedor Podman `kudlab-j02-isolated`, puerto 55439,
BDs separadas `kudlab_j02_test` (suite destructiva) y `kudlab_j02_browser_test` (navegador).
No ejecutar ambas suites contra la misma BD simultáneamente. Contraseñas de ejemplo
son solo de ese contenedor sintético; no reutilizarlas fuera de pruebas.

```sh
DATABASE_URL=postgres://postgres:j02_synthetic_only@127.0.0.1:55439/kudlab_j02_test npm run db:migrate
DATABASE_URL=postgres://postgres:j02_synthetic_only@127.0.0.1:55439/kudlab_j02_test npm test
```

Para el recorrido de navegador, migrar también `kudlab_j02_browser_test` y ejecutar
el **runner de pruebas** (no `npm start`):

```sh
DATABASE_URL=postgres://postgres:j02_synthetic_only@127.0.0.1:55439/kudlab_j02_browser_test \
BETTER_AUTH_URL=http://localhost:4300 GAME_RUNTIME_ORIGIN=http://127.0.0.1:4178 \
GAME_GRANT_KEYS=$(node -p 'JSON.stringify({test1:"ab".repeat(32)})') \
GAME_ACTIVE_KEY_ID=test1 \
GAME_CURSOR_KEY=$(node -p '"cd".repeat(32)') \
node --import tsx tests/game-server.ts
```

El runner solo prepara fixtures ficticias y correo capturado. Profesor A:
`teacher-a@pilot.edu.co` / `TeacherPass1`; B: `teacher-b@pilot.edu.co` / `TeacherPass1`.
Nunca se envía SMTP real.

En frontend: build con `VITE_API_ORIGIN=http://localhost:4300` y
`VITE_PLAY_ORIGIN=http://127.0.0.1:4178`; iniciar
`node tests/browser/serve-build.mjs` (5173). En Play: build con
`VITE_API_ORIGIN=http://localhost:4300 VITE_TEACHER_ORIGIN=http://localhost:5173`;
iniciar `PORT=4178 node scripts/serve-production.mjs`.
Esos servidores solo verifican builds/cabeceras, no son servidores productivos.

Play: `KUDLAB_J02_BACKEND_DIR=/ruta/al/backend KUDLAB_J02_DATABASE_URL=postgres://postgres:j02_synthetic_only@127.0.0.1:55439/kudlab_j02_browser_test npx playwright test --config=playwright.integration.config.ts` prueba API/BD
reales, sin simulador ni duración acelerada. Los resultados y límites medidos se
registran en `docs/integracion-play-verificacion.md` al finalizar la comprobación.
Las dos variables habilitan además la prueba de credencial vencida mediante el CLI
exclusivo de fixtures `tests/game-expire-capability.ts`: verifica BD sintética y
procedencia antes de caducar la capacidad; nunca autoriza por una ruta de bypass.
Reiniciar el runner antes de repetir una prueba que haya quedado en RUNNING sin cierre.

## Habilitación y despliegue

Publicar solo builds estáticas y aplicar sus `_headers` en hosting real. Las
cabeceras del frontend incluyen frame-src Play; las del juego, frame-ancestors SPA.
`vite preview` no aplica automáticamente esos archivos. HTTPS salvo loopback local.

No retirar un build/contrato ni cambiar de sitio/partición mientras existan paquetes
pendientes. Rollback de **aplicación**, no downgrade destructivo del esquema:
conservar tablas y worker compatible; volver a habilitar el build anterior solo
con su configuración histórica. No convertir evidencia 1.0 en 1.1. Respaldar BD
antes de migrar; verificar restauración en otra BD sintética antes de despliegue real.

Siguen pendientes G-01/G-02 (consentimiento, activación, conservación/revocación),
G-03 (aprobación metodológica/pilotaje), G-04 (distribución/activos) y evaluación
institucional. No hay purga automática ni declaración de cumplimiento legal.
