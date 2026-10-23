# Implementation Plan: Operaciones del docente sobre estudiantes

**Branch**: identificador de feature `005-gestionar-estudiantes` reportado por setup; HEAD Git sin rama, no se creó una rama | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: `specs/005-gestionar-estudiantes/spec.md` y [source-context.md](source-context.md).

**Implementation update (2026-10-23)**: operaciones y migración implementadas; validación en `validation.md`. El contenido de fases siguiente conserva el diseño original; la precisión de bloqueos NOWAIT y el aislamiento de las bases se documentan en research §9 y quickstart §8. No hay despliegue productivo.

## Summary

Implementar en Académico alta, listado, detalle, corrección e inactivación de estudiantes para docentes autenticados y responsables del grupo. Los estudiantes son registros académicos, no usuarios interactivos. Agregar únicamente `groups` y `students` fieles al ERD, adaptando la referencia docente a `user_accounts.id`; reutilizar autenticación y frontera de ámbito existentes. Alta siempre inactiva, sin activación ni gestión de consentimiento/tareas.

Las nuevas operaciones no deben confirmar cambios y después convertir su respuesta en rechazo por actividad de sesión. Se requiere una extracción acotada de utilidades de autenticación para aceptar la actividad dentro de la transacción académica, conservando las interfaces y comportamiento de Usuarios; ver research §8.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node.js `>=24 <25`, ESM con imports `.js`.

**Primary Dependencies**: Hono 4.13.13, Better Auth y adapter 1.7.7, Drizzle ORM 0.45.4, Drizzle Kit 0.31.10, pg 8.16.3, Zod 4.3.6; ninguna dependencia nueva.

**Storage**: PostgreSQL existente; dos tablas nuevas con FK, código único global y migración aditiva. Registrar esquema académico en el cliente Drizzle. Sin almacenamiento de objetos ni cambios al esquema de autenticación.

**Testing**: Vitest 5.0.4; `npm run typecheck`, `npm test`; pruebas unitarias, de contrato y de integración con base PostgreSQL aislada y migrada. Mocks solo para validación/errores, no para probar FK, unicidad o carreras.

**Target Platform**: Backend Node.js en Linux, API para el cliente del docente.

**Project Type**: Servicio web REST, extensión de backend existente.

**Performance Goals**: No se aprueba un SLA nuevo. Verificar aislamiento y corrección con matriz de al menos dos docentes y dos grupos por docente; observar tiempos y regresiones, sin presentar cifras históricas como compromisos. Índices de FK/ámbito para no requerir filtrado global en memoria.

**Constraints**: Autorización en servidor por cuenta/rol/estado y ámbito vigente; fail closed; restricciones globales de código; rollback ante rechazo del servidor; no cuentas estudiantiles, tareas, consentimiento, activación/reactivación, traslado, borrado o administración de grupos. No escribir datos sensibles en mensajes/logs. Fallo de red después de commit no implica rollback del servidor.

**Scale/Scope**: Piloto académico, cinco operaciones HTTP nuevas, dos entidades nuevas. Colección completa del ámbito, sin filtros avanzados/paginación en esta iteración. Cambios acotados de integración en app/auth y pruebas de regresión completas de Usuarios.

## Constitution Check

*GATE previo a Phase 0: PASS. Reevaluación posterior a Phase 1: PASS, sin excepción constitucional.*

| Principio | Comprobación previa | Resultado después del diseño |
| --- | --- | --- |
| I. Finalidad pedagógica | Mantenimiento académico; sin interpretación clínica. | PASS: contratos solo exponen datos mínimos del registro. |
| II. Menores y acceso | Docente activo y responsable en cada operación; consentimiento antes de activar. | PASS: consultas filtradas, escrituras transaccionales, altas inactivas y ninguna ruta de activación. Pruebas de rechazo obligatorias. |
| III. Evidencia íntegra | No se toca ejecución/evidencia de tareas. | PASS: no se crean entidades de tareas ni se altera evidencia. |
| IV. Módulos y contratos | Académico posee estudiantes/grupos; Usuarios aporta identidad y ámbito. | PASS: contratos y consumidores explícitos; extracción auth preserva comportamiento previo y permite atomicidad de los nuevos consumidores. |
| V. Trazabilidad y verificación | Originales contrastados y diferencias registradas en source-context. | PASS: cada campo se vincula al ERD/DBML; defaults separados de decisiones originales; matriz de pruebas cubre FR/SC. |
| Calidad y gobierno | No adoptar SLA o políticas no aprobados. | PASS: supuestos de spec siguen visibles; no modificación constitucional ni afirmación de migraciones desplegadas. |

La ausencia de consentimiento no permite activar; la administración/provisión real de grupos permanece como prerrequisito operativo externo. No es necesario ampliar esta feature para planificar ni probar sus endpoints con fixtures aislados. Los supuestos de spec deben ser revisados antes de implementación/despliegue.

