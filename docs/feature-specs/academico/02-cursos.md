# Cursos (grupos) y estudiantes por curso

2026-10-26. Extensión autorizada expresamente por el responsable después del PR frontend de mejora de interfaz. Base backend c989fae; frontend 2a79f94. Fuente normativa de estas decisiones: conversación, no RF V3 propuestos.

## Decisiones confirmadas

- Curso es la entidad `groups` existente: nombre, grado, año escolar y cuenta del profesor responsable. Sin tabla duplicada.
- ADMIN crea, consulta y edita todos los cursos y asigna profesor; solo puede eliminar cursos sin estudiantes, incluidos los inactivos. ADMIN no recibe acceso a sus registros estudiantiles.
- TEACHER consulta sus cursos, selecciona uno y realiza las operaciones de estudiantes existentes dentro de ese curso. Alta crea estudiante inactivo, sin credenciales ni activación/consentimiento.
- Al cambiar responsable, el nuevo profesor obtiene acceso actual a todos los registros del curso y el anterior lo pierde. Conserva IDs, datos y estados; confirmación explícita. No se crea una historia de asignaciones o auditoría general no solicitada.

## Contrato de esta extensión

Sesión persistida activa en todas las operaciones. JSON, no-store. Identificadores de cuenta/grupo UUID; los IDs de grupo malformados, inexistentes y ajenos se neutralizan con 404. TEACHER no puede seleccionar otro `teacherId` mediante query. ADMIN no recibe nombres, códigos ni cantidades de estudiantes en DTO de curso.

`Group = {id, name, grade, schoolYear, teacherId, teacherName}`. Referencia a cuenta de negocio, nunca ID de Better Auth. Nombre/grado se recortan, no vacíos ni NUL, máximos 50/20 puntos Unicode conforme a columnas existentes; año entero de PostgreSQL (32 bits), sin rango institucional inventado. Nuevas asignaciones requieren cuenta TEACHER activa e identidad concordante activa; un responsable que posteriormente pierde acceso sigue identificado en los cursos existentes.

| Operación | Autorización | Entrada/salida |
| --- | --- | --- |
| GET `/api/v1/groups` | ADMIN todos / TEACHER propios | Sin query; `{items: Group[]}`, orden por id; vacío válido. |
| GET `/api/v1/groups/teachers` | ADMIN | Sin query; `{items:[{id,name}]}` de docentes elegibles, sin correos ni credenciales. |
| GET `/api/v1/groups/:id` | ADMIN / TEACHER propio | `Group`. |
| POST `/api/v1/groups` | ADMIN | `{name,grade,schoolYear,teacherId}` estrictos; 201 + Group. |
| PATCH `/api/v1/groups/:id` | ADMIN | Subconjunto no vacío de los cuatro campos; si cambia teacherId exige `confirmTransfer:true`; 200 + Group. |
| DELETE `/api/v1/groups/:id` | ADMIN | Cuerpo ausente; 200 `{id,deleted:true}`; 409 si tiene estudiantes o referencias. |
| GET `/api/v1/groups/:id/students` | TEACHER propio | Sin query; `{items: Student[]}`, solo ese curso, incluye inactivos, orden existente por id. |

Sin unicidad nueva de nombre/curso. POST sin idempotencia: una respuesta perdida obliga a revisar el listado, no repetir a ciegas. Sin reintentos automáticos. Cambios concurrentes no tienen revisión/ETag: el formulario advierte sobre sobrescritura; siempre exige confirmar transferencia.

Errores: 400 INVALID_INPUT con `fields` objeto opcional para name/grade/schoolYear/teacherId y motivos fijos required/invalid_format/too_long; 401 UNAUTHENTICATED; 403 FORBIDDEN; 404 NOT_FOUND neutral; 409 CONFLICT (responsable no elegible, transferencia no confirmada o borrado impedido); 503 UNAVAILABLE. Sin reflejar entrada ni datos personales. La incertidumbre de red después de commit no equivale a rollback.

