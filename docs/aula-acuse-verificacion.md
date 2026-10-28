# J-03 · Verificación del refinamiento de aula

Alcance autorizado: [decisiones y contrato](aula-acuse.md). Trabajo separado de los servicios usados por el responsable: worktrees `kudlab-{backend,frontend,play}-j03-aula`, ramas locales `fix/j03-aula-acuse`, bases d867879/cc6ce32/c6ed861. No se borró la BD de su prueba manual ni se reiniciaron sus servicios 5183/4313/4183. Datos ficticios nuevos en `kudlab_j02_j03_aula_unit_test` y `kudlab_j02_j03_aula_browser_test`, PostgreSQL 17, 55443; verificación en 5184/4314/4184. Uso real sigue bloqueado.

## Resultados observados

- npm ci sin dependencias nuevas, tipos y builds correctos.
- Backend: suite completa **44 archivos / 273 pruebas correctas**, con la excepción de lectura de acuse y sin cambiar autorización de start/results/context. Verificación focal posterior de las aserciones finales: **2 archivos / 18 pruebas correctas**.
- OpenAPI: generador y docs:check, **22 pruebas correctas**, describe consulta de acuse solo de lectura incluso expirada, nunca revocada. Sin schemas nuevos, migración ni modificación del artefacto 1.2.0.
- Frontend: **185 pruebas funcionales** (66 auth + 72 usuarios + 26 académico + 21 tareas). Las dos nuevas prueban lotes 100/100/5 y reintento de las mismas solicitudes tras fallo parcial, sin otra creación. npm test solo verifica tipos.
- Play: **61 pruebas correctas**, incluidas confirmación automática con permiso expirado, pendiente AUTH_REQUIRED de build anterior, acuse ausente, revocado, hash diferente, respuesta malformada y Retry-After. No se limpia evidencia sin acuse de la misma sesión/submission/hash.
- Primera pasada integrada: recorrido J-03 real y regresión supervisada correctos; la prueba UI aún filtraba una fila por un botón ahora plegado. Se corrigió exclusivamente el selector y la prueba UI focal pasó (1 prueba, 7,8 s). **Repetición final conjunta: 3 correctas, 5,1 min**. Suite independiente completa del workflow, con los cambios finales de acuse: **31 correctas, 2,4 min**, sin reutilizar servidores externos. Tipos/lint/contrato/build/escaneo de producción correctos en la misma pasada.
- CI Play: corrección `9d9da8f` ya publicada en PR #2; **push y pull_request verdes**, runs 40615727303 y 40615733078. Causa y cobertura: Play `docs/ci-verification.md`. No se desactivó el workflow ni se agregaron skips o retries.
- Revisión final de regeneración: las solicitudes de un lote manual se reutilizan solo mientras esa operación está sin confirmar; tras éxito se usan IDs nuevos para una nueva acción. Se comprobó revocar/preparar dos veces consecutivas con un código activo nuevo en cada ciclo (UI focal: **1 prueba / 10,4 s**), además de tipos/lint y 21 pruebas de Tareas. Evita repetir indefinidamente el recibo de un lote ya revocado. La preparación inicial de creación mantiene su idempotencia original.

## Qué se comprobó

1. Crear asignación para A/B ficticios prepara códigos sin pedir otra selección ni pulsar generar accesos. La siguiente pantalla muestra estudiantes/códigos.
2. El modo proyección modal tiene tarea, URL, nombres/códigos y cierre por Escape; no incluye resultados, gestión ni SUBMIT_ONLY. Capturas enmascaran códigos utilizables. Copia individual y fallback siguen comprobados.
3. Una partida real de 120 s produce evidencia y procesamiento por API/PostgreSQL reales. Se corta red, cierra/reabre perfil público independiente y se pierde la respuesta **después de commit**. La CLI sintética caduca la capacidad en ese instante: la repetición POST se deniega y Play confirma por GET automáticamente, sin pedir código ni renovar permisos.
4. B deja resultados nunca recibidos y capacidad vencida: no se confunde con ACK perdido ni se anuncia recepción inexistente. Recuperación SUBMIT_ONLY sigue bajo «Resolver un envío pendiente», solo si no hay recepción, sin otro intento.
5. Backend prueba capacidad desconocida/revocada, sesión ajena, submission ajeno, canReadReceipt=false y ausencia de acuse. Una consulta exitosa no modifica las capacidades. Start/context/results conservan 401 con capacidad expirada.
6. No código en storage docente. Pérdida de foco limpia memoria visible y proyección; cancelación no revoca. Teclado, 320 px y texto al 200 % comprobados por navegador.

## Diseño y límites

Se conserva el sistema existente, sin sorteo de otra estética ni nuevas bibliotecas. Pregunta principal: «¿Qué código le corresponde a cada estudiante para empezar ahora?». La fila agrupa identidad y código; gestión/historial/configuración son secundarios. Proyección separa por completo los resultados del contenido que se comparte en aula. El responsable aceptó el riesgo de uso cruzado: el código acredita posesión, no identidad física.

Inspector sobre build final: **0 FAIL / 0 WARN** a 1440/768/390; seis capturas abiertas y revisadas en `/tmp/opencode/j03-aula-inspect-final/`. Frente a la entrega anterior, de 2,3 pantallas/265 palabras a 1,1 pantallas/107 palabras en la vista sintética inspeccionada: configuración/gestión plegadas y dos estudiantes/códigos en el primer viewport de escritorio/tablet. En móvil se conservan nombres completos, controles y códigos sin recorte; la lista es más larga. La proyección usa rejilla auto-fit, sin columnas vacías con pocos destinatarios. Captura final de proyección y captura a 320 px abiertas y revisadas en Play `test-results/kudlab-integration/`, con códigos enmascarados.

Artefacto backend/Play 1.2.0 comparado byte a byte y por hashes del manifiesto: correcto, sin cambios de contrato de sobre. `git diff --check` correcto en los tres repositorios. Los PR originales #15/#12/#2 se fusionaron durante este trabajo: los ajustes se publican en nuevas PR sobre main (40abadb/9e8ed9d/ab7c033, mismos árboles que las bases inspeccionadas).

Crítica de app: la identidad y el código son la pareja principal; alineación y márgenes del sistema se conservan; no hay cifras decorativas ni colores nuevos. Datos ausentes siguen siendo ausentes. La ayuda de supervisión y los controles apilados consumen espacio en móvil, pero no se eliminan para fingir densidad. Autoevaluación orientativa de las capturas, no estudio con profesores: claridad 9/10, coherencia 9/10, densidad 8/10. No se realizó prueba física de proyector.

Lint visual del componente AccessCodes: 0 FAIL / 0 WARN. El lint conjunto con Activities advierte guiones de ausencia de datos: se conservan porque expresan valores no disponibles, no puntuación decorativa. No se alteraron fórmulas/segmentos ni se sustituyeron ausencias por cero.

Skills ui-ux-pro-max y design-taste-frontend; Ponytail falló al cargar por herramienta y se leyó su copia local. MCP shadcn no disponible (discovery y CLI); documentación oficial Base UI consultada, componentes locales preservados. La proyección usa dialog nativo para cierre/foco/modalidad, sin instalar otra suite.

No validación física de video beam, distancia de lectura real, táctil físico, Safari/iOS, lector de pantalla o zoom 400 %. No habilita menores ni resuelve G-01…G-04. La confirmación automática requiere secreto/evidencia local, conexión y capacidad no revocada; no recupera datos borrados ni autoriza envíos nunca recibidos. No se promete automatización fuera de esos límites.
