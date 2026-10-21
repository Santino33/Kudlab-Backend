# Feature Specification: Refactorizar servicios de usuarios

**Feature Branch**: `refactor-servicios-usuarios`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "En esta nueva iteracion vamos a hacer un trabajo de refactorizacion sobre los servicios del modulo de usuarios para mejorar su legibilidad, pues las funciones son dificiles de leer por la cantidad de verificaciones que hace cada funcion, tambien quiero mejorar la organizacion de archivos del modulo porque esta el modulo de usuarios pero tiene ahi mismo todos los archivos lo que hace mas dificil entender como se organiza ese modulo. Para eso create otra rama y vamos a trabajar sobre esa nueva rama"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Comprender las operaciones de usuarios (Priority: P1)

Como persona que mantiene el módulo de usuarios, quiero seguir el flujo principal de cada operación sin perderme entre verificaciones, para revisar cambios con menos esfuerzo y sin omitir controles.

**Why this priority**: La dificultad de lectura de los servicios es el motivo principal de la iteración; aclararlos no debe debilitar las verificaciones existentes.

**Independent Test**: Una persona que no haya trabajado recientemente en el módulo identifica el flujo, las comprobaciones y el resultado de una operación de cuenta y de una operación de recuperación; se comprueba que ambos recorridos conservan sus resultados para entradas válidas e inválidas.

**Acceptance Scenarios**:

1. **Given** una operación válida de gestión de cuenta, **When** se ejecuta después de la reorganización, **Then** produce el mismo resultado visible y conserva la constancia de la acción que antes.
2. **Given** una entrada inválida, una cuenta en estado incompatible o una persona sin permiso, **When** intenta una operación de usuarios, **Then** se mantienen el rechazo, los datos anteriores y la ausencia de información protegida en la respuesta.
3. **Given** una operación que requiere varias comprobaciones, **When** una persona revisa su flujo, **Then** puede identificar en qué momento se valida, se autoriza y se confirma o rechaza el cambio sin seguir comprobaciones repetidas o dispersas.

---

### User Story 2 - Encontrar cada responsabilidad del módulo (Priority: P2)

Como persona que incorpora o mantiene funcionalidades de usuarios, quiero ubicar rápidamente cada operación y sus reglas relacionadas, para modificar el área adecuada sin tener que recorrer todos los archivos del módulo.

**Why this priority**: La concentración actual de archivos dificulta entender dónde está cada responsabilidad.

**Independent Test**: Una persona nueva localiza las operaciones de invitación, cambio de correo, recuperación y administración de cuentas y reconoce sus controles relacionados sin consultar a quien realizó la reorganización.

**Acceptance Scenarios**:

1. **Given** una solicitud de cambio de un flujo de usuarios, **When** se busca la responsabilidad correspondiente, **Then** se encuentra agrupada de forma reconocible con las piezas que colaboran en ese flujo.
2. **Given** un consumidor existente del módulo, **When** utiliza una operación tras la reorganización, **Then** sigue obteniendo los mismos resultados, errores y permisos sin cambios en su interacción observable.

### Edge Cases

- Un fallo durante una modificación de cuenta no debe dejar un estado parcial ni omitir la constancia que antes se registraba.
- Solicitudes concurrentes sobre una misma cuenta deben seguir respetando las restricciones anteriores; la reorganización no debe permitir duplicados ni cambios contradictorios.
- Los accesos con cuenta inactiva, rol insuficiente, sesión no válida o verificación fallida deben seguir denegándose sin revelar datos de otras personas.
- Los mensajes y resultados de invitaciones, cambios de correo y recuperación no deben revelar la existencia de cuentas cuando antes no lo hacían.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El módulo DEBE conservar los resultados, errores y efectos observables de sus operaciones actuales de cuentas, invitaciones, cambios de correo, solicitudes de ascenso, ciclo de vida y recuperación para los mismos datos y estados iniciales.
- **FR-002**: Cada operación DEBE conservar sus verificaciones actuales de identidad, rol, estado y ámbito antes de entregar información o modificar una cuenta; si una comprobación falla o no puede completarse, DEBE mantener el rechazo sin exponer datos protegidos.
- **FR-003**: Las modificaciones DEBEN conservar la integridad de los cambios y su trazabilidad: un rechazo o fallo no debe confirmar cambios parciales, y una operación exitosa debe mantener la constancia que ya generaba.
- **FR-004**: Las responsabilidades del módulo DEBEN quedar agrupadas por flujo o propósito identificable, de modo que se puedan localizar las operaciones y sus reglas relacionadas sin recorrer todos los elementos del módulo.
- **FR-005**: Los flujos de los servicios DEBEN permitir distinguir la acción principal de sus comprobaciones y reconocer qué ocurre cuando cada una falla, sin eliminar controles ni cambiar el orden de las garantías que afectan el resultado.
- **FR-006**: Los consumidores existentes del módulo DEBEN continuar funcionando después de la reorganización, incluidos los recorridos de autenticación, administración y recuperación y las verificaciones de acceso.
- **FR-007**: Esta iteración NO DEBE introducir capacidades nuevas, alterar las reglas vigentes de acceso ni cambiar datos ya guardados para completar la reorganización.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de los recorridos existentes de operaciones de usuarios, tanto exitosos como rechazados, conserva resultados, permisos y efectos observables antes y después del cambio.
- **SC-002**: En una revisión guiada de al menos cuatro recorridos (cuentas, invitaciones, cambio de correo y recuperación), una persona sin participación en el refactor identifica en menos de cinco minutos por recorrido la acción principal, sus comprobaciones y su resultado.
- **SC-003**: En una prueba de localización de cuatro responsabilidades (cuentas, invitaciones, cambio de correo y recuperación), al menos el 90 % de las búsquedas se completa en menos de dos minutos sin ayuda del autor del cambio.
- **SC-004**: El 100 % de los casos revisados de acceso denegado, fallo durante un cambio y solicitudes concurrentes conserva la ausencia de acceso indebido, de cambios parciales y de pérdida de trazabilidad, respectivamente.

## Assumptions

- **Alcance**: Se reorganiza el módulo de usuarios y se aclaran sus servicios existentes. Se incluyen las referencias de sus consumidores y la verificación de recorridos afectados; no se redefine la experiencia del personal ni se añaden reglas de negocio.
- **Línea base**: El comportamiento actual del proyecto y las especificaciones `specs/001-gestionar-cuentas-roles/spec.md`, `specs/002-validar-perfil-acceso/spec.md` y `specs/003-autenticar-usuarios/spec.md` sirven para comparar las operaciones ya cubiertas. Para autorización, las reglas pendientes no se completan mediante este refactor.
- **Fuente y estado**: Esta solicitud del responsable (2026-10-20) define el objetivo de mantenibilidad para esta iteración; la estructura y el comportamiento actual se observaron en `src/modules/usuarios/` (19 elementos en su nivel principal) y `src/app.ts` al especificar. Los antecedentes de reglas de acceso están documentados en las especificaciones previas y `docs/agent-context/modules/usuarios/module-summary.md`; el RF-004 de `docs/original/requisitos_V3.xlsx`, hoja «RF corregidos», sigue siendo propuesta, no aprobación de una matriz nueva de permisos. No se fija ninguna regla funcional nueva procedente de V3.
- **Dependencias**: La comprobación de equivalencia requiere los recorridos existentes del módulo y de quienes lo consumen; los objetivos de tiempos de búsqueda y lectura son metas de esta iteración, no cifras aprobadas en los documentos originales.
