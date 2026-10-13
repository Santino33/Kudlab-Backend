# Investigación técnica: validar perfil y acceso

**Fecha**: 2026-10-12. **Fuentes funcionales contrastadas**: V3 `docs/original/requisitos_V3.xlsx`, hoja «RF corregidos» filas 3 (RF-002) y 5 (RF-004), ambas «Propuesto - corregido para validación»; hoja «Decisiones y pendientes» fila 9, D-08 propuesto. Análisis `docs/original/3 ANALISIS DEL PROYECTO.docx.pdf`, CU01-S1/S2 pp. 27–29 y CU03 p. 32. Reglas concretas de correo/contraseña, activación y gestión proceden de la decisión registrada en `specs/001-gestionar-cuentas-roles/spec.md`, no del RF-002 aprobado. **Estado técnico**: implementación de 001 disponible en `src/` y contrato `specs/001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml`; no confundir el diseño original ni el plan de 001 con el código actual.

## R-01 — Continuidad tecnológica y validación de datos

**Decision**: Reutilizar Node.js/TypeScript, Hono, Zod, PostgreSQL/Drizzle y Better Auth fijados en `package.json` (incluido Better Auth 1.7.7), junto con `accounts.validation.ts` y `auth.ts`; no crear otro proveedor de identidad ni otra política divergente. Actualizar validadores compartidos para normalizar correo completo, exigir datos efectivos y usar la misma regla de contraseña en cualquier flujo que establezca credenciales.

**Rationale**: La feature 001 implementa los recorridos reales. `createAccountSchema`, `updateAccountSchema`, `passwordSchema`, el rechazo de registro público y el hook de sesión son puntos de integración existentes. V3 RF-002 solo propone el comportamiento y no selecciona una biblioteca.

**Alternatives considered**: Segundo módulo de validación o segundo almacén de credenciales; duplicarían reglas y crearían diferencias de acceso.

## R-02 — Correos concurrentes y edición de una cuenta activa

**Decision**: Mantener como autoridad `user_accounts.email_normalized`, `pending_email_normalized`, reclamaciones de correo y las restricciones existentes; ante conflicto concurrente devolver rechazo sin cambios parciales. La misma cuenta puede conservar correo vigente; en cuenta ACTIVA, un nuevo correo se reserva y solo se sustituye tras confirmación por el titular, mientras el nombre puede actualizarse. En cuenta PENDIENTE se invalida el enlace previo y se expide otro; la cuenta INACTIVA no libera correo.

**Rationale**: Modelo y contrato de 001 (`data-model.md` y `accounts.openapi.yaml`, PATCH/confirmación), `email-changes.service.ts` y `src/db/schema/accounts.ts` reflejan el comportamiento implementado. La redacción original de US2 en 002 sugería cambio inmediato; se aclaró para evitar una contradicción verificable.

**Alternatives considered**: Cambiar el correo activo inmediatamente o comprobar unicidad solo antes de guardar: el primero contradice la verificación de titular de 001 y el segundo no resuelve carreras.

## R-03 — Errores comprensibles sin filtrar datos

**Decision**: Para administradores previamente autenticados y autorizados, responder qué campo falta, su formato incorrecto o el conflicto de correo; al aceptar invitación, comunicar al titular con enlace válido únicamente las reglas de contraseña incumplidas, sin exponer estado de otras cuentas. Limitarse a referencias de campo y mensajes sin correos ajenos, secretos, tokens ni existencia de registros de menores. Para sesión ausente, rol insuficiente, ámbito ajeno o asignación imposible de verificar, mantener mensaje genérico de denegación. Conservar los códigos HTTP y estructura `{code,message}` del contrato 001 y añadir detalles opcionales de campo únicamente en estos recorridos de validación.

**Rationale**: `src/modules/usuarios/accounts.errors.ts` devuelve actualmente `INVALID_INPUT` genérico ante Zod; eso no satisface FR-009. `src/auth/session-guard.ts` ya separa sesión inválida (401) de rol/estado (403); el filtro debe ejecutarse antes de informar errores del perfil.

**Alternatives considered**: Informar valores duplicados o existencia del objetivo a toda persona que solicite una operación; expondría datos privados. Responder siempre «solicitud inválida» impediría corregir campos autorizados.

## R-04 — Contrato entre Usuarios y Académico para ámbito

