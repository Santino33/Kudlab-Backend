# Implementation Plan: Gestionar cuentas y roles

**Branch**: `001-gestionar-cuentas-roles` | **Date**: 2026-10-12 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-gestionar-cuentas-roles/spec.md`

## Summary

Construir el módulo backend Usuarios para invitar y administrar cuentas de personal
ADMIN/TEACHER con un solo rol, activación por el titular, auditoría y revocación
inmediata. Node.js/TypeScript + Hono exponen el contrato de cuentas; Better Auth
1.7 gestiona identidad, contraseñas y sesiones con Drizzle/PostgreSQL. La invitación
pendiente es un flujo propio de Kudlab: el Admin plugin no implementa este tipo de
invitación. El acceso ADMIN posterior al arranque requiere solicitud del docente y
aprobación de otro ADMIN. El control de acceso consulta estado/rol vigentes y no
acepta un JWT firmado como única prueba de permiso.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js 24 LTS (versión exacta fijada
en manifiesto y lockfile al implementar).

**Primary Dependencies**: Hono; Better Auth 1.7.x (Admin, Bearer y JWT plugins),
`@better-auth/drizzle-adapter` compatible con versión instalada, Drizzle ORM,
PostgreSQL, `jose` para consumidores JWT/JWKS; proveedor de correo transaccional
configurable. No hay aún dependencias instaladas.

**Storage**: PostgreSQL para tablas de Better Auth, `account_invitations`,
`admin_role_requests`, auditoría y estado/correo/rol autoritativos. No se usa R2 en esta feature: el diseño lo
reserva para evidencias privadas y multimedia de Académico/Tareas.

**Testing**: Vitest (decisión de plan, no stack confirmado en fuentes), pruebas
unitarias de transiciones y validaciones, integración Hono + PostgreSQL/Better
Auth, contratos HTTP y pruebas de concurrencia, revocación y fallo de entrega.

**Target Platform**: Servicio Node.js en Linux; contenedor Docker/Compose como
opción de despliegue descrita en D §6, sin generar infraestructura en esta fase.

**Project Type**: Backend web/API REST; el frontend SPA React/Vite documentado
es otro proyecto/consumidor y no se implementa en este repositorio.

**Performance Goals**: Probar 30 accesos concurrentes y p95 de peticiones de
gestión ≤2 s como metas documentadas en A §3.2, pendientes de confirmación
institucional como criterios de aceptación; medir después de integrar.

**Constraints**: Correo válido con dominio terminado en `.edu.co`; contraseña
de mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número;
invitación de 7 días; alta ordinaria TEACHER, ascenso solo solicitado por el
titular y aprobado por ADMIN diferente. Bootstrap idempotente de un ADMIN al
primer arranque, con credenciales externas y sin contraseña fija. Un rol por
cuenta, protección del último ADMIN activo, comprobación vigente y denegación
por defecto; auditoría sin caducidad
ni purga; sesión de 30 min de inactividad documentada en A CU02/D §4.

**Scale/Scope**: Piloto de aproximadamente 17 estudiantes/una docente y hasta
30 usuarios concurrentes; aquí se administran solo cuentas adultas ADMIN/TEACHER.

## Constitution Check

*GATE: cumplido antes de Phase 0; revisado de nuevo después de Phase 1.*

| Principio / restricción | Comprobación antes de investigar | Resultado tras diseño |
| --- | --- | --- |
| I. Finalidad pedagógica | Solo identidad del personal; sin diagnósticos ni perfiles cognitivos. | Cumple: respuestas excluyen datos de menores. |
| II. Protección y acceso | Servidor verifica rol/estado en cada operación; guardia falla cerrado. | Cumple: sesiones persistentes y comprobación autoritativa, incluida revocación. |
| III. Evidencia íntegra | No se alteran sesiones de tarea ni indicadores. | No aplica directamente; se distinguen de sesiones de usuario. |
| IV. Límites y contratos | Usuarios maneja cuentas; interfaz SPA y demás módulos dependen de contrato explícito. | Cumple: `contracts/accounts.openapi.yaml` y límites con autenticación/Académico. |
| V. Trazabilidad | V3 RF-001 es propuesta, A CU01-S1…S4 y DBML se contrastaron; decisiones de rol/invitación son del usuario. | Cumple: `research.md` cita originales y Better Auth; pruebas cubren fallos críticos. |
| Decisiones del responsable | `.edu.co`, contraseña mínima con tres clases, invitación 7 días, ascenso solicitado y auditado, bootstrap y retención indefinida. | Se incorporan en spec/modelo/contrato; remitente y credenciales iniciales solo en configuración segura. |

El usuario eligió expresamente este stack para la implementación, resolviendo el
conflicto entre frameworks propuestos en D y otros rótulos PUML. No se atribuye
al diseño original una aprobación tecnológica que no consta. Ninguna violación
constitucional requiere excepción.

## Project Structure

### Documentation (this feature)

```text
specs/001-gestionar-cuentas-roles/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── accounts.openapi.yaml
└── checklists/
    └── requirements.md
```

### Source Code (repository root; estructura prevista para la implementación)

```text
src/
├── app.ts                    # Hono: /api/auth/* y /api/v1/*
├── auth/
│   ├── auth.ts               # Better Auth + plugins y políticas
│   └── session-guard.ts      # Sesión real + estado y rol actual
├── db/
│   ├── schema/               # Better Auth generado + tablas propias
│   └── migrations/
└── modules/
    └── usuarios/
        ├── accounts.routes.ts
        ├── accounts.service.ts
        ├── invitations.service.ts
        ├── promotion-requests.service.ts
        └── audit.service.ts
tests/
├── contract/
├── integration/
└── unit/
```

**Structure Decision**: Un único backend modular desde la raíz; la SPA React/Vite
es consumidora externa y se coordina mediante el contrato, sin carpetas frontend
en este repositorio. Es un diseño previsto: ninguno de estos archivos fuente
existe todavía.

## Phase 0: Research

Las decisiones y fuentes están en [research.md](research.md). Puntos resueltos:
gestión con Admin plugin y roles custom, invitación propia de siete días,
solicitudes de ascenso, sesión persistida + Bearer opaco para la API; JWT/JWKS
solo como capacidad interoperable, nunca como única autorización. Reglas
`.edu.co`, contraseña y retención fueron fijadas por el responsable del proyecto;
no se atribuyen a V3.

## Phase 1: Design & Contracts

- [data-model.md](data-model.md): cuenta, invitación, sesiones, registro de gestión,
  transiciones y límites de atomicidad/recuperación.
- [contracts/accounts.openapi.yaml](contracts/accounts.openapi.yaml): rutas propias
  de negocio y errores; Better Auth se monta en `/api/auth/*` sin atribuir sus
  endpoints a V3 ni reutilizar rutas inventadas.
- [quickstart.md](quickstart.md): recorrido verificable en implementación futura,
  incluida activación, cambio de rol, inactivación y fallos.

**Post-design gate**: Cumple principios I–V. El dominio, contraseña, TTL, ascenso,
bootstrap y retención ya están definidos por el usuario. Al implementar deben
configurarse las credenciales iniciales y el proveedor de correo sin exponer
secretos, y verificarse transacciones, eventos de Better Auth y metas de
rendimiento. Si no pueden garantizarse consistencia del registro y denegación
inmediata, el gate falla y no se declara terminada esta feature.
