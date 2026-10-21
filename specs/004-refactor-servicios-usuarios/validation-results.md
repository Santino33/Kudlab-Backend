# Resultados de validación

## Línea base previa al refactor — 2026-10-20

- Rama: `refactor-servicios-usuarios`.
- Node.js: v24.18.0; dependencias instaladas.
- Checklist de requisitos: 16 completos, 0 pendientes; no se modificaron marcadores.
- `.gitignore` cubre dependencias, salidas, logs y configuración local; paquete privado, sin necesidad de `.npmignore`.
- `npm run typecheck`: PASS.
- Se intentó `npm run db:migrate` con `DATABASE_URL` y `MIGRATION_DATABASE_URL` apuntando explícitamente a la base de pruebas `kudlab_test` en `127.0.0.1:55432`. El proceso terminó sin confirmar en su salida que las migraciones se completaran; no se considera verificado el esquema.
- `npm test`, con `DATABASE_URL` dirigida a la misma base aislada: 19 archivos, 82 pruebas; 3 archivos/5 pruebas pasaron, 16 archivos/77 pruebas fallaron.
- Causa de los fallos: `connect ECONNREFUSED 127.0.0.1:55432`, durante la preparación de datos de las pruebas. No son regresiones introducidas: no se modificaron servicios.

## Bloqueo

T001 no puede completarse hasta disponer de PostgreSQL aislado accesible y verificar sus migraciones. T002 tiene un intento registrado, pero requiere repetir la línea base una vez resuelto el entorno. Se detiene la implementación antes de US1 conforme a la regla de detenerse cuando falla una tarea secuencial.

Siguiente acción: habilitar la base de pruebas y repetir migraciones, comprobación de tipos y suite completa. No marcar T001/T002 ni las tareas de implementación como terminadas.

## Resolución y línea base confirmada

Se encontró el contenedor rootless Podman `kudlab-auth-test-003` detenido, con PostgreSQL 17 y el puerto de pruebas configurado. Se inició sin recrear almacenamiento. `pg_isready` confirmó disponibilidad y las migraciones finalizaron correctamente.

`npm test`: **19 archivos, 82 pruebas aprobadas**, duración 48,78 s. La comprobación de tipos previa pasó. Bloqueo resuelto; no se cambiaron credenciales ni dependencias.

## Implementación y regresión final

- T003: inventario de 19 archivos y consumidores de aplicación, autenticación, bootstrap y pruebas contrastado con las interfaces documentadas. No se encontraron contradicciones que requirieran cambiar un contrato.
- T004–T009: salida temprana en edición de nombre, condiciones de elegibilidad/vigencia con nombres explícitos y reutilización de `hasActiveIdentity` en recuperación; bloques y efectos conservados. Las partes ya sencillas (emisión, entrega, consultas y auditoría) se revisaron sin agregar envoltorios ni capas.
- T010–T016: los 19 archivos se distribuyeron entre `accounts/`, `invitations/`, `email-changes/`, `promotion-requests/`, `recovery/` y `shared/`. Chequeo de tipos aprobado tras cada grupo; búsqueda de referencias a las ubicaciones originales sin coincidencias en `src/` ni `tests/`.
- T017: se revisó la cobertura existente de contratos, autenticación, ciclo de vida, integridad de auditoría, concurrencia, ámbito y desempeño. Se añadió un caso de recuperación con rol discordante: no emite correo, rechaza el canje, conserva contraseña y token hasta restablecer la coherencia.
- T018: `npm run typecheck` PASS; `npm test` **19 archivos, 83 pruebas aprobadas** (82 existentes y 1 nueva), duración 52,93 s; `git diff --check` PASS. La duración global incluye una prueba adicional y no constituye una comparación controlada de rendimiento; la prueba de carga existente pasó.

## Trazabilidad y pendiente de revisión humana

- FR-001/FR-002/FR-003/FR-006: contratos e integración sin regresiones detectadas, incluyendo errores, revocación, auditoría y concurrencia.
- FR-004: organización por flujos aplicada y referencias actualizadas.
- FR-005: flujo principal menos anidado y comprobaciones nombradas; falta medir la comprensión con otra persona.
- FR-007: sin nuevas capacidades, dependencias, reglas, esquema ni migraciones añadidas por el refactor.
- SC-001/SC-004: satisfechos para los escenarios automatizados ejecutados; no se afirma cobertura exhaustiva de todas las combinaciones posibles.
- **T019 / SC-002 / SC-003 pendientes**: requieren una persona que no participó en el refactor. Solicitar lectura/localización de cuentas, invitaciones, cambio de correo y recuperación y registrar tiempos reales; no sustituir esa evaluación por la suite automatizada. El agente no puede actuar como revisor independiente de su propio cambio.

El contenedor de pruebas queda iniciado. No se ejecutaron hooks: `.specify/extensions.yml` no existe.
