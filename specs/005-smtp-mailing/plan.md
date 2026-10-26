# Implementation Plan: Correo transaccional SMTP

**Branch**: `feat/configure-smtp` | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: `specs/005-smtp-mailing/spec.md`, propuesta v1 solicitada para planificación.

**Estado**: Diseño de fases 0–1; no implementado. No ratifica metas propuestas ni fuentes institucionales ausentes. El setup devuelve `BRANCH=005-smtp-mailing` como identificador lógico del directorio; Git sigue en `feat/configure-smtp`.

**Confirmación T001 — 2026-10-25**: El responsable confirmó explícitamente «Confirmo alcance y metas»: tres propósitos, Gmail como proveedor, TLS obligatorio, EMAIL_CHANGE_BASE_URL separada, ensayo de 15 mensajes <60 s y comprensión por 4/5 adultos. La aprobación cubre esta feature, no ratifica originales ausentes ni autoriza aún envíos externos. Se mantiene la guía paso a paso en cada intervención y un commit por fase.

## Summary

Fortalecer el envío existente de invitaciones, cambio de correo y recuperación con Nodemailer: TLS obligatorio, contenido específico por acción, resultados conservadores y diagnósticos redactados. Reutilizar PostgreSQL y los contratos HTTP existentes. No añadir tablas, colas, endpoints de correo ni dependencias. Los emisores conservan autorización, generación de enlaces y ciclo de vida de sus verificaciones.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node.js 24, ESM.

**Primary Dependencies**: Nodemailer 10.1.0, Zod 4.3.6, Hono 4.13.13; Drizzle 0.45.4 y Better Auth 1.7.7 sin cambios de mecanismo.

**Storage**: PostgreSQL existente, sin migraciones. Mensajes en memoria durante el intento; diagnóstico mínimo en salida estructurada privada, sin copia del cuerpo.

**Testing**: Vitest 5.0.4 y smtp-server 3.19.21 existentes; unitarias, contratos e integración. PostgreSQL aislado para recorridos de cuentas. CA y certificados ficticios para SMTP cifrado.

**Target Platform**: Servicio Node.js en Linux con salida al proveedor SMTP.

**Project Type**: Backend web existente, sin frontend en este repositorio.

**Performance Goals**: SC-001 propone 15/15 mensajes recibidos y al menos 95 % en <60 s; con 15 muestras exige 15/15 bajo ese plazo. Medición en buzones controlados. SC-006 propone comprensión de los tres mensajes por 4/5 personas. No se infiere recepción de la aceptación SMTP.

**Constraints**: TLS con certificado válido, captura solo en pruebas, sin reenvío automático, sin transporte dentro de transacciones SQL. Timeouts explícitos: DNS 30 s, conexión 30 s, saludo 30 s, socket 600 s; este último mide inactividad y evita acortar arbitrariamente la espera final de DATA. No son un plazo total ni una promesa de respuesta HTTP rápida durante fallos. Un deadline corto requeriría otro alcance, no un Promise.race que deje el envío activo.

**Scale/Scope**: Tres mensajes transaccionales del personal; sin campañas, adjuntos, lectura o rebotes. No se extrapolan cifras institucionales de concurrencia al correo.

## Constitution Check

| Gate | Antes de fase 0 | Después de fase 1 |
| --- | --- | --- |
| I. Finalidad pedagógica | PASS: solo acceso del personal | PASS: sin información pedagógica o diagnósticos |
| II. Protección y acceso | PASS: autorización del flujo emisor | PASS: TLS, minimización, captura ficticia, logs privados |
| III. Evidencia íntegra | PASS: no afecta sesiones de tareas | PASS: sin cambios de evidencia, cálculo o consentimiento |
| IV. Límites y contratos | PASS: dentro de Usuarios | PASS: contrato de envío/configuración y consumidores documentados |
| V. Trazabilidad y verificación | PASS: spec v1 y código observado, no RF deducidos de resúmenes | PASS: fuentes, limitación documental y verificaciones explícitas |

No se requiere excepción. Este diseño conserva políticas existentes, no aprueba propuestas históricas de stack. La ausencia de originales queda registrada en spec; si se pretende cambiar una política de dominio basada en ellos, detener ese cambio y solicitar fuentes/decisión. Antes de implementar, revisar con el responsable alcance, nueva configuración y metas propuestas; no se afirma aprobación por generar artefactos.

## Project Structure

### Documentation (this feature)

```text
specs/005-smtp-mailing/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/mail.md
└── checklists/requirements.md
```

`tasks.md` corresponde al siguiente comando y no se genera aquí.

### Source Code (repository root)

```text
src/
├── config/env.ts
├── index.ts
└── modules/usuarios/
    ├── shared/transactional-mail.ts       # Nuevo módulo compartido pequeño
    ├── invitations/invitations.mailer.ts # Compatibilidad de captura, si hace falta
    ├── invitations/invitations.service.ts
    ├── email-changes/email-changes.service.ts
    └── recovery/recovery.service.ts
tests/
├── unit/
├── contract/
├── integration/
└── fixtures/smtp/                       # Certificados solo para pruebas
.env.example
README.md
```

**Structure Decision**: Centralizar mensajes/transporte/resultados en un módulo de Usuarios, sin jerarquía de proveedores ni repositorios. Migrar los tres consumidores juntos. Mantener la exportación de captura usada por tests mediante adaptación o reexportación, no un segundo transporte.

## Delivery Sequence & Verification

1. Validar configuración antes de bootstrap/serve con errores redactados; incorporar `EMAIL_CHANGE_BASE_URL` para separar acciones y documentar migración de configuración.
2. Crear mensajes de texto específicos, transporte TLS estricto, resultados conservadores y diagnóstico por lista permitida.
3. Integrar emisores después del commit SQL y mapear al contrato existente; recuperación siempre neutra. Usar IDs de verificaciones como referencias privadas.
4. Añadir unitarias de configuración/contenido/clasificación/redacción y contratos de respuestas. Actualizar el test actual que deshabilita STARTTLS y espera éxito: con la nueva política debe fallar o usar el servidor TLS de pruebas.
5. Probar STARTTLS e implícito, CA no confiable, rechazo y desconexión tras DATA, persistencia fallida, ausencia de reintentos y regresiones de permisos/verificaciones.
6. Ejecutar validación real y humana según quickstart. No declarar SC-001/006 cumplidos solo con automatización.

**Trazabilidad**: FR-001/003/004 → tres emisores; FR-002/014 → contenido/entradas; FR-005/006/011 → configuración/TLS/captura; FR-007–010/012 → resultados, logs y neutralidad; FR-013 → guía operativa. SC-001/006 → ensayo manual; SC-002–005 → pruebas automatizadas más revisión de diagnósticos.

## Complexity Tracking

Sin violaciones ni excepciones. Se descartan tablas de envío, colas y SDK de proveedor por innecesarios para este alcance.
