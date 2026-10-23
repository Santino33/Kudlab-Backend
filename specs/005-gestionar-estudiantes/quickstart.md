# Quickstart de validación — gestionar estudiantes

Guía de validación de la implementación. Endpoints y pruebas disponibles; resultados ejecutados en [validation.md](validation.md). Contrato: [contracts/students-api.md](contracts/students-api.md). Persistencia: [data-model.md](data-model.md).

## 1. Prerrequisitos

- Node.js 24, npm y PostgreSQL accesible; usar únicamente una base de pruebas desechable, nunca una instancia productiva.
- Dependencias instaladas con el lockfile del proyecto y migraciones de esta feature implementadas/revisadas. No ejecutar `auth:generate`: no se modifica el esquema generado de Better Auth.
- Sesiones reales de docentes creadas mediante los helpers de invitación/login existentes; no sustituirlas por JWT inventados o un ID enviado por el cliente.
- `tests/helpers.ts::reset()` usa TRUNCATE/CASCADE. Comprobar URL y base antes de cualquier prueba. Las pruebas actuales comparten estado y no deben paralelizar archivos contra la misma base.

## 2. Preparación local

Desde la raíz del repositorio, con una base aislada ya creada en PostgreSQL. Ejemplo de URL exclusivamente local coincidente con el default de pruebas; sustituir host/credenciales si corresponde:

```bash
export DATABASE_URL='postgres://postgres:local_test_only@127.0.0.1:55432/kudlab_students_005_test'
export MIGRATION_DATABASE_URL="$DATABASE_URL"
npm ci
npm run db:migrate
npm run typecheck
```

Antes de migrar, confirmar que la URL identifica efectivamente la base desechable. `tests/setup.ts` proporciona defaults al correr Vitest, pero no crea la base ni aplica migraciones, y esos defaults no se aplican al comando de migración. No usar `db:generate` como requisito normal para validar: la migración revisada debe estar versionada por la implementación.

## 3. Datos de prueba y grupos

Los tests deben reutilizar `reset`, `inviteTeacher`, `login` y `request` de `tests/helpers.ts`. Preparar por fixture, sin endpoints de grupos:

1. Docente A y Docente B, activos, con sesiones persistidas.
2. Dos grupos para cada docente, vinculados por el UUID de `user_accounts.id`, no por `authUserId`.
3. Estudiantes propios y ajenos, con códigos distintos; uno inactivo por docente y un activo de prueba para verificar inactivación. Los activos se insertan solo por fixture de la base aislada, no por un endpoint de activación inexistente.
4. Una cuenta Administrador y, para casos de denegación, docente pendiente/inactivo y sesiones cerradas/vencidas.

La provisión de grupos reales es una dependencia operativa antes de despliegue; no copiar fixtures con menores ficticios a producción ni crear grupos automáticamente por alta.

## 4. Comandos de verificación

Tras agregar los archivos de pruebas previstos por el plan:

```bash
npm test -- tests/unit/students-validation.test.ts
npm test -- tests/contract/students-api.test.ts
npm test -- tests/integration/students-scope.test.ts tests/integration/students-concurrency.test.ts tests/integration/students-session-atomicity.test.ts
npm run typecheck
npm test
```

Los archivos de pruebas indicados están implementados. La suite completa es necesaria porque la extracción acotada de autenticación afecta utilidades compartidas aunque no cambie los contratos de Usuarios.

## 5. Recorrido funcional esperado

Usar `request` con el objeto de headers de sesión devuelto por `inviteTeacher`/`login`; no se requiere levantar un servidor HTTP separado al probar `app.request`.

| Paso | Solicitud con sesión de A | Resultado |
| --- | --- | --- |
| 1 | POST alta a grupo A con código `0001-A`, nombres y apellidos | 201, ID nuevo e `isActive=false`; no cuenta o credencial nueva. |
| 2 | GET listado y GET detalle | 200, incluye el registro propio y ningún estudiante de B. |
| 3 | PATCH nombres/apellidos o código | 200, conserva ID/grupo/estado; posterior GET refleja corrección. |
| 4 | POST `:id/deactivate`, sin cuerpo | 200, inactivo, datos conservados. |
| 5 | Repetir inactivación y GET | 200, mismo registro inactivo. |
| 6 | Repetir detalle/PATCH/inactivación con sesión B | 404 con cuerpo idéntico al de un ID inexistente; sin cambios. |

Ver los cuerpos y campos exactos en el contrato, sin duplicarlos en esta guía. Comprobar el número de cuentas/identidades/credenciales antes y después de operaciones académicas; permanece igual. La actividad de la sesión docente puede actualizarse por solicitudes aceptadas, pero no se crea una sesión para estudiante.

## 6. Casos adversos obligatorios

- Alta en grupo ajeno/inexistente, cuerpo con `teacherId`, alta activa, PATCH de ID/grupo/estado o vacío: rechazo seguro, sin cambios. Rol no docente/sin sesión se rechaza antes de diagnósticos de campos.
- Código duplicado incluso en grupo ajeno o inactivo: 409 neutral. Código propio sin cambiar: aceptado. `abc` y `ABC` son distintos; ceros iniciales y acentos se conservan.
- Límites de 1/50/51 caracteres en código y 1/100/101 en nombres/apellidos; trim, vacío y Unicode fuera del BMP. Valores demasiado largos no se truncan.
- Carreras alta/alta, alta/corrección y corrección/corrección con el mismo código final: un único titular, conflicto para perdedor y ninguna corrección parcial de otros campos.
- Expiración/cierre entre entrada y aceptación final: sin escritura académica confirmada si el servidor rechaza por sesión. Usar barreras controladas/relojes en pruebas, no sleeps frágiles. Si la operación confirma antes que la revocación bloqueada, comprobar ese orden y la denegación posterior.
- Cambio de rol/estado/responsable y fallo del proveedor: rechazo sin datos ajenos. Simular indisponibilidad de forma controlada sin detener servicios compartidos.
- Error de persistencia: rollback. Distinguir de pérdida de conexión de red después del commit, donde el alta puede existir; un reintento con código idéntico no duplica.

## 7. Migración y cierre

Validar la cadena completa en una base vacía aislada y la migración nueva sobre otra base aislada con cuentas/sesiones previas. Confirmar que solo se agregan grupos/estudiantes, sus FK, índices y restricciones; preservar cuentas, sesiones y auditoría existentes. No ejecutar resets ni drop de bases que no hayan sido creadas expresamente para estas pruebas.

Registrar comandos, entorno, resultado, casos concurrentes, regresiones y limitaciones. SC-001–006 y FR-001–012 deben quedar cubiertos antes de afirmar implementación completa. Los resultados de esta ejecución están en `validation.md`; esta guía no autoriza cambios de producción.

## 8. Aislamiento de esta ejecución

Se reutilizó el contenedor Podman `kudlab-auth-test-003`, pero no su base `kudlab_test`: contenía tablas académicas ajenas al historial de este worktree. Se creó `kudlab_students_005_test` para esta implementación y `kudlab_students_005_upgrade_test` para la comprobación de upgrade. El default de `tests/setup.ts` apunta a la primera. No ejecutar resets o migraciones de este worktree sobre la base compartida anterior. Antes de usar otros nombres/instancias, confirmar siempre que sean desechables.
