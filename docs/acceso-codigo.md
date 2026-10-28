# J-03 · Acceso por código

## Decisiones y alcance

Fuente propuesta: `Kudlab-play/especificaciones-juegos/{README,03-acceso-estudiantil-por-codigo,02-integracion-kudlab-extremo-a-extremo,contrato-runtime-v1}.md`, leída en la copia original no versionada, sin modificarla.
El responsable aprobó D2–D8 y el plan el 2026-10-27. Cambió D1 a **cinco caracteres alfanuméricos**, por ejemplo sintético `ERD34`, no cinco números: alfabeto uniforme `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, 25 bits, sin separador de presentación. Se aceptan minúsculas, espacios y guion ASCII; no Unicode/homoglifos. No se autocorrigen caracteres.

La aclaración posterior confirmó contadores caducados tras 15 minutos sin actividad y limpieza cada 5 minutos. La restricción histórica de inicialización frontend se aclaró en su AGENTS: gestión docente aquí, entrada/experiencia infantil exclusivamente en Play. Sin cuentas STUDENT, impresión, mensajería automática, mascota ni mecánicas nuevas.

**Entrega técnica sintética, no habilitación real.** Los códigos acreditan posesión, no identidad física. Cinco caracteres tienen 33.554.432 combinaciones y menos protección frente a adivinación que los ocho propuestos originalmente. Las pruebas no validan esa política para menores reales. G-01…G-04 siguen abiertos; el arranque normal conserva participación UNAVAILABLE, sin checkbox, seed ni bypass.

## Base y cambios

Fetch comprobado: backend `1756301` (PR #14), frontend `acb9134` (PR #11), Play `2822769` (PR #1), todos origin/main con J-02 integrada. Worktrees `/tmp/opencode/kudlab-{backend,frontend,play}-j03`, rama `feat/j03-acceso-codigo` en cada repositorio. Sin merge ni cambios en los checkouts anteriores.

- Migración aditiva `0012_j03_access_codes.sql`: códigos cifrados, canjes vinculados y contadores compartidos; procedencia CODE, FK/checks/triggers e invalidación en transferencia. No cambia intentos, sobres, evidencia ni fórmula.
- Preparación compartida en `runtime/service.ts`; mismo start/results/receipt y procesador. No hay otra ingesta. READY ajeno o preparado por otra vía no se toma; se resuelve/caduca primero. Repetición propia conserva claimId/secreto. Nunca se convierte una sesión supervisada histórica en CODE.
- Juego: hasta emisión + 7 días, limitado por fin de asignación. Un código activo por destinatario; lote máximo 100, atómico, reutiliza vigente. Asignación futura permite emitir pero no empezar.
- Recuperación: un SUBMIT_ONLY por sesión, 24 h; nueva capacidad solo de entrega/acuse, máximo 24 h y limitada por expiración del código. No exige disponibilidad de juego abierta; sí política de recepción. Código de juego vigente permite recuperar su destinatario.
- Si ya hay acuse, emisión requiere `reconcileReceipt=true` explícito. Confirma solo ese submission; nunca sustituye un paquete diferente.
- Revocación/reemplazo bloquea READY y expira su preparación; RUNNING conserva su entrega autorizada. Transferir curso revoca ambos alcances en la transacción SQL, sin acceso nominal ADMIN ni restauración del código al transferir de vuelta.
- Desactivar `GAME_ACCESS_ENABLED` deniega nuevas operaciones de códigos sin modificar ingesta/capacidades ya autorizadas ni el inicio supervisado.

## Secretos, transporte y límites

`GAME_ACCESS_ENABLED=false` por defecto. Para habilitar el transporte técnico configurar `GAME_ACCESS_LOOKUP_KEY`, `GAME_ACCESS_IP_KEY` (hex de 32 bytes distintos), `GAME_ACCESS_KEYS` (mapa JSON de claves AEAD de 32 bytes) y `GAME_ACCESS_ACTIVE_KEY_ID`, además de las variables J-02. Usar claves dedicadas externas a Git/BD/SPA; nunca VITE para secretos. No reutilizar claves de grants/cursores.

Búsqueda HMAC-SHA256; revelado AES-256-GCM con AAD de ID/alcance/destinatario. El listado/lote solo devuelve metadatos. Revelado exige sesión TEACHER persistida y responsabilidad actual. Cifrado, códigos, capacidades, paquetes y portapapeles no se registran. Respuestas no-store, orígenes exactos; canjes sin cookies ni Authorization docente, JSON acotado a 4 KiB antes de parsear.

Límites comunes a claim/recover en PostgreSQL, independientes del login y del limitador por capacidad de J-02:

- IP: ventana móvil de 120 solicitudes/5 min y balde adicional de ráfaga 60, reposición 0,4/s. Incluye cuerpos malformados. No requiere CAPTCHA ni produce bloqueo permanente.
- Código normalizado: 10 operaciones nuevas/15 min, incluidas fallidas. Huella de operación liga claim/secreto/alcance/sesión/submission; reintento idéntico no añade entrada. Reconciliación ya vinculada revalida la capacidad. La IP sí contabiliza reintentos.
- Claves IP seudonimizadas por HMAC, sin IP en claro ni historial de navegación; solo eventos operativos acotados. Caducidad tras 15 min sin actividad; limpieza cada 5 min y evaluación de ventana/fecha en cada solicitud. Caída de BD deniega con 503, no usa fallback en memoria. 429 devuelve Retry-After.
- Se utiliza **la IP del socket**, no X-Forwarded-For. La verificación local es conexión directa. No desplegar tras un proxy suponiendo identidad individual: no hay política de proxies aprobada/implementada en este corte. Puede agrupar todo el proxy en un bucket; requiere configuración y verificación explícitas antes de habilitación real.

Rotación de cifrado: conservar las claves antiguas necesarias para revelado y seleccionar una activa nueva. Rotación HMAC: deshabilitar nuevos canjes, revocar códigos afectados, cambiar la clave y emitir/distribuir accesos nuevos de forma controlada; no activar dos espacios de búsqueda. No borrar capacidades de entrega ni evidencia. No se implementa purga legal del historial.

## Contrato

`npm run game:contract` genera el artefacto **1.2.0** aditivo en `contract/runtime-1.2.0`, más OpenAPI (58 operaciones/12 tags). Versiones de sobre **1.0 y 1.1 sin cambios**. El artefacto 1.1.0 anterior se conserva; Play fija una copia nueva en `contract/kudlab-runtime-1.2.0` por manifiesto SHA-256, sin imports del filesystem de otro repositorio.

```sh
npm run game:contract -- /ruta/Play/contract/kudlab-runtime-1.2.0
npm run docs:check
```

## Distribución y almacenamiento

Profesor: asignación → selección consciente → confirmar generación → fila individual → mostrar/copiar código o mensaje. El mensaje incluye tarea, URL pública genérica, código y fecha/zona; no nombres/documentos ni secretos en URL. Solo confirma «Copiado» tras éxito del Clipboard API, con texto seleccionable si falla. No equivale a enviado/recibido. Compartir individualmente por el canal autorizado existente; no proyectar listas. El código se oculta al perder foco/visibilidad/navegar/suspender acceso; no se persiste en storage docente.

Play público: `/` permite pegar/escribir un único campo real; canje online → instrucciones/ejemplo/preflight/inicio existentes. IDs y secreto se guardan antes del canje; código solo transitorio en UI/memoria. Si una respuesta se pierde y se recarga, reingresar el mismo código reconcilia la operación conservada; no se reintenta automáticamente un código sin interacción. No se reanuda medición.

`/pendientes`: entrega automática con la credencial propia de cada sesión; si vence, código del destinatario o SUBMIT_ONLY para el pendiente seleccionado. No adapta IDs para buscar coincidencias, no muestra nombres/respuestas/métricas ni ofrece reconstruir lo borrado. Solo un acuse válido permite limpiar. Despliegue estático debe resolver directamente `/pendientes` al shell; el SW solo resuelve recursos propios, nunca API/evidencia.

**Origen, perfil y partición importan:** un pendiente del Play público no se recupera suponiendo que el iframe docente comparte IndexedDB, ni al revés. La recuperación supervisada conserva RECOVERY_REQUESTED/RECOVERY_UNAVAILABLE y su contexto original. Sin copia local, explicar dónde buscar, no afirmar ausencia en otros dispositivos.

## Verificación reproducible

Node 24 y npm. Contenedor/BD nuevos y desechables, sin SMTP real. No reutilizar BDs anteriores ni ejecutar fixtures sobre datos reales. La guarda sintética existente exige nombres `kudlab_j02_*test`; por eso las BDs J-03 conservan ese prefijo, sin ampliar la guarda.

Se preparó `kudlab-j03-isolated` (PostgreSQL 17, puerto loopback 55443), BDs separadas `kudlab_j02_j03_unit_test`, `kudlab_j02_j03_browser_test` y `kudlab_j02_j03_migration_test`. Las contraseñas de ejemplos locales son exclusivamente sintéticas. No ejecutar suites destructivas y navegador sobre la misma BD.

```sh
DATABASE_URL=postgres://postgres:j03_synthetic_only@127.0.0.1:55443/kudlab_j02_j03_unit_test npm run db:migrate
DATABASE_URL=postgres://postgres:j03_synthetic_only@127.0.0.1:55443/kudlab_j02_j03_unit_test npm test
NODE_ENV=test DATABASE_URL=postgres://postgres:j03_synthetic_only@127.0.0.1:55443/kudlab_j02_j03_migration_test node --import tsx tests/access-migration.ts
```

Migración: la última BD debe estar vacía; el script instala J-02, inserta historia sintética READY/INTERRUPTED/acuse y aplica J-03, sin truncar. Verifica conservación e inmutabilidad SQL.

Navegador: runner `tests/game-server.ts`, PORT=4313, BETTER_AUTH_URL=http://localhost:4313, SPA_ORIGIN=http://localhost:5183, GAME_RUNTIME_ORIGIN=http://127.0.0.1:4183, DATABASE_URL de navegador, claves de prueba dedicadas según configuración anterior. El runner inyecta exclusivamente participación sintética y correo capturado, nunca arranque productivo.

Frontend: build con `VITE_API_ORIGIN=http://localhost:4313 VITE_PLAY_ORIGIN=http://127.0.0.1:4183`, servir `PORT=5183 node tests/browser/serve-build.mjs`. Play: build con `VITE_API_ORIGIN=http://localhost:4313 VITE_TEACHER_ORIGIN=http://localhost:5183`, servir `PORT=4183 node scripts/serve-production.mjs`. Son servidores de verificación de builds/cabeceras, no hosting productivo. Puertos separados de procesos ajenos.

```sh
KUDLAB_TEACHER_ORIGIN=http://localhost:5183 KUDLAB_API_ORIGIN=http://localhost:4313 KUDLAB_PLAY_ORIGIN=http://127.0.0.1:4183 \
KUDLAB_J02_BACKEND_DIR=/ruta/backend KUDLAB_J02_DATABASE_URL=postgres://postgres:j03_synthetic_only@127.0.0.1:55443/kudlab_j02_j03_browser_test \
npx playwright test --config=playwright.integration.config.ts
```

Las variables backend/BD son obligatorias para la demostración J-03: la caducidad de capacidad se provoca con CLI exclusivo de fixtures; no hay ruta de bypass. J-02 conserva su prueba supervisada y sus variables. Los códigos utilizables no se incluyen en trazas ni capturas de J-03. No publicar perfiles de prueba/IndexedDB, Authorization, portapapeles ni resultados reales.

Resultados y límites concretos se registran en `docs/acceso-codigo-verificacion.md`; los comandos y criterios anteriores no son por sí solos pruebas superadas.
