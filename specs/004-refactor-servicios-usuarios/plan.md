# Implementation Plan: Refactorizar servicios de usuarios

**Branch**: `refactor-servicios-usuarios` | **Date**: 2026-10-20 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-refactor-servicios-usuarios/spec.md`

## Summary

Ordenar los archivos de Usuarios por responsabilidad y hacer legibles los flujos de sus servicios sin alterar reglas, respuestas, permisos, datos ni auditoría. Primero identificar consumidores y dejar registrada la línea base; después mover por grupos y aclarar comprobaciones repetitivas solo donde mejore el flujo. Cerrar con una fase de pruebas de regresión de todo el módulo y sus consumidores.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node.js 24 (`>=24 <25`)

**Primary Dependencies**: Hono 4.13.13, Better Auth 1.7.7, Drizzle ORM 0.45.4, Zod 4.3.6; ninguna dependencia nueva

**Storage**: PostgreSQL existente; mismas tablas, transacciones, bloqueos y auditoría, sin migraciones

**Testing**: Vitest 5, `npm run typecheck`, `npm test`; integración/contratos con PostgreSQL aislado y migrado

**Target Platform**: API Node.js para el piloto escolar

**Project Type**: Servicio web backend (solo Usuarios implementado en este repositorio)

**Performance Goals**: Sin degradación observable frente a la línea base de pruebas; no se aprueba una nueva meta de latencia en este refactor

**Constraints**: Mantener acceso denegado por defecto, equivalencia de rutas y errores, atomicidad, revocación y trazas; no modificar datos persistidos ni la semántica de tokens/sesiones

**Scale/Scope**: 19 archivos en el nivel principal de `src/modules/usuarios/`, rutas de `src/app.ts` y consumidores en `src/auth/`, `src/scripts/` y `tests/`

## Constitution Check

*GATE previo a investigación: PASS. Reevaluación posterior al diseño: PASS.*

- **I. Finalidad pedagógica**: no se alteran datos académicos ni se agregan interpretaciones; sin impacto.
- **II. Protección y acceso**: se preservan controles de identidad, rol, estado y ámbito y el rechazo ante fallos. Regresión de autenticación, autorización, revocación y recuperación obligatoria; PASS.
- **III. Evidencia íntegra**: no se tocan tareas ni indicadores; se conserva la integridad de las operaciones de cuenta; PASS.
- **IV. Límites y contratos**: solo cambia la organización interna de Usuarios; `src/app.ts` sigue exponiendo las mismas rutas, respuestas y permisos. Consumidores identificados en [contracts/current-interfaces.md](contracts/current-interfaces.md); PASS.
- **V. Trazabilidad**: las reglas previas permanecen en sus especificaciones y pruebas; mantener auditoría, transacciones y verificación de contratos; registrar cualquier contradicción, no resolverla inventando una política; PASS.
- **Restricciones de calidad**: no se convierten las cifras de diseño en compromisos nuevos; comparar el comportamiento con la línea base y ejecutar la regresión al final; PASS.

**Reevaluación posterior al diseño**: [research.md](research.md), [data-model.md](data-model.md) y [contracts/current-interfaces.md](contracts/current-interfaces.md) no proponen entidades, reglas ni interfaces nuevas. Ningún gate requiere excepción.

## Project Structure

### Documentation (this feature)

```text
specs/004-refactor-servicios-usuarios/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── contracts/current-interfaces.md
├── quickstart.md
└── checklists/requirements.md
```

### Source Code (repository root)

```text
src/
├── app.ts                         # Montaje de rutas: solo se actualizan importaciones
├── auth/                          # Consumidor de validación, identidad y ámbito
├── scripts/bootstrap-admin.ts     # Consumidor de validación y auditoría
└── modules/usuarios/
    ├── accounts/                 # Cuentas, ciclo de vida y roles (servicios y rutas)
    ├── invitations/              # Invitaciones y entrega de correo
    ├── email-changes/            # Cambio de correo
    ├── promotion-requests/       # Solicitudes de ascenso
    ├── recovery/                 # Recuperación de contraseña
    └── shared/                   # Validación, tipos, errores, auditoría, bloqueo y ámbito reutilizados
tests/
├── unit/
├── contract/
├── integration/
└── performance/
```

**Structure Decision**: Agrupar los 19 archivos existentes por el flujo que atienden; conservar sus nombres y responsabilidades y mover a `shared/` únicamente las piezas ya usadas por varios flujos. Ajustar rutas relativas y todos los consumidores existentes sin crear capas, fachadas o reexportaciones. Ver el mapa y las dependencias actuales en [research.md](research.md).

## Fases de ejecución

1. **Línea base y alcance**: inventariar importaciones externas e internas; ejecutar `npm run typecheck` y `npm test` contra la base de pruebas aislada y registrar resultados o impedimentos. Revisar las rutas existentes y errores antes de tocar servicios.
2. **Organización**: trasladar por flujo los archivos existentes; actualizar importaciones de `src/app.ts`, `src/auth/`, `src/scripts/` y `tests/`. Compilar tras cada grupo para detectar referencias rotas; conservar montaje y controles en el mismo orden.
3. **Legibilidad de servicios**: recorrer operaciones de cuentas, invitaciones, cambio de correo, ascenso, ciclo de vida y recuperación; separar acción principal de comprobaciones confusas usando las utilidades existentes o comprobaciones locales simples. No fusionar chequeos con distintos errores o efectos, no mover efectos fuera de su transacción y no introducir abstracciones sin duplicación real.
4. **Pruebas de regresión (fase final)**: ejecutar `npm run typecheck` y `npm test` completos con la base aislada y migrada. Comparar con línea base los recorridos exitosos y denegados, códigos y cuerpos de respuesta, auditoría, entrega de correo, caducidad y revocación, bloqueos/concurrencia, ámbito, autenticación y desempeño cubierto. Añadir solo pruebas específicas si se descubre un comportamiento afectado sin cobertura; corregir diferencias antes de dar por terminado el refactor. Registrar resultados y límites de ejecución y realizar la revisión humana de legibilidad/localización de SC-002 y SC-003.