Las rutas antiguas de estudiantes permanecen; `GET /students` no se transforma en filtro inseguro. El consumidor nuevo usa GET anidado y groupId fijo del curso al registrar. Edición no cambia grupo/estado. `src/modules/academico/shared/academic-auth.ts` mantiene el rol TEACHER predeterminado para operaciones existentes; las operaciones de grupos revalidan dentro de la transacción el rol exacto que autorizaron.

## Concurrencia y aceptación

El cambio/eliminación bloquea la fila del grupo hasta confirmar sesión y commit; alta/consulta/edición estudiantil conserva sus bloqueos compartidos. Borrado simultáneo con alta no puede dejar huérfanos. Transferencia y escrituras deben serializarse sin entregar acceso previo después del cambio confirmado. No se elimina CASCADE ni se modifica el esquema.

Verificar CRUD ADMIN; dos docentes/varios cursos; vacío; IDs ajenos; rol no permitido; transferencia con confirmación y retiro del acceso anterior; estudiante activo/inactivo conservado; eliminación de vacío frente a ocupado; validación estricta; sesión revocada; sin queries arbitrarias, secretos ni replay.

## Fuentes observadas

Índice/contexto/arquitectura/decisiones/pendientes backend; constitución 1.1.0; Académico module-summary y features registrar/consultar/actualizar-inactivar; spec 005 y contrato students-api; src/app.ts, auth/session-guard.ts, módulos academico/shared y students, schema academic.ts y accounts.ts, pruebas/helpers. Los resúmenes que dicen «sin módulo implementado» son historia: cinco rutas estudiantiles sí existen en c989fae. AC-01 queda resuelto solo para responsabilidad actual y CRUD aquí; retención/historia, consentimiento y otros pendientes no se cierran.

## Evidencia de implementación local

Base `c989fae` más cambios de `feat/cursos-y-estudiantes`, frontend base `2a79f94` más rama homónima. Fecha local 2026-10-26, ejecuciones UTC 2026-10-27. Se actualizaron repositorios y se crearon worktrees separados antes de editar; no se modificó el checkout original. Código observado: `src/app.ts`, routers/servicios/validaciones en `academico/groups`, `academico/students`, `academico/shared`, `auth/session-guard.ts`, `auth/session-activity.ts` y esquema académico/cuentas.

- `npm ci`: correcto; 8 vulnerabilidades informadas (7 moderadas, 1 alta). No se ejecutó remediación automática ni se cambiaron dependencias.
- `npm run typecheck`: correcto.
- `DATABASE_URL=<BD de test exclusiva> MIGRATION_DATABASE_URL=<misma BD> npm test`: **247/247 pruebas, 40 archivos**, correcto. Incluye CRUD/roles/transferencia/borrado-alta concurrentes en `tests/contract/groups-api.test.ts` y éxitos de las 35 operaciones contrastados con OpenAPI en `tests/contract/api-openapi.test.ts`.
- Navegador real frontend/API/PostgreSQL: cinco grupos de recorridos correctos sobre datos sintéticos, tanto Vite desarrollo como build servido por preview. CRUD ADMIN, confirmaciones, alta/edición/inactivación docente con recarga, transferencia y retirada de acceso anterior, bloqueo de borrado poblado, 20 combinaciones responsive por ejecución. Script frontend `tests/browser/courses.check.mjs`; evidencia regenerable `/tmp/opencode/cursos-real` y `/tmp/opencode/cursos-build`.

PostgreSQL 17 desechable en Podman: pruebas en `kudlab_cursos_test`, integración en `kudlab_cursos_preview`; el build usa otra instancia aislada. `tests/courses-preview.seed.ts` está protegido por NODE_ENV/nombre de BD y crea solo datos ficticios con correo capturado, no envíos reales. Nunca usar fixtures/reset contra una BD compartida. Las verificaciones no demuestran despliegue, TLS productivo, aceptación docente, auditoría histórica ni cumplimiento legal completo.
