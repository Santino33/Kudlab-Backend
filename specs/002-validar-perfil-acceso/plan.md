# Implementation Plan: Validar perfil y acceso

**Branch**: `002-validar-perfil-acceso` (derivada de `001-gestionar-cuentas-roles`) | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-validar-perfil-acceso/spec.md`

## Summary

Completar la validación transversal de los perfiles adultos y la denegación de solicitudes protegidas sin permiso, sobre la implementación ya existente de `001-gestionar-cuentas-roles`. Reutilizar los esquemas de correo/nombre/contraseña, los índices de unicidad y la sesión autoritativa; corregir la información de errores de campo sin filtrar datos a personas no autorizadas. Establecer un contrato de comprobación de responsabilidad para futuros consumidores de Académico/Seguimiento: sin datos fiables de asignación, el acceso a estudiantes queda denegado, no se inventa una ruta de estudiantes. El cambio de correo activo continúa sujeto a verificación del titular.

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Node.js 24, según `package.json` y lockfile existentes.

**Primary Dependencies**: Hono 4.13.13, Better Auth 1.7.7, `@better-auth/drizzle-adapter` 1.7.7, Zod 4.3.6, Drizzle ORM 0.45.4, PostgreSQL; se reutilizan, sin nueva dependencia de aplicación.

**Storage**: PostgreSQL con `user_accounts`, reservas de correo, invitaciones y auditoría de 001; identidad/sesión en tablas Better Auth. Grupo y estudiante pertenecen a Académico y todavía no existen como modelo implementado aquí; no se crearán tablas ficticias para ellos.

**Testing**: Vitest 5; suites unitarias para formato/errores, integración con PostgreSQL para atomicidad/concurrencia/estado vigente, pruebas de contrato para operaciones de 001 y comprobación del futuro límite entre módulos. La medición de usabilidad SC-005 requiere personal real y cliente SPA, no se declara superada mediante tests del backend.

**Target Platform**: Servicio Node.js en Linux y PostgreSQL; consumidor SPA separado.

**Project Type**: Backend HTTP modular existente; Usuarios controla identidad y decisiones de acceso, Académico proveerá asignaciones reales y Seguimiento/Tareas consumen controles según corresponda.

**Performance Goals**: No se incorpora una meta aprobada nueva; para regresión medir p95 de operaciones de validación con 30 sesiones frente a la referencia documental de ≤2 s, sin elevarla a criterio de aceptación de RF-002 V3.

**Constraints**: Correo único `.edu.co` sin distinguir mayúsculas/minúsculas, rol único, contraseña ≥8 con mayúscula/minúscula/número, denegación ante estado o asignación no verificable, cambios compuestos sin efectos parciales y verificación diferida del correo de cuenta activa. Mantener error genérico para actores sin permiso; no registrar contraseñas, tokens ni datos de menores en errores o auditoría. La vigencia de 30 min y el alta pendiente son de 001, no decisiones nuevas.

**Scale/Scope**: Personal adulto del piloto; escenarios de 20 altas, 20 ediciones, diez pares concurrentes y dos docentes/grupos distintos (estos últimos solo cuando Académico exponga asignaciones). No incluye autenticación de estudiantes ni una nueva matriz de permisos.

## Constitution Check

*GATE: aprobado antes de Phase 0; revalidado después de Phase 1. Ninguna excepción constitucional.*

| Principio | Antes de investigar | Tras el diseño |
| --- | --- | --- |
| I. Finalidad pedagógica | Identidad del personal y acceso mínimo, sin interpretación de datos infantiles. | Cumple: no introduce indicador ni dato cognitivo. |
| II. Menores y acceso controlado | Cada solicitud protegida necesita identidad, rol, estado y ámbito comprobados en servidor; falla cerrada. | Cumple: guardia existente más contrato de ámbito sin permisos por defecto; sin exposición del ámbito ajeno. |
| III. Evidencia íntegra | Sin alteración de tareas ni indicadores; distinguir sesión de personal de tarea. | No afecta evidencia; no se añaden accesos de estudiantes. |
| IV. Módulos y contratos | Usuarios valida identidad; Académico será dueño de asignaciones; consumidores deben recibir decisión comprobable y errores. | Cumple: [contratos](contracts/) separan respuesta pública de comprobación interna; no se atribuye ruta de estudiantes a V3. |
| V. Trazabilidad | V3 RF-002/004 son propuestas, A CU01/CU03 aportan los comportamientos, las reglas concretas vienen de decisión previa en 001. | Cumple: [research.md](research.md) distingue fuentes y alcance, y [quickstart.md](quickstart.md) prevé pruebas de fallo y responsabilidad. |
| Tecnología y objetivos | Reutilizar stack efectivamente instalado, sin transformar cifras de diseño en acuerdos nuevos. | Cumple: contrato de 001 y código existente son fuente técnica; métricas documentales solo observación. |

Antes del gate se aclaró [spec.md](spec.md) US2/FR-004/SC-002 para distinguir edición de nombre del cambio de correo de cuenta activa sujeto a confirmación. Las verificaciones de FR-007/SC-003 sobre estudiantes requieren un proveedor real de asignaciones y un consumidor protegido de Académico/Seguimiento: hasta existir ambos, no se promete que el recorrido completo ya pueda ejecutarse. En ausencia de proveedor, denegar es obligatorio; el trabajo integrado deberá esperar la dependencia, no sustituirla con IDs facilitados por el cliente.

## Project Structure

### Documentation (this feature)

```text
specs/002-validar-perfil-acceso/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── validation.openapi.yaml
│   └── scope-authorization.md
└── checklists/
    └── requirements.md
