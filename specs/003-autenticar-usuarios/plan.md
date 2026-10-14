# Implementation Plan: Autenticar usuarios

**Branch**: `003-autenticar-usuarios` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-autenticar-usuarios/spec.md`

## Summary

Extender el backend de Usuarios para ingreso de personal ACTIVO, cierre individual, caducidad por 30 minutos desde la última **solicitud protegida aceptada** y recuperación verificada por correo vigente. Reutilizar la identidad, sesiones opacas persistidas, roles y transporte de correo ya presentes. Una marca de actividad separada evita que `getSession`, la renovación interna de Better Auth o una denegación prolonguen el acceso; un canje propio de recuperación sustituye el hash y revoca sesiones en una transacción. El responsable confirmó la semántica de inactividad, canal y plazo de recuperación el 2026-10-13 para esta iteración.

## Technical Context

**Language/Version**: TypeScript 5.9.3 sobre Node.js 24 (rango `>=24 <25`).

**Primary Dependencies**: Hono 4.13.13; Better Auth y adaptador Drizzle 1.7.7 con plugins Admin, Bearer y JWT ya instalados; Drizzle ORM 0.45.4, `pg` 8.16.3, Zod 4.3.6, Nodemailer 10.1.0. JWT/JWKS siguen disponibles para integración, no sustituyen la sesión opaca validada.

**Storage**: PostgreSQL existente: `user`, `account`, `session`, `verification`, `user_accounts` y auditoría; nuevas tablas `session_activity` y `password_recovery_verifications`. No se usa R2 en autenticación.

**Testing**: Vitest 5.0.4; pruebas de unidad de reloj y validación, integración con PostgreSQL/Better Auth, contrato HTTP/OpenAPI y concurrencia de canje/revocación.

**Target Platform**: Servicio backend Node.js en Linux; cliente SPA externo, con origen autorizado configurado y entrega de correo SMTP en despliegue.

**Project Type**: Backend web modular con API HTTP; la interfaz SPA está fuera de este repositorio.

**Performance Goals**: Verificar SC-005 (≥90 % de cinco miembros de personal ingresan y salen sin ayuda en <2 min). Medir, sin convertir en aceptación aprobada, la referencia A §3.2/D §4 de hasta 30 usuarios concurrentes y p95 <2 s para solicitudes pertinentes de autenticación.

**Constraints**: Solo ADMIN/TEACHER ACTIVA con credencial establecida y un rol concordante; contraseña de 8–128 caracteres con mayúscula, minúscula y número; sin signup público; sesiones separadas, 30 min exactos desde último éxito protegido; acceso y recuperación fallan cerrados; recuperación de un uso por correo vigente y 30 min de vigencia (confirmados en esta iteración); ni credenciales ni datos de menores en respuestas indebidas; no exponer sesiones JWT como sesiones opacas.

**Scale/Scope**: Piloto escolar de aproximadamente 17 estudiantes y una docente, con personal administrador/docente; autenticación de estudiantes por código queda fuera. Se usa estado/correo/rol de la feature de cuentas y se entrega identidad a la autorización por ámbito, sin definir una matriz nueva de permisos.

## Constitution Check

*GATE: Revisado antes de Phase 0 y de nuevo tras Phase 1. No hay excepciones constitucionales.*

| Principio o restricción | Gate inicial | Resultado tras diseño |
| --- | --- | --- |
| I. Finalidad pedagógica | Autenticación de personal, sin resultados cognitivos ni diagnósticos. | Cumple: contrato solo devuelve identidad propia, sin datos de estudiantes. |
| II. Protección de menores | Identidad, rol y cuenta se validan en servidor para cada solicitud; denegar si falla sesión/BD. | Cumple: guardia y contrato fail-closed, sesión persistida y control propio de inactividad; ámbitos quedan bajo proveedor Académico. |
| III. Integridad de evidencia | No confundir sesión de usuario con sesión de tarea. | Cumple: modelo `session_activity` solo afecta sesiones de acceso, sin tocar `task_sessions`. |
| IV. Límites y contratos | Usuarios maneja identidad, cuentas gobierna estado/rol, Académico ámbito; SPA consume contrato documentado. | Cumple: [contrato](contracts/auth.openapi.yaml) especifica entradas/salidas/errores y consumidores; decisión tecnológica registrada en [investigación](research.md). |
| V. Trazabilidad | RF-003 V3 es propuesta; cotejar A CU02 p. 31, D §§3.2 y 6, DBML y PUML, además de decisiones de 001. | Cumple: fuentes, alternativas, política asumida y pruebas de fallos/concurrencia quedan registradas en `research.md`, `data-model.md` y `quickstart.md`. |
| Parámetros y aprobación | La recuperación por correo y TTL nacieron como propuesta de `spec.md`, no de V3. | El responsable confirmó recuperación e inactividad el 2026-10-13 para esta iteración; V3 mantiene estado de propuesta original. |

Las decisiones de stack de `specs/001-gestionar-cuentas-roles/plan.md` ya están materializadas en el repositorio; este plan no presenta el diseño D como prueba de implementación del resto de la feature. **Gate de implementación**: el responsable confirmó el 2026-10-13 el canal y plazo de recuperación y la semántica de inactividad de `spec.md`. No se requiere excepción constitucional.

## Project Structure

### Documentation (this feature)

```text
specs/003-autenticar-usuarios/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── auth.openapi.yaml
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
src/
├── app.ts                         # Lista blanca de /api/auth/* y rutas /api/v1/auth/*
├── auth/
│   ├── auth.ts                    # Better Auth, credenciales y sesión
│   ├── credential-identity.ts     # Hash compartido
│   └── session-guard.ts           # Identidad activa, inactividad y alcance protegido
├── config/env.ts                  # Origen SPA, URL de recuperación y correo
├── db/
│   ├── schema/auth.ts             # Tablas Better Auth existentes
│   ├── schema/accounts.ts         # Estado/rol/correo ya existentes
│   ├── schema/authentication.ts   # Tablas nuevas de actividad/recuperación (previsto)
│   └── migrations/               # Migración nueva para las tablas previstas
└── modules/usuarios/
    ├── lifecycle.service.ts       # Inactivación transaccional existente
    ├── account-lock.ts            # Orden de bloqueo compartido
    ├── recovery.routes.ts         # Solicitud y canje de recuperación (previsto)
    └── recovery.service.ts        # Validación, hash y revocación atómicos (previsto)
