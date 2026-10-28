# Estudiantes nuevos habilitados en la vista de pruebas

2026-10-28 UTC. Decisión del responsable: permitir probar registro → asignación → Play mientras no existe carga de consentimientos. Aplicación limitada a datos ficticios y base aislada; no representa consentimiento ni habilitación para menores reales.

## Implementación y límites

- `tests/game-preview.ts` compone la API de demostración: nuevos registros activos y participación sintética de todos los registros activos de **esa base**. No necesita añadir cada ID a un mapa en memoria; conserva disponibilidad después de reiniciar la vista. Inactivar sigue bloqueando asignación/inicio/primera entrega según las reglas existentes.
- `tests/game-server.ts` usa esta composición. **Este runner resetea su base**: usar exclusivamente una base nueva/desechable. Para reanudar sin reset usar el script frontend `tests/browser/serve-existing-game.mjs`, con `KUDLAB_BACKEND_DIR` apuntando a este backend.
- `testActiveStudents` es una dependencia interna de composición, no una variable pública ni un parámetro HTTP. Router y servicio exigen `NODE_ENV=test` y nombre `kudlab_j02_*test` antes de permitir altas activas. El cliente sigue sin poder enviar `isActive`, consentimiento ni permisos.
- El arranque normal `src/index.ts`/`createApp()` no inyecta esa dependencia: alta inactiva, participación indisponible. No se modifica la política productiva de consentimiento ni la aprobación metodológica.
- No activa registros inactivos anteriores ni introduce una ruta de reactivación, migración, cuenta STUDENT o cambio de permisos ADMIN/TEACHER.
- Se conservan rutas, campos, sesiones persistidas, ámbito del profesor, idempotencia y contrato de códigos/resultados. La variante de pruebas devuelve `Student.isActive=true` en alta, mientras que el contrato normal conserva `false`.

## Ejecución

Usar el procedimiento de [integración](integracion-play.md#prueba-local-reproducible) y [códigos](acceso-codigo.md#verificación-reproducible), con tres orígenes coherentes y claves exclusivamente de prueba. El runner de pruebas ahora permite registrar nuevos participantes desde la UI. No usar `npm start` como sustituto de esta composición.

La regresión backend está en `tests/integration/game-preview.test.ts`; la prueba de navegador de los tres repositorios, en Play `tests/integration/new-student.spec.ts`. Esta última necesita un runner recién preparado con A2 vacío y build frontend actualizado. No usar una BD compartida para repetirla.

## Fuentes y decisión

Backend base `65d0ad6` más cambios locales de esta corrección; frontend base `74c6ea3`; Play base `cf0fb2e`. Consultados índice/contexto de Académico/Tareas, registro/asignación y pendientes AC-02/IN-01; `docs/feature-specs/academico/02-cursos.md`, contrato 005, `docs/integracion-play.md`, `docs/acceso-codigo.md`; `src/app.ts`, routers/servicios de estudiantes, `academico/shared/{academic-auth,participation}.ts`, `auth/session-guard.ts`, `tareas/runtime/{routes,service}.ts` y fixtures de pruebas. La autorización de pruebas es posterior a sus decisiones históricas; no intercambia RF de análisis, diseño o V3.

## Evidencia local

`npm ci` y `npm run typecheck` correctos; `npm test -- --reporter=verbose`: **276/276 pruebas, 45 archivos**, con BD exclusiva `kudlab_j02_habilitados_unit_test`. Incluye nueva regresión de alta activa/asignación/grant, rechazo tras inactivar sin segunda asignación, sesión docente aún válida, contrato normal inactivo, rol/curso ajeno y guardas de entorno/BD. La suite inicial superó el timeout de 120 s; la ejecución completa terminó correctamente en 244 s. npm informa 8 vulnerabilidades preexistentes (7 moderadas y 1 alta), no remediadas en esta corrección.

Chromium + builds frontend/Play + otra BD `kudlab_j02_habilitados_browser_test`: registro en A2 vacío → asignación/código → canje Play sin cookie docente → inicio/cierre parcial → acuse 201 y procesamiento completado, **correcto**. Inactivación antes de guardar produce aviso local sin bloquear navegación ni crear otra asignación. Reiniciar la API sin reset conserva registros/historial y elegibilidad, sin seed por ID. Sin datos reales ni cambios de esquema; no acredita producción, consentimiento ni una partida completa de 120 s.