```

`tasks.md` corresponde exclusivamente a `/speckit.tasks`.

### Source Code (repository root; cambios previstos, no duplicar módulo 001)

```text
src/
├── app.ts
├── auth/
│   ├── auth.ts
│   └── session-guard.ts
├── db/schema/accounts.ts
└── modules/usuarios/
    ├── accounts.validation.ts
    ├── accounts.errors.ts
    ├── accounts.routes.ts
    ├── accounts.service.ts
    └── scope-authorization.ts      # límite de autorización a integrar con Académico
tests/
├── unit/
├── integration/
└── contract/
```

**Structure Decision**: Evolucionar componentes presentes de 001; `scope-authorization.ts` representa una interfaz propuesta de decisión sin crear rutas ni tablas de estudiantes hasta que el contrato de Académico exista. No se repite alta, cambio de correo, invitación ni credencial como un segundo flujo de negocio.

## Phase 0: Research

[research.md](research.md) identifica origen y estado de cada regla y resuelve: reutilización del stack instalado y las validaciones de 001, unicidad concurrente de correos vigentes y reservados, respuesta diferenciada por actor, integración futura con asignaciones de Académico, tratamiento de contraseña en flujos existentes y objetivos de rendimiento documentales. No quedan decisiones técnicas abiertas para el diseño delimitado.

## Phase 1: Design & Contracts

- [data-model.md](data-model.md): invariantes existentes y frontera de responsabilidad, sin schema paralelo ni cambios obligatorios de persistencia.
- [contracts/validation.openapi.yaml](contracts/validation.openapi.yaml): subconjunto de rutas **ya existentes** de 001 con validación y errores de RF-002; consumidor SPA y suites de contrato. La futura feature de autenticación define los flujos de cambio/restablecimiento de contraseña: esta feature entrega la regla reutilizable, no crea endpoints sin identidad verificable.
- [contracts/scope-authorization.md](contracts/scope-authorization.md): entradas, decisión, fallos y consumidores de autorización de ámbito; requiere asignaciones autoritativas de Académico. Los contratos públicos de Académico/Seguimiento se formalizarán con sus features antes de exponerlos.
- [quickstart.md](quickstart.md): arranque y pruebas end-to-end disponibles, escenarios bloqueados por dependencia y prueba presencial pendiente.

**Post-design gate**: I–V se mantienen. La ausencia actual de Académico queda expresamente como dependencia para completar FR-007/SC-003 y no como autorización implícita. Si se pretenden implementar consultas/modificaciones de estudiantes sin asignaciones verificables, el gate falla. El contrato de 001 sigue siendo la autoridad para el estado de correo, roles y sesiones.