tests/
├── unit/                          # Borde temporal y reglas de credencial
├── contract/                      # Rutas/errores/formato uniforme
└── integration/                   # DB real, sesiones, reintentos y cambios de cuenta
```

**Structure Decision**: Extender el backend modular existente, sin crear aplicación nueva ni rutas de acceso estudiantil. Los archivos rotulados «previsto» son objetivos de la fase de implementación, no archivos ya presentes.

## Phase 0: Research

[research.md](research.md) resuelve la elección de mecanismo opaco, el límite exacto de inactividad frente a la renovación interna, la protección de endpoints Better Auth y la estrategia de recuperación consistente con cuentas. Los parámetros de negocio se confirmaron expresamente para esta iteración.

## Phase 1: Design & Contracts

- [data-model.md](data-model.md): identidad/cuenta existentes, marca propia de sesión, verificación de recuperación y atomicidad de estados.
- [contracts/auth.openapi.yaml](contracts/auth.openapi.yaml): ingreso, consulta, cierre y recuperación, con errores uniformes y condiciones de autorización; consumidor principal SPA y guardias de `/api/v1/*`. Convivencia con [contrato de cuentas](../001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml).
- [quickstart.md](quickstart.md): preparación reproducible, comandos y recorridos verificables de límites de tiempo, cierre, revocación y correo sin implementación en el documento.

**Post-design gate**: Cumple I–V. En implementación, probar que ninguna ruta pública de Better Auth elude la comprobación de estado y que no se renueva actividad por consultas/denegaciones; garantizar canje y revocación en la misma transacción. Si esas propiedades fallan, no declarar completada la feature.
