# Data Model: Correo transaccional SMTP

Diseño v1, 2026-10-23. No añade tablas, columnas ni migraciones. Referencia: [contratos](contracts/mail.md).

## Mensaje transaccional (transitorio)

| Campo | Regla |
| --- | --- |
| purpose | Uno de invitation, email-change, password-recovery |
| operationId | UUID de la invitación o verificación existente; nunca token/digest |
| to | Una dirección institucional validada del flujo emisor; no listas ni CR/LF/NUL |
| url | URL absoluta validada del propósito con token emitido por el flujo |
| from | Dirección configurada; nombre visible fijo Kudlab |
| subject/text | Generados por propósito, no proporcionados por el solicitante |

No admite cc, bcc, adjuntos ni encabezados arbitrarios. El transportador no emite, renueva, consume ni almacena verificaciones.

## Configuración del proveedor (privada)

MAIL_MODE, MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD y MAIL_FROM conservan sus nombres. MAIL_MODE predeterminado smtp; capture solo NODE_ENV=test. SMTP exige host DNS y usuario no vacíos tras comprobar espacios, contraseña no vacía sin modificar su valor, puerto entero 1–65535 y dirección remitente única válida. Rechazar controles en valores destinados a encabezados.

INVITATION_BASE_URL, nueva EMAIL_CHANGE_BASE_URL y RESET_BASE_URL identifican destinos SPA. Validar origen y protocolo como indica el contrato. Ningún valor secreto se imprime al fallar configuración.

## Resultado de intento (transitorio)

| Resultado | Evidencia | Efecto |
| --- | --- | --- |
| accepted | Confirmación final y destinatario en accepted | Se puede informar aceptación del proveedor |
| rejected | Rechazo SMTP explícito o no aceptación comprobada antes del mensaje | Informar fallo confirmado donde el flujo lo permita |
| unknown | Información inconsistente o falta de confirmación sin prueba de fallo previo | No afirmar entrega ni fallo definitivo; no reintentar |

Categorías diagnósticas cerradas: validation, configuration, dns, connection, tls, auth, recipient, message, timeout, network, inconsistent, persistence. No inferir etapa previa solo por código CONN. Resultado no se serializa al público en recuperación.

## Diagnóstico operativo

Campos permitidos: event fijo mail_attempt, occurredAt ISO, operationId, purpose, outcome y category opcional. Solo agregar responseCode numérico validado si es útil; no texto bruto del proveedor. No direcciones, enlaces, tokens, contraseñas, digest ni cuerpo. Lo lee operación autorizada desde logs del despliegue, no mediante rutas HTTP. No se introduce política de conservación nueva.

## Relaciones y estados persistentes existentes

- Cuenta 1:N invitaciones; invitación conserva destinatario, digest, fechas y estado de entrega. Estado de cuenta y entrega son independientes.
- Cuenta 1:N verificaciones de cambio de correo y recuperación; se reutiliza su ID para correlación, sin columnas de entrega nuevas.
- Cambiar `requestRecovery` internamente para conservar el ID retornado por la inserción; no exponerlo al solicitante.

Transiciones de entrega de una nueva invitación:

```text
PENDIENTE -> ENVIADA  (accepted y actualización local exitosa)
PENDIENTE -> ERROR    (rejected y actualización local exitosa)
PENDIENTE -> PENDIENTE (unknown o actualización fallida)
```

`ENVIADA` significa aceptación, no lectura ni recepción final. `PENDIENTE` es ausencia de estado local definitivo, no prueba de que no hubo transmisión. Un nuevo envío explícito emite una nueva verificación según el flujo existente; nunca reutiliza la anterior para un reintento automático. Un fallo de diagnóstico no debe reenviar ni convertir accepted en rejected.

No se alteran vigencias, invalidación, activación de cuenta, correo confirmado ni sesiones. Las operaciones funcionales se confirman antes de transportar correo y no se revierten por una incertidumbre de red.
