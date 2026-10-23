# Flujos de Usuarios existentes más allá de las cuatro fichas RF

**Implementación observada**, no nuevos requisitos añadidos por esta revisión. Estos recorridos refinan identidad/cuentas de profesores; no existen cuentas de estudiante. El [inventario del refactor](../../../../../specs/004-refactor-servicios-usuarios/contracts/current-interfaces.md) enlaza contratos y consumidores. Revisar código/pruebas antes de cambiar TTL, políticas o respuestas.

| Flujo | Entrada/capacidad actual | Código y verificación |
| --- | --- | --- |
| Invitación | Alta pendiente TEACHER y `POST /api/v1/account-invitations/accept`; token válido y contraseña para habilitar identidad | [invitations](../../../../../src/modules/usuarios/invitations/), [pruebas](../../../../../tests/integration/account-invitation.test.ts). Probar expiración, consumo único/reenvío, SMTP fallido y consistencia cuenta/identidad. |
| Ascenso a ADMIN | Profesor solicita en `/api/v1/admin-role-requests`; decisión en `/:id/approve` o `/:id/reject` según permisos | [promotion-requests](../../../../../src/modules/usuarios/promotion-requests/), [pruebas de rol](../../../../../tests/integration/account-update-role.test.ts). No autoaprobar ni habilitar un cambio genérico a ADMIN. |
| Cambio de correo | Edición inicia cambio; `POST /api/v1/account-email-changes/confirm` confirma token | [email-changes](../../../../../src/modules/usuarios/email-changes/), [convergencia](../../../../../tests/integration/accounts-convergence.test.ts). Probar correo ya reservado, token vencido/repetido, actor revocado y sincronía con identidad. |
| Recuperación | `POST /api/v1/auth/password-recovery/request` devuelve respuesta neutra 202 para correo de formato válido; `/confirm` consume token y nueva contraseña | [recovery](../../../../../src/modules/usuarios/recovery/), [contrato/pruebas](../../../../../tests/contract/password-recovery.test.ts), [integración](../../../../../tests/integration/password-recovery.test.ts). No revelar existencia de cuenta; verificar vencimiento, consumo único y revocación. |
| Bootstrap y ciclo de vida | Arranque del primer ADMIN solo sin cuentas; inactivar/reactivar con confirmación | [bootstrap](../../../../../src/scripts/bootstrap-admin.ts), [lifecycle](../../../../../src/modules/usuarios/accounts/lifecycle.service.ts), [pruebas](../../../../../tests/integration/accounts-lifecycle.test.ts). Preservar historia e invariantes administrativos. |

## Correo y configuración

Adaptador existente en [invitations.mailer.ts](../../../../../src/modules/usuarios/invitations/invitations.mailer.ts); variables en [.env.example](../../../../../.env.example) y [README](../../../../../README.md). SMTP no demuestra entrega real por estar configurado: las pruebas capturadas son distintas de envíos a un buzón. No ejecutar envíos reales, cambiar DNS ni publicar credenciales como efecto de una revisión documental.

La feature de configuración SMTP tiene un worktree separado: esta actualización no declara sus pruebas realizadas ni incorpora cambios de ese trabajo paralelo.
