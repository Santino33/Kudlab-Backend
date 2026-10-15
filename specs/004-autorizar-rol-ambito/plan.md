# Implementation Plan: Autorizar por rol y responsabilidad

**Branch**: `004-autorizar-rol-ambito` | **Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-autorizar-rol-ambito/spec.md`

## Summary

Aplicar una decisión explícita de permiso por operación y ámbito a cada solicitud protegida del personal. Reutilizar la sesión opaca, cuenta y rol actuales de 001–003 y el límite denegado por defecto de 002; hacer que Académico sea la única fuente de asignaciones vigentes y que cada consumidor proteja lecturas, escrituras, listados y agregados antes de devolver datos. El código hoy solo expone cuentas y un límite de ámbito con dobles: el plan separa los controles existentes de los escenarios que necesitan proveedor y consumidor reales. Ninguna autorización sobre menores se activa a partir de IDs enviados por el cliente.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node.js 24 (`package.json`: `>=24 <25`).

**Primary Dependencies**: Hono 4.13.13, Better Auth 1.7.7, Drizzle ORM 0.45.4, `pg` 8.16.3 y Zod 4.3.6 existentes; ninguna dependencia nueva prevista.

**Storage**: PostgreSQL actual (`user_accounts`, identidad `user`, sesiones `session`/`session_activity`). Las futuras relaciones docentes/grupos/estudiantes corresponden a Académico y requieren su propio modelo y migración al integrar ese módulo; no crear una segunda tabla de permisos en Usuarios.

**Testing**: Vitest 5; pruebas unitarias de decisiones de permiso y denegación, pruebas de contrato HTTP para rutas existentes, integración con PostgreSQL y rutas reales de Académico/Seguimiento cuando existan; fallos de proveedor, cambios de rol/asignación, consultas filtradas, escrituras mixtas y carga con 30 sesiones de prueba.

**Target Platform**: Servicio HTTP Node.js en Linux, PostgreSQL; SPA separada del repositorio.

**Project Type**: Backend web modular existente; sin frontend implementado aquí.

**Performance Goals**: Medir 30 sesiones simultáneas y p95 <2 s para consultas protegidas según A §3.2 p. 17 como **referencia propuesta**, no criterio institucional aprobado; SC-006 requiere prueba guiada con adultos y SPA.

**Constraints**: Solo cuentas ACTIVA con un rol ADMIN/TEACHER coincidente con identidad; sesión opaca persistida vigente, 30 min desde último éxito protegido; una denegación no renueva actividad. Denegar si falta o falla asignación actual. No emitir datos, conteos, filtros o errores que revelen un ámbito ajeno; administrador de cuentas no obtiene permisos de estudiantes por defecto. Para escrituras, autorización y efecto deben ser coherentes frente a cambios concurrentes de asignación.

**Scale/Scope**: Piloto de tercero (17 menores y una docente en campo; pruebas con dos docentes y grupos separados). Actualmente hay rutas de cuentas y un límite de ámbito sin proveedor real; las rutas y permisos concretos de estudiantes/panel deben quedar definidos por el consumidor antes de habilitarse. No se diseña identidad de estudiante ni consentimientos en esta feature.

## Constitution Check

*GATE: comprobado antes de Phase 0 y revalidado tras Phase 1; sin excepción constitucional.*

| Principio | Gate inicial | Post-diseño |
| --- | --- | --- |
| I. Finalidad pedagógica | Solo limitar acceso del personal, sin inferir indicadores o diagnósticos. | Cumple: contratos no definen resultados clínicos ni mezclan fuentes pedagógicas. |
| II. Menores y acceso controlado | Cada lectura/escritura sobre estudiantes exige identidad, rol, estado, ámbito y fallo cerrado en servidor; consentimiento sigue siendo condición adicional de Académico/Tareas. | Cumple: contrato interno niega ante proveedor ausente/fallido; contrato consumidor exige filtro seguro y no confunde ámbito con consentimiento. |
| III. Integridad de evidencia | No alterar sesiones de tarea ni eventos al cambiar permisos. | Cumple: reutiliza exclusivamente la sesión de usuario existente y no introduce medidas o datos faltantes artificiales. |
| IV. Límites modulares y contratos | Usuarios valida actor/operación; Académico aporta asignaciones y relación estudiante↔grupo; consumidores definen su propia operación pública y error. | Cumple: [contrato interno](contracts/authorization-boundary.md) y [overlay HTTP de cuentas](contracts/accounts-authorization.md) documentan entradas/salidas, fallos y consumidores; ningún endpoint académico se hace pasar por existente. |
| V. Trazabilidad y pruebas | RF-004 V3 y D-08 continúan propuestos; cotejar A CU03/CU04/CU05 y DBML; pruebas con dos docentes reales antes de cerrar SC-002/003. | Cumple: [research.md](research.md) conserva fuente/versión y alternativas; [quickstart.md](quickstart.md) diferencia lo ejecutable hoy de la prueba integrada pendiente. |
| Decisiones y métricas | El stack se toma del código, no del diseño propuesto; objetivos de A/D no se declaran aprobados. | Cumple: mediciones y prueba humana se registran como metas propuestas pendientes de ejecución. |

**Gate de activación**: La matriz de permisos específica de cada futura operación docente y la fuente real de asignaciones deben acordarse antes de exponer una ruta de menores. Sin ambas, conservar la denegación; no reemplazar la asignación por un doble o una relación asumida. Para cerrar SC-002/003, US3 de 002 y FR-003–005 de esta feature, se necesitan proveedor y consumidor reales probados juntos.

## Project Structure

### Documentation (this feature)

```text
specs/004-autorizar-rol-ambito/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── contracts/
    ├── authorization-boundary.md
    └── accounts-authorization.md
