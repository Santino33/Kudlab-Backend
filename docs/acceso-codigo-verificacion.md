# J-03 · Verificación técnica · 2026-10-27

Solo datos ficticios y BDs nuevas aisladas. No habilita participantes reales ni acredita consentimiento o validación metodológica.

## Bases, entorno y fuentes

- Backend `origin/main` `1756301` (contiene dd9442e, PR #14), frontend `acb9134` (91427e4, PR #11), Play `2822769` (89ea2d3, PR #1), comprobados tras fetch.
- Rama `feat/j03-acceso-codigo` en `/tmp/opencode/kudlab-{backend,frontend,play}-j03`. Cambios locales J-03 no atribuidos a esos commits base. Sin merge, push, PR ni commits automáticos.
- Especificaciones originales leídas en `Kudlab-play/especificaciones-juegos/`, conservadas sin modificación. Decisiones del responsable, diferencias con el borrador y comandos: [guía operativa](acceso-codigo.md).
- Node 24.18.0, npm 11.16.0, Chromium/Chrome local y PostgreSQL 17 real en contenedor nuevo `kudlab-j03-isolated`, 55443 loopback. BDs separadas para unitarias/integración, navegador y migración. Sin SMTP real ni BD anterior reutilizada.
- SPA localhost:5183, API localhost:4313, Play 127.0.0.1:4183. Builds productivas con CSP aplicadas por servidores exclusivos de verificación; no se usaron procesos ajenos de 5173/4300/4178.

## Comprobaciones observadas

| Comprobación | Resultado |
| --- | --- |
| npm ci en los tres worktrees | Correcto, sin dependencias nuevas. Backend SCARF_ANALYTICS=false. |
| Backend typecheck | Correcto. |
| Backend suite completa | **44 archivos / 273 pruebas correctas**, incluida regresión de Usuarios/Cursos/Catálogo/J-02 y controles J-03. |
| Backend focal final J-03/J-02/configuración/contrato HTTP | **4 archivos / 25 pruebas correctas** después de los ajustes finales de ámbito y conteo estable de códigos nuevos/reutilizados. Incluye caducidad real y carga de 30 canjes. |
| OpenAPI docs:check | 22 pruebas correctas; 58 operaciones/12 tags. Rutas implementadas, contratos HTTP comprobados con respuestas reales. |
| game:contract | Artefacto aditivo 1.2.0 generado desde backend y copiado a Play; conserva 1.1.0 y sobres 1.0/1.1. |
| Migración J-03 sobre historia J-02 sintética | Correcta: READY, sesión interrumpida y acuse permanecen idénticos; cambio inválido de procedencia y mutación de evidencia rechazados por SQL. Script solo admite BD vacía identificada. |
| Frontend tipos/build | Correctos. npm test solo comprueba tipos. |
| Frontend test:auth/usuarios/tareas/estudiantes | 66 + 72 + 19 + 26 = **183 pruebas correctas**. |
| Play tipos/lint/build/test | Correctos; **8 archivos / 54 pruebas correctas**. |
| Play check:production | Correcto: sin simulador, fixtures, bypass, CDN ni evidencia/API en SW. |
| Navegador integrado final | **3 pruebas correctas / 5,1 minutos**: J-03 completa, UI/accesibilidad funcional y regresión supervisada J-02; ambas variables backend/BD presentes para caducidad mediante CLI. |
| Inspector real en build final, público y docente | **0 FAIL / 0 WARN** en ambas inspecciones a 1440/768/390; las doce capturas finales se abrieron y revisaron. Se verificó contenido docente cargado, no solo estado de carga. |
| Lint visual del código nuevo | 0 FAIL / 0 WARN, ambos frontends. |
| git diff --check | Correcto en los tres repositorios. |

## Recorrido real de navegador

Play `tests/integration/access-code.spec.ts`, API Hono por TCP, PostgreSQL real y builds sin simulador:

1. Login docente, asignación TG-01 para A/B ficticios, selección consciente y lote confirmado.
2. Copia individual de mensaje mediante Clipboard API, sin impresión ni envío automático. Solo una fila revelada; secreto oculto antes de capturar.
3. **Perfil persistente independiente** de Chrome, sin cookie docente. El código abre únicamente su destinatario y pasa por ejemplo/preflight/start existentes.
4. **120 segundos reales**; interacción con los píxeles dibujados de estrella/luna, sin invocar el motor ni fabricar eventos. Evidencia consultada contiene hit/false_alarm/miss/correct_rejection.
5. Corte de red durante la ejecución; cierre y recarga offline; navegación a `/pendientes`, cierre completo de ese perfil y reapertura con el mismo directorio de perfil.
6. Ingesta real con respuesta abortada **después del commit**. Reintento idéntico conserva bytes/hash/submission y limpia solo tras acuse validado. La consulta docente confirma evidencia/procesamiento en A, no en B.
7. B empieza conscientemente otra actividad, se interrumpe y conserva su propio pendiente. CLI de fixtures caduca la capacidad en la BD aislada; rechazo real de entrega, emisión docente de SUBMIT_ONLY y recepción del mismo paquete, **intento 1**, no 2.
8. Reemplazo docente y rechazo del código antiguo. La prueba supervisada J-02 sigue comprobando su propia partida real, recarga offline, procesamiento y recuperación de capacidad vencida como intento 2, no 3.

`tests/integration/access-ui.spec.ts` comprueba copia fallida con campo seleccionable, cancelación sin mutación, ocultación al perder foco, ausencia de código en storage docente, teclado/entrada, pendientes vacíos, reflujo a 320 y texto al 200 %. No equivale a auditoría WCAG o lector de pantalla.

**Incidencias encontradas y corregidas:** primera captura docente tomó un estado de carga; se añadió espera de contenido real. Inspector público encontró 68 px de espacio reservado para feedback vacío; se elimina únicamente cuando está vacío. Una pasada conjunta posterior detectó texto ingresado antes del preflight local que se perdía con el render final: input/botón se mantienen deshabilitados hasta terminar. El test supervisado también podía intentar pulsar un botón ya sustituido por el reintento automático; ahora adelanta la misma entrega con evento online y sigue exigiendo rechazo real/recuperación, sin relajar autorización.

## Cobertura J3-AC01…18

| Criterios | Evidencia |
| --- | --- |
| 01–03 | Lote atómico/repetición, metadatos sin secretos, destinatario inválido sin lote parcial, colisión RNG forzada, ASCII/normalización y asociación servidor. |
| 04–07 | Canje anónimo y reconciliación, preparación sin consumo, mismo start, cupo/bloqueo entre entradas y procedencia SQL; revocación/reemplazo/transferencia sin otro intento ni cambio de evidencia. |
| 08–10 | Respuestas públicas neutrales, 429/503, AEAD/AAD/HMAC y configuración; rol/ámbito/revelado, código no persistido, transferencia concurrente con canje y denegación posterior del docente anterior. Rotación operativa documentada; no se declara ensayo completo de gestor de secretos productivo. |
| 11 | 30 canjes sintéticos desde una IP, dos instancias de aplicación en pruebas y PostgreSQL compartido; abuso de código/IP, cuerpo malformado, reintentos y limpieza de contadores. No son 30 navegadores ni dos despliegues físicos. |
| 12–15 | Offline/cierre/reapertura/ACK perdido; recuperación con código de juego y SUBMIT_ONLY, después de disponibilidad terminada, recepción bloqueada por revocación sintética y posterior recepción autorizada; sin copia local no crea otro juego. |
| 16–18 | Copiado distinto de enviado, recibido/procesado consultados en API real; teclado/foco/200 %/anchos; regresión funcional de Usuarios/Cursos/Catálogo, supervisado y escaneo de dist. |

## Revisión visual y límites

Se extendieron los sistemas existentes, sin sorteo de otra dirección ni activos nuevos. Público: Nunito/verde azulado y campo único; pregunta «¿cómo abro mi actividad o envío mi pendiente?». Docente: system-ui/colores y componentes Base UI locales; pregunta «¿a quién corresponde este acceso y qué autoriza?». No se incorporaron mascotas, métricas decorativas o otra biblioteca.

Capturas/mediciones finales: `/tmp/opencode/j03-inspect-public-final-build/` y `/tmp/opencode/j03-inspect-teacher-final/` (report.json y capturas desktop/tablet/mobile), además de Play `test-results/kudlab-integration/`. No publicar perfiles de navegador, portapapeles, credenciales o códigos utilizables. La primera tanda de capturas docentes en carga no se usa como aceptación visual.

Crítica cualitativa tras revisar los tres anchos: acciones/etiquetas legibles, identidad y vigencia claras, sin desbordamiento. Se corrigieron feedback vacío y espera de contenido. La lista docente conserva bastante longitud en móvil al mostrar acciones e historial completos; no es una pantalla de comparación rápida ni validación con profesores. Autoevaluación orientativa, no estudio: claridad 8/10, coherencia 9/10, densidad 7/10.

- **G-01…G-04 siguen pendientes.** Participación institucional ausente deniega en composición normal; solo el runner inyecta autorizaciones ficticias bajo guarda de entorno/BD existente.
- No Safari/iOS, táctil físico, lector de pantalla, zoom 400 %, restauración completa de backups, apagado forzado de todo el despliegue ni hosting/proxy productivo. Conservación legal y distribución institucional no quedan resueltas.
- IP real verificada con conexión directa; no se confía en X-Forwarded-For. Un proxy puede agrupar clientes y requiere política/verificación explícitas antes de uso real.
- Cinco caracteres reducen entropía frente al borrador de ocho. No se afirma seguridad validada para menores ni identidad física del ejecutante.
- El rollback operativo seguro es desactivar nuevos códigos manteniendo API/runtime/lector compatibles con CODE y evidencia histórica; no downgrade destructivo ni retirada de builds con pendientes.
- Skills: ui-ux-pro-max y design-taste-frontend; Ponytail no cargó por herramienta, sí se leyó copia versionada. MCP shadcn no disponible; documentación oficial Base UI consultada como alternativa, sin instalar componentes.