**Decision**: Separar comprobación de identidad/estado/rol (Usuarios) de la fuente autoritativa de asignaciones (Académico). Cada lector o modificador de estudiantes/grupos debe suministrar actor autenticado, operación y objetivo normalizado, obtener autorización vigente y denegar si la asignación está ausente o no es verificable. Prohibir conceder ámbito por filtro o ID suministrado por el cliente. No implementar rutas de estudiantes ni nuevas tablas en 002: documentar la interfaz interna y planificar su verificación al integrar Académico/Seguimiento.

**Rationale**: Constitución II y IV, V3 RF-004 propuesto y A CU03 p. 32 exigen control servidor; actualmente `src/app.ts` solo monta operaciones de cuentas y no existe aún un proveedor de asignaciones. Una simulación de grupo fijo en producción sería insegura.

**Alternatives considered**: Confiar en opciones de la SPA o aceptar ID de grupo en sesión; ninguno verifica responsabilidad vigente y ambos filtran datos ajenos.

## R-05 — Política de credenciales y cobertura real

**Decision**: Reutilizar la misma política para bootstrap e invitación ya disponibles; entregar el validador y un contrato de integración para cualquier futura operación autenticada de cambio o recuperación. No abrir una ruta de restablecimiento ni modificar endpoints de Better Auth bloqueados actualmente por `src/app.ts` sin especificar identidad, titularidad y recuperación en la feature de autenticación.

**Rationale**: `passwordSchema` en `accounts.validation.ts` y el hash en `auth.ts` aplican la política al crear credencial; el contrato de 001 expone aceptación de invitación y el arranque inicial, no cambio/restablecimiento. FR-005 exige coherencia cuando existan dichos flujos, no habilitar un restablecimiento público sin controles definidos.

**Alternatives considered**: Activar sin más endpoints nativos de reset/change; podrían eludir las restricciones de invitación o la comprobación de cuenta activa.

## R-06 — Pruebas, límites y calidad

**Decision**: Usar Vitest + PostgreSQL como en 001; repetir concurrencia/rollback y contratos de 001 tras cambios. Medir referencia documental de ≤2 s p95 y 30 sesiones solo como observación, no como condición institucional aprobada; SC-005 requiere estudio con administradores y la SPA. Distinguir explícitamente pruebas automatizables de FR-007/SC-003, que precisan fuente real de asignaciones y un consumidor de estudiantes.

**Rationale**: `tests/integration/accounts-convergence.test.ts`, `tests/integration/auth-boundaries.test.ts` y `tests/contract/accounts-openapi.test.ts` ya demuestran patrones; constitución V exige pruebas de autorización y contratos. `spec.md` no adoptó los objetivos documentales de A §3.2 pp. 16–18.

**Alternatives considered**: Declarar aprobado el ámbito de estudiantes con mocks o la usabilidad humana con pruebas de backend: no acreditan resultados de la feature.

## Comparación técnica previa a implementar (T002)

- `src/db/schema/accounts.ts` ya exige un rol entre `ADMIN`/`TEACHER`, estado `PENDIENTE`/`ACTIVA`/`INACTIVA`, correo normalizado `.edu.co`, unicidad del correo vigente y reserva de correo pendiente. Las reclamaciones concurrentes también se coordinan en `src/modules/usuarios/email-changes.service.ts`; no se requiere una migración nueva para RF-002.
- `src/modules/usuarios/accounts.validation.ts` ya rechaza nombre vacío o de solo espacios, obliga `TEACHER`, verifica correo institucional y contraseña de 8–128 caracteres con las tres clases. El máximo 128 es una restricción operativa de 001/Better Auth, no modifica el mínimo funcional acordado.
- `specs/001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml` define los mismos paths y cuerpo básico que `contracts/validation.openapi.yaml`; la ampliación de 002 es `fields: [{field,reason}]` opcional para errores autorizados. `src/modules/usuarios/accounts.errors.ts` devuelve por ahora `INVALID_INPUT` genérico, por lo que ese detalle aún falta para la SPA.
- `src/modules/usuarios/invitations.service.ts` valida la contraseña antes de comprobar vigencia del token; 002 requiere que un token inválido no obtenga pistas de política y que una invitación válida no se consuma por contraseña incorrecta. Consumidores afectados: SPA de alta/edición/aceptación y suites HTTP de 001; no hay todavía consumidores Académico/Seguimiento implementados.
