# Vertical 01 — Catálogo y ficha de juegos

**Estado:** implementación en rama, 2026-10-26; no merge ni despliegue.
Spec entregada por el responsable en la conversación, con autorización posterior
para incorporar P-01/P-02 y publicar ambos PR. Sin SDD ni planes adicionales.

## Alcance y experiencia confirmados

Profesor ADMIN/TEACHER activo consulta lista/ficha real desde `/tareas` y
`/tareas/:taskId`, tras comprobar sesión persistida. Tabla con nombre/código,
disponibilidad administrativa, preparación y enlace nombrado. Ficha con finalidad,
razones y versión publicada. Navegar/volver entre tareas conserva AuthRoot;
URL directa y recarga revalidan acceso. Foco visible, tabla desplazable identificada,
etiquetas neutrales y texto legible según las cuatro guías frontend de diseño.

Solo TG-01 Lluvia de estrellas es entrada conocida. Segundo juego sin definir;
TG-00/TG-06 son apoyos no independientes. Sin Jugar/Asignar, demos, recursos,
edición, resultados, métricas, estudiantes ni claves de almacenamiento en estos DTO.
Ficha metodológica no acredita integración. TG-01 nace deshabilitada, sin versión,
integración pendiente y no asignable.

Carga, vacío real, error/reintento y detalle inexistente son distintos. Respuestas
tardías de otro destino/sesión no reponen datos. 401/403 y falta de comprobación de
acceso retiran contenido mediante el controlador existente; 403 queda denegado
incluso tras reconciliar sesión. Red/503 reutiliza el gate transversal con Reintentar:
comprueba sesión antes de repetir lectura, sin vacío falso ni catálogo anterior.

## Contrato concretado y persistencia

Canónico servido: [OpenAPI](../../api/openapi.yaml), `listTasks` y `getTask`.
GET `/api/v1/tasks` → `{items: TaskSummary[]}`; GET `/api/v1/tasks/{taskId}` →
TaskDetail. ID válido fuera del catálogo → 404. Query desconocida o código que no
cumple `TG-[0-9]{2}` → 400. Sin sesión → 401; acceso/rol incompatible → 403;
dependencia no disponible → 503. Cache-Control no-store en éxitos y errores.

TaskSummary: id, title, description, isEnabled, integrationReady, publishedVersion
(`null` o UUID/version positiva), assignable, unavailableReasons, revision positiva.
TaskDetail añade purpose/pedagogicalNotice. Razones INTEGRATION_PENDING,
CONFIGURATION_UNPUBLISHED, TASK_DISABLED, sin prioridad contractual.
`taskReadiness` calcula preparación en servidor. No hay juego recibido/validado:
integrationReady=false en código, no columna/checkbox administrativo.

`tasks` y `task_published_versions` tienen FK y unicidad por tarea/versión positiva.
La mayor versión publicada es la actual; no hay publicación/configuración editable.
Migración 0009 aditiva, seed con ON CONFLICT DO NOTHING sin alterar registros
existentes. Allowlist de catálogo en servidor: una fila TG histórica no la amplía.

## Fuentes y versiones consultadas

- Fetch exitoso, `main...origin/main=0 0`: backend `c3cd581`, frontend `f26b0c4`.
  Worktrees aislados, ramas nuevas `feat/tareas-catalogo`. Se crearon inicialmente
  para inspección antes de localizar el README común; no se editó código hasta
  completar la comparación. Ningún original modificado ni trabajo descartado.
- Backend: índice, constitución, contexto/arquitectura/decisiones/pendientes,
  módulo Tareas, modelo y RF-010/014 V3; código `src/app.ts`,
  `src/auth/{auth,session-guard,session-activity,active-identity}.ts`, schemas,
  `src/config/env.ts`, `src/modules/usuarios/shared/accounts.errors.ts`, OpenAPI
  y pruebas auth/contrato. P-01/P-02 incorporados en `518e88b` desde cambios locales
  de `fix/session-cookie-guarantees-restored` (base ff46f8a), original intacto.
- Versión vigente de decisiones recibida: cambios locales **sin commit** sobre
  `cd3c2b4`, worktree backend `d603ad/docs/cerrar-decisiones-tareas`:
  `docs/feature-specs/tareas/{README,01-catalogo-y-ficha}.md`,
  `docs/agent-context/modules/tareas/{module-summary,domain-model,design-decisions}.md`,
  `features/{recursos-configuracion,disponibilidad,tg-01-estrellas}.md`.
  TD-D13/15/16/30–33 y la spec del responsable confirman alcance reducido;
  no atribuir esos archivos a main ni ratificar toda V3 por esta entrega.
- F `Fundamento teorico.docx.pdf` pp. 25–28 cotejadas en originales locales:
  atención sostenida/control de respuesta, adaptación no clínica. No acredita
  integración ni indicadores implementados. V3 RF-010/014 filas 11/15 y F §§3.3–3.5
  son antecedentes cotejados en el paquete de decisiones recibido.
