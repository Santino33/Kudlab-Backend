# Specification Quality Checklist: Gestionar cuentas y roles

**Purpose**: Validar integridad y calidad de la especificación antes de planificar
**Created**: 2026-10-12
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- FR-004 y FR-007 quedaron resueltos por respuesta del responsable del proyecto:
  invitación con activación por titular y un solo rol por cuenta. Se comprobaron
  de nuevo los escenarios, requisitos y criterios de éxito.
- El responsable del proyecto fijó el dominio `.edu.co`, contraseña mínima de
  ocho con mayúscula/minúscula/número, vigencia de invitación de siete días,
  ascenso por solicitud/aprobación de otro ADMIN, bootstrap inicial y retención
  indefinida. Se actualizaron historias, requisitos y criterios de éxito;
  también se protege al último ADMIN activo para conservar capacidad de aprobación.
- Proveedor/remitente de correo y credenciales del ADMIN inicial son secretos de
  despliegue, no decisiones funcionales pendientes. RF-001 V3 continúa como
  propuesta histórica, sin atribuirle estas reglas nuevas.

## Verificación de implementación (PostgreSQL 17 local, 2026-10-12)

| Criterio | Evidencia automatizada | Estado |
| --- | --- | --- |
| SC-001 | `tests/contract/accounts-create-list.test.ts`, `accounts-update-role.test.ts`, `accounts-lifecycle.test.ts` y pruebas de integración por historia | Recorridos API probados; revisión guiada pendiente |
| SC-002 | `tests/integration/auth-boundaries.test.ts`, `account-update-role.test.ts` y `accounts-lifecycle.test.ts` | Verificado en casos ensayados |
| SC-003 | `tests/integration/accounts-lifecycle.test.ts`, `account-update-role.test.ts` y sesión/JWT en `auth-boundaries.test.ts` | Verificado en casos ensayados |
| SC-004 | `tests/integration/audit-integrity.test.ts` y consultas auditadas de las tres historias | Verificado en casos ensayados |
| SC-005 | Exige prueba guiada con administradores y SPA, ausente de este repositorio | Pendiente |
| SC-006 | `tests/integration/account-invitation.test.ts` y `tests/contract/accounts-create-list.test.ts` | Verificado en casos ensayados |
| SC-007 | `tests/integration/account-update-role.test.ts` | Verificado en casos ensayados |
| SC-008 | `tests/integration/auth-boundaries.test.ts` y `audit-integrity.test.ts` | Verificado en tres arranques simulados sobre la misma base |
| SC-009 | `tests/integration/accounts-lifecycle.test.ts` y `account-update-role.test.ts` | Verificado con cambios consecutivos y concurrentes |

La medición local de 30 sesiones figura en `quickstart.md` como referencia
de diseño, no como aceptación institucional. T049 permanece abierta hasta
completar SC-005 y el recorrido guiado correspondiente.

### Prueba guiada pendiente: SC-005

**Estado: NO REALIZADA.** Las 31 pruebas automatizadas validan el backend,
pero no miden si los administradores del piloto pueden utilizar la interfaz
sin ayuda. No se dispone aquí de resultados de participantes ni de una prueba
guiada con la SPA; por tanto, no hay porcentaje de éxito ni tiempos observados
que permitan afirmar el cumplimiento de SC-005.

Para cerrar esta verificación, realizar con administradores del piloto el
recorrido de crear una cuenta válida y reconocer un error de correo duplicado.
Registrar fecha, cantidad de participantes, resultado individual de cada
intento, tiempo empleado y si requirió ayuda, sin incorporar correos ni
credenciales reales al repositorio. Comparar los resultados con el umbral de
SC-005: **al menos 90 % sin ayuda y en un máximo de 3 minutos por intento**.
Hasta disponer de esa evidencia, T049 permanece sin marcar.
