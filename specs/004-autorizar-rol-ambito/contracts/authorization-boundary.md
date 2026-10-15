# Contrato interno propuesto: autorización de personal y responsabilidad docente

**Estado**: integración mínima implementada para lecturas, edición de nombres y listados académicos con asignaciones persistidas; el panel de Seguimiento no existe. Amplía el límite inicial de [002](../../002-validar-perfil-acceso/contracts/scope-authorization.md). Fuente funcional: [spec.md](../spec.md) FR-001–008; V3 RF-004 fila 5 y D-08 fila 9 (propuestas), A CU03 p. 32, CU04/CU05 pp. 33–35; las operaciones concretas de esta iteración fueron confirmadas por el responsable el 2026-10-14.

## Participantes y responsabilidad

- **Usuarios** verifica la sesión opaca persistida, inactividad, cuenta ACTIVA y rol concordante. Determina si el actor puede solicitar la operación; la autorización de gestionar cuentas sigue [contrato de 001](../../001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml).
- **Académico** es la fuente autoritativa de asignaciones vigentes y de la relación real estudiante↔grupo. Debe confirmar permiso para un actor identificado por `user_accounts.id`, operación y objetivo, y proporcionar el conjunto autorizable para listas. Nunca acepta un ámbito declarado por el cliente como prueba. Un `true` sin comprobar grupo real del estudiante no cumple el contrato.
- **Consumidor** (Académico, Seguimiento, Tareas en operaciones del personal) define el permiso para cada acción concreta, valida IDs/filtros, solicita decisión a Usuarios/Académico, restringe su consulta/escritura y estructura la respuesta. Las tareas y activación de estudiantes comprueban además consentimiento vigente en su módulo; esta interfaz no lo reemplaza.

## Entradas y resultados de decisión

```text
Entrada confiable: cuenta derivada de sesión activa (id, rol y estado vigentes).
Entrada definida por consumidor: operación aprobada (ej. lectura de ficha, modificación
  permitida, listado), tipo de objetivo (estudiante/grupo/conjunto), IDs normalizados,
  filtros opcionales ya validados. Nunca rol, docente o asignación tomados del cliente.
Proveedor académico: comprobar pertenencia de estudiante a su grupo actual y asignación
  vigente del docente para esa operación; para listados, devolver ámbito verificable.
Resultado: permitido con ámbito restringido verificado, o denegado; fallo/error/inconcluso
  nunca equivale a permitido ni a un ámbito global.
```

La operación solo es válida si el consumidor tiene una política explícita de rol y alcance; operación desconocida o aún no aprobada se deniega. ADMIN gestiona cuentas según 001 pero no hereda permisos de estudiante. No se expone función HTTP universal de «comprobar si existe estudiante»; cada consumidor aplica esta decisión internamente. Mantener compatibilidad con `ScopeTarget`/`AssignmentProvider` para objetivo individual o versionar la interfaz interna y actualizar consumidores y pruebas antes de ampliar a listas. Una respuesta booleana del proveedor individual no equivale a un ámbito de listado.

## Tratamiento por tipo de petición

| Tipo | Regla de autorización | Resultado permitido |
| --- | --- | --- |
| Cuenta | Sesión/estado/rol vigentes; ADMIN para gestión de cuentas; excepciones de solicitudes de ascenso conservan su contrato de 001. | Solo respuesta definida por contrato de cuentas existente. |
| Lectura individual de estudiante/grupo | TEACHER, operación de lectura habilitada y pertenencia/adscripción actual verificadas. | Solo dato del objetivo autorizado. |
| Modificación individual o múltiple | TEACHER, operación concreta de escritura habilitada y todos los objetivos asignados durante la confirmación de la escritura. | Efecto atómico permitido; un objetivo ajeno o cambiado cancela todos. |
| Listado, opciones, filtro o agregado | TEACHER con operación de consulta habilitada, ámbito de lista vigente obtenido del proveedor. | Filas, total, paginación, filtros y agregados limitados desde la consulta de origen. Conjunto autorizado vacío → resultado vacío. |

Una consulta individual ajena o una escritura mixta se deniega completa; en listado mixto puede omitirse cada objetivo ajeno sin señalar que existe. Un filtro de período no altera el ámbito. Un grupo presentado por el cliente no acredita que el estudiante solicitado pertenezca a él.

## Fallos, errores y efecto sobre la sesión

| Condición | Acción del consumidor |
| --- | --- |
| Sin sesión opaca válida o sesión vencida | Rechazar como acceso no autenticado; sin datos protegidos ni cambio, exigir nuevo ingreso. |
| Cuenta no ACTIVA, rol insuficiente/discordante o acción no habilitada | Denegar sin exponer el registro ajeno. |
| Objetivo ajeno, ID inválido o escritura mixta | Denegar íntegramente; no confirmar existencia del objetivo, no guardar parcialmente. |
| Proveedor ausente, falla, respuesta inconclusa o ámbito de lista no verificable | Denegar solicitud afectada completa; nunca sustituir por listado irrestricto ni rol del cliente. |
| Ámbito verificado como vacío | Permitir listado vacío para consulta autorizada; no divulgar totales ajenos. |
| Cambio de asignación/rol antes de confirmar efecto | Revalidar bajo condición consistente; denegar o revertir íntegramente. |

Las respuestas HTTP del consumidor deben diferenciar necesidad de autenticación de falta de autorización/indisponibilidad con mensaje genérico sin revelar menores; formato/códigos exactos corresponden a su contrato antes de exposición. Una denegación nunca renueva actividad de sesión (regla confirmada en 003).

## Integración y verificación de consumidores

1. Antes de crear rutas de menores: responsable funcional aprueba matriz de operaciones; Académico modela asignaciones y pertenencia; cada módulo publica contrato de entradas, respuestas, errores y consentimiento cuando aplique.
2. Guardar la precedencia: sesión/rol → operación permitida → asignación vigente y objetivo real → consulta/escritura limitada → respuesta. Escrituras deben tener comprobación y efecto coherentes ante reasignación concurrente.
3. Probar con base de datos y rutas reales dos docentes/grupos separados, filtros y conteos, modificación ajena/mixta, cambio de rol y asignación, caída de proveedor y revocación de sesión. Los dobles existentes en 002 cubren solo negativas del límite y no cierran SC-002/003 de 004 ni US3 de 002.

**Consumidores afectados por cambios**: `src/app.ts` y guardias de cuentas para rol; `src/modules/academico` ya aporta asignación/lectura/edición de nombres/listados mínimos; `src/modules/seguimiento` y `src/modules/tareas` aún no consumen esta frontera. La consulta del panel y la ejecución de tareas exigirán contratos propios antes de habilitarse.

## Decisión del responsable para el piloto de 004 (2026-10-14)

El responsable autorizó para **esta iteración** al rol TEACHER consultar estudiantes/grupos propios y editar **solo nombre y apellidos** de estudiantes propios. ADMIN conserva la gestión de cuentas, sin permiso implícito sobre estudiantes. Un grupo tiene un docente responsable vigente y cada estudiante pertenece a un grupo vigente. Estas decisiones proceden de la confirmación en conversación; no convierten RF-004 V3 ni las propuestas del análisis en aprobaciones institucionales generales. Alta de estudiantes, cambio de grupo, estado/activación y consentimiento quedan expresamente fuera de estas rutas; ninguna petición de edición puede modificar esos datos.