## Project Structure

### Documentation (this feature)

```text
specs/005-gestionar-estudiantes/
├── spec.md
├── source-context.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/students-api.md
├── quickstart.md
└── checklists/requirements.md
```

`tasks.md` se generará por `/speckit.tasks`, no en esta fase.

### Source Code (repository root)

```text
src/
├── app.ts                             # Montaje del router académico
├── auth/
│   ├── session-guard.ts                # Preparación compartida, wrapper previo preservado
│   └── session-activity.ts             # Variante transaccional reutilizable
├── db/
│   ├── client.ts                      # Registro del esquema académico
│   ├── schema/academic.ts             # Nuevo: groups, students
│   └── migrations/                    # Nueva migración + metadatos generados
└── modules/
    ├── usuarios/shared/scope-authorization.ts # Frontera existente, sin ampliar roles
    └── academico/
        ├── students/
        │   ├── students.routes.ts
        │   ├── students.service.ts
        │   └── students.validation.ts
        └── shared/
            ├── academic.errors.ts
            ├── academic-auth.ts       # Guard docente sin post-commit de autenticación
            └── scope-provider.ts      # Proveedor basado en groups/students
tests/
├── helpers.ts                         # Fixtures/reset de entidades nuevas
├── unit/students-validation.test.ts
├── contract/students-api.test.ts
├── integration/students-scope.test.ts
├── integration/students-concurrency.test.ts
└── integration/students-session-atomicity.test.ts
```

**Structure Decision**: Seguir carpetas por flujo del backend existente; handlers delgados y transacciones en servicio, validación propia de estudiantes y proveedor de ámbito académico. No agregar repositorios genéricos, nueva capa de cuentas ni fachadas. Archivos nuevos listados son destinos propuestos, no implementación existente.

## Phase 0 — investigación completada

[research.md](research.md) registra decisión, justificación y alternativas sobre datos, normalización, ámbito, carreras, estado/consentimiento, preparación de grupos, stack/contratos, pruebas y atomicidad de sesión. La investigación de integración verificó rutas/middleware, helpers de prueba, versiones y convenciones de error. Sin incógnitas técnicas bloqueantes.

## Phase 1 — diseño completado

- [data-model.md](data-model.md): campos y restricciones originales, FK adaptada, estados, normalización, bloqueos y migración prevista.
- [contracts/students-api.md](contracts/students-api.md): cinco operaciones nuevas, DTO mínimo, campos permitidos, códigos/cuerpos de error, orden de autorización y matriz contractual.
- [quickstart.md](quickstart.md): guía ejecutable posterior a implementación, base aislada, fixtures, comandos y escenarios verificables; no código de implementación.

## Secuencia prevista para implementación posterior

1. Registrar línea base de typecheck/pruebas de Usuarios en base aislada. Revisar bloqueo de cuentas y sesiones para conservar orden compatible.
2. Agregar esquema, cliente y migración de dos tablas; revisar SQL y metadatos; validar desde base vacía y desde estado previo con cuentas existentes.
3. Extraer preparación y aceptación transaccional de autenticación sin cambiar contratos de Usuarios; agregar guard académico y comprobar rollback en vencimiento/revocación.
4. Implementar proveedor, validación estricta, errores propios y servicios transaccionales; no reutilizar validación de perfiles de personal ni auditoría de cuentas para estudiantes.
5. Montar rutas protegidas tanto en colección como subrutas y serializar solo DTO permitido. Ninguna decisión de autorización posterior al commit puede transformar un éxito en rechazo.
6. Ejecutar pruebas unitarias, contractuales, integración/carreras y regresión completa; documentar resultados reales y límites, incluyendo preparación de grupos pendiente para despliegue.

## Cobertura y revisión final

| Requisitos / criterios | Validación prevista |
| --- | --- |
| FR-001, FR-003, FR-011 / SC-004 | Cero cuentas/credenciales nuevas; altas inactivas, activación rechazada. |
| FR-002, FR-005, FR-008, FR-010 / SC-001, SC-005 | Dos docentes × dos grupos, listados y operaciones cruzadas; sesión/estado/rol y proveedor fallidos. |
| FR-004, FR-009 / SC-002 | Límites Unicode, trim/caso/ceros, duplicados globales y carreras create/create, create/update y update/update con rollback. |
| FR-006, FR-007 / SC-003 | Correcciones y repetición de inactivación preservan ID/grupo/datos. |
| FR-009 / SC-005 | Cierre/vencimiento antes de aceptación final revierte escritura; operaciones previas confirmadas se ordenan antes de revocación bloqueada. |
| FR-012 / SC-006 | Recorrido completo desde cliente de prueba, sin interacción del estudiante, sin endpoints de tareas/consentimiento/grupos. |

Los artefactos describen diseño; no se ejecutaron pruebas de la feature ni se crearon migraciones. Final de este comando: Phase 1. Siguiente fase: `/speckit.tasks`.