```

`tasks.md` corresponde a `/speckit.tasks`, no a esta fase.

### Source Code (repository root)

```text
src/
├── app.ts                                # Rutas actuales; no publicar datos estudiantiles aún
├── auth/
│   ├── active-identity.ts                # Cuenta y rol concordantes
│   ├── session-activity.ts               # Inactividad desde éxito protegido
│   └── session-guard.ts                  # Sesión/actor de cada solicitud; revisión de ámbito
├── db/schema/accounts.ts                 # Cuenta y rol existentes
└── modules/usuarios/
    ├── scope-authorization.ts            # Límite existente a extender sin fallar abierto
    └── accounts.routes.ts                # Consumidor ADMIN ya montado
tests/
├── unit/scope-authorization.test.ts      # Actualmente solo dobles
├── integration/auth-boundaries.test.ts   # Sesión/rol y rutas de cuentas existentes
└── contract/                             # Contrato de cuentas; futuro consumidor propio

# Al integrar el módulo Académico en su feature, no afirmar que estos archivos existen hoy:
src/modules/academico/                    # Relaciones, fuente de asignaciones y consumidor real
src/modules/seguimiento/                  # Consultas/listados derivados cuando se especifiquen
tests/integration/                        # Casos cruzados con dos docentes y dos grupos reales
```

**Structure Decision**: Ampliar el límite Usuarios existente y reutilizar guardias de 001–003; el propietario de las asignaciones será Académico. Mantener inhabilitados los consumidores de menores hasta que se establezca el modelo académico y el permiso de cada operación; no agregar una ruta demostrativa basada en datos ficticios.

## Phase 0: Research

[research.md](research.md) resuelve mecanismo de identidad/rol vigentes, frontera Usuarios–Académico, listas/agregados, concurrencia/revocación y formato de contratos/pruebas. La matriz de operaciones futuras no es una incógnita técnica a inventar: es una condición de aprobación de cada consumidor.

## Phase 1: Design & Contracts

- [data-model.md](data-model.md): entidades existentes, propuesta académica separada, decisiones transitorias y reglas de consistencia.
- [contracts/authorization-boundary.md](contracts/authorization-boundary.md): contrato interno de decisión, lista, escrituras, errores y productores/consumidores.
- [contracts/accounts-authorization.md](contracts/accounts-authorization.md): autorización observada en rutas de cuentas existentes, sin duplicar su OpenAPI.
- [quickstart.md](quickstart.md): comandos de verificación y escenarios P1 ejecutables; prueba integrada P2/P3 condicionada a Académico y Seguimiento; registro de métricas y usabilidad sin declararlas aprobadas.

**Post-design gate**: Cumple I–V para el diseño y mantiene cerrado el acceso a menores sin proveedor/consumidor real. La planificación puede continuar a tareas, pero la implementación de historias P2/P3 y aceptación global requieren resolver las dependencias anotadas antes de declararse completas.

## Avance de implementación (2026-10-14)

El responsable acotó esta iteración a lectura docente y edición exclusiva de nombres/apellidos, con un docente por grupo y un grupo por estudiante; quedan expresamente fuera alta, activación, consentimiento y permisos ADMIN sobre menores. `src/db/schema/academic.ts`, la migración Drizzle 0008, `src/modules/academico/` y rutas `/api/v1/students` y `/api/v1/groups` implementan esa superficie mínima sobre datos persistidos. No existe ruta para registrar o activar estudiantes; esos flujos quedan bajo la feature Académico. Seguimiento y Tareas aún no tienen consumidor. Ver evidencia y limitaciones actuales en [quickstart.md](quickstart.md).