- Frontend: App, auth/{AuthRoot,client,controller,state}, lib/http, Usuarios
  (navegación/workspace/hooks), estilos y componentes actuales; cuatro guías
  docs/design. Reutiliza Base UI/Lucide y tokens, sin dependencias nuevas.

## Verificación incremental

- npm ci en ambos; base exclusiva Podman `kudlab-catalogo-01`, PostgreSQL 17 tmpfs,
  loopback 35161/base `kudlab_catalogo_01`, ambas URLs DB explícitas, sin SMTP real.
- Auth: 21/21 focalizadas, tipos y docs 22/22. Catálogo/contrato/OpenAPI: 27/27.
  Fixture no-test MAIL_HOST IP corregida a localhost por validación SMTP actual;
  sin cambiar producción ni contactar proveedor.
- Suite completa y recorrido real/navegador pendientes en este hito. Evidencia
  final se añade aquí; mocks/typecheck no acreditan cierre integrado.

## Evidencia final y refactor

Implementación inicial backend `36d760d`, auth `518e88b`; frontend `e3a6f90`,
refactor/correcciones frontend `1f5f778`. Las revisiones finales quedan en los PR
de ambas ramas `feat/tareas-catalogo`; no se ha fusionado main.

Pruebas completas antes del refactor: 242/242, 39 archivos, 203.32s.
Después del refactor: **242/242, 39 archivos, 206.50s**, typecheck correcto y
docs:check **22/22**. Primer intento completo excedió timeout de 120s; se repitió
con límite de 600s y no se contó el timeout como aprobación. Los avisos de IP/rate
limit y origen inválido son los casos sintéticos existentes de la suite, no cambios
de autorización ni incidentes de producción.

Refactor final: no-store + requireActive se concentran en el router de catálogo,
en el mismo orden, eliminando repetición root/wildcard de app. Se conservan rol,
validación, proyección y preparación; se amplían aserciones de headers/cuerpos
401/403 y fallo DB 503 de lista **y ficha**. Revisión independiente de backend
en snapshot `36d760d` no detectó defectos bloqueantes; recomendó esas aserciones.
El frontend compartió validación de IDs y eliminó un cast de lista; no se crearon
frameworks ni dependencias. Dos subagentes revisaron en worktrees aislados sin
editar estos repositorios ni usar la base durante las pruebas.

### Recorrido SPA/API/PostgreSQL real

API `http://localhost:3011`, SPA `http://localhost:5191`, orígenes exactos; puertos
ajenos 3000/5173 preservados. Perfil local de validación distinto al aprobado
5173/3000, sin modificar configuración de producto. NODE_ENV=test y captura de
correo, cuentas ficticias, DB exclusiva indicada arriba. No se usan mocks para
estos resultados ni SMTP real.

- Login TEACHER y ADMIN, lista/ficha reales; navegación/recarga por URL y retorno.
- Solo TG-01. Habilitación cambiada temporalmente en fixture DB: ambas pantallas
  indican Habilitada pero no lista para asignar, sin integración/versión.
- Cambio temporal del código en DB exclusiva: vacío real y detalle TG-01 404 con
  enlace al catálogo. Se restauró código/disponibilidad/revisión iniciales.
- Renombrado temporal de tabla exclusiva: consulta real devuelve 503, nunca lista
  vacía; UI retira datos. Tabla restaurada; Reintentar revalida sesión y consulta.
- Cierre UI y pagehide: retiran catálogo. Sesiones sintéticas expiradas en DB
  durante suspensión: pageshow presenta acceso perdido y API catálogo responde 401.
- Sin almacenamiento web de identidad/tokens; no se exportaron cookies/cabeceras
  sensibles ni datos reales. La primera API temporal se arrancó con otro secreto
  sintético que el usado por la fixture con JWKS persistido; dio 503 de sesión.
  Se corrigió el entorno para reutilizar el secreto de pruebas, sin tocar código
  ni mostrar contenido con acceso incierto.

Frontend: tipos, auth 66/66, Usuarios 70/70, Tareas 11/11 y build correctos tras
refactor. Harness DOM 11/11 más comprobación móvil 390px; mocks separados del
recorrido anterior. Catálogo/ficha revisados en iframe same-origin de
320/390/768/1024/1440px y texto 100%/200% (20 combinaciones sin overflow de página).
Tabla desplazable por teclado, enlace nombrado de 44px, Enter abre ficha con foco
en H1. Colores/tokens neutrales del manual, sin semáforos ni diagnóstico.

**Límites:** reflujo 320px, no zoom nativo 400%; sin lector de pantalla, dispositivos
físicos, BFCache real, HTTPS/TLS, carga productiva o aceptación con profesores.
Las pruebas funcionales y de integración no certifican piloto/despliegue ni
resuelven TD-D33. Fuentes/evidencia frontend completas en su spec de la vertical.

## Pendientes fuera de entrega

TD-D33 (proyecto real TG-01/segundo juego), banco/parámetros/integración,
configuración/recursos/disponibilidad editable/asignaciones/ejecución/Evolución.
No se afirma piloto listo, TLS real ni accesibilidad certificada.
