# Contracts: Correo transaccional SMTP

Contrato propuesto v1, 2026-10-23. Consumidores: servicios de invitación, cambio de correo y recuperación; tests existentes; operador de despliegue y SPA receptora de enlaces. No implementado aún.

## 1. Configuración externa

| Ajuste | Contrato |
| --- | --- |
| MAIL_MODE | smtp predeterminado; capture solo con NODE_ENV=test |
| MAIL_HOST | Nombre DNS no vacío que coincida con certificado del proveedor |
| MAIL_PORT | Entero 1–65535, predeterminado 587; 465 usa TLS implícito, otros requieren STARTTLS |
| MAIL_USER / MAIL_PASSWORD | Credenciales obligatorias en smtp; privadas y nunca reflejadas en errores |
| MAIL_FROM | Una dirección válida, no una lista; nombre visible generado Kudlab |
| INVITATION_BASE_URL | Destino de activación SPA |
| EMAIL_CHANGE_BASE_URL | Nuevo ajuste obligatorio: destino de confirmación de cambio de correo SPA |
| RESET_BASE_URL | Destino de recuperación SPA |

Las tres URLs deben pertenecer al origen SPA, usar HTTPS salvo localhost/127.0.0.1 por HTTP local, no incluir usuario, contraseña, query ni fragmento. Invitación y cambio de correo no pueden compartir URL. El emisor añade solo su token mediante URL.searchParams. Errores de configuración exponen nombre del ajuste y motivo fijo, nunca valor. Validar antes de bootstrap y de empezar a escuchar. No verificar disponibilidad del proveedor como requisito de arranque: una caída no debe bloquear todas las funciones de cuentas.

**Migración de despliegue**: definir EMAIL_CHANGE_BASE_URL y revisar URLs anteriores y certificado antes de publicar. Esta validación es más estricta que la actual y no es una migración silenciosa. La SPA debe disponer de pantallas que remitan respectivamente a aceptación de invitación, confirmación de correo y confirmación de recuperación. No se entrega frontend en esta feature.

## 2. Interfaz interna

Operación conceptual `sendTransactionalMail({ purpose, operationId, to, url }) -> Promise<MailOutcome>` con tres resultados cerrados: accepted, rejected, unknown. Los fallos esperados de transporte se convierten en resultado; los detalles del proveedor nunca llegan al cliente HTTP. Emisor valida autorización y elegibilidad, crea la verificación, confirma su transacción, construye el enlace y llama una vez. El módulo genera asunto/texto y emite diagnóstico redactado. No admite envío con asunto/cuerpo/destinatarios libres desde HTTP.

Captura conserva al menos `to` y `url` para compatibilidad con tests, y añade purpose, subject, text y operationId para verificar contenido. Usa el mismo generador de mensaje que smtp y simula accepted sin red. Su almacén se limpia entre casos.

| Propósito | Destinatario | Asunto fijo | Acción del enlace |
| --- | --- | --- | --- |
| invitation | Correo de la invitación | Activa tu cuenta de Kudlab | POST /api/v1/account-invitations/accept |
| email-change | Nuevo correo pendiente | Confirma tu cambio de correo en Kudlab | POST /api/v1/account-email-changes/confirm |
| password-recovery | Correo vigente de cuenta apta | Recupera tu acceso a Kudlab | POST /api/v1/auth/password-recovery/confirm |

El enlace abre la SPA, no ejecuta una operación de cambio por GET. Cada cuerpo explica la acción, muestra enlace y advierte ignorar solicitudes no reconocidas. Texto UTF-8 sin dependencia de imágenes. No incluir datos académicos ni contraseñas.

## 3. Transporte y resultados

TLS mínimo 1.2 y certificado validado. Un destinatario de sobre igual a `to`, sin cc/bcc, remitente configurado. Desactivar pooling y logs del transporte; no habilitar accesos a archivos/URLs para composición. Deshabilitar esas lecturas mediante opciones de seguridad de Nodemailer como defensa adicional. Sin reintentos propios ni del pool.

Accepted exige promesa resuelta, destinatario esperado aceptado y ausencia de evidencia contradictoria. Rejected exige negativa SMTP pertinente o fallo comprobablemente previo al envío. Si no puede probarse la etapa del error, devolver unknown. Nunca usar err.message, command=CONN o messageId como prueba de aceptación/rechazo. Configurar timeouts como plan.md; no inventar un deadline total con trabajo aún en curso.

## 4. Compatibilidad HTTP

No agregar rutas ni cambiar payloads de entrada existentes.

| Operación | Resultado de correo | Respuesta / persistencia |
| --- | --- | --- |
| POST /api/v1/accounts (ADMIN activo) | accepted | 201, cuenta pendiente, deliveryStatus ENVIADA si registro local exitoso |
| PATCH /api/v1/accounts/:id (ADMIN activo), nueva invitación de cuenta pendiente | accepted | 200, misma semántica de entrega de invitación |
| Las dos anteriores | rejected | 503 DELIVERY_FAILED; invitación ERROR si se logra registrar |
| Las dos anteriores | unknown o fallo de guardar resultado | 503 DELIVERY_STATUS_UNKNOWN; no afirmar entrega o rechazo; conservar PENDIENTE cuando no hubo actualización |
| PATCH /api/v1/accounts/:id, cambio de correo de cuenta activa | accepted | 200; conserva correo vigente y pendingEmail hasta confirmar |
| La anterior | rejected / unknown | 503 DELIVERY_FAILED / DELIVERY_STATUS_UNKNOWN; no confirmar correo ni deshacer cambios ya comprometidos |
| POST /api/v1/auth/password-recovery/request | Cualquiera, correo desconocido o cuenta no apta | 202, mismo cuerpo neutro, sin códigos/IDs de envío |

Cuerpo de error existente: `{ "code": "DELIVERY_FAILED o DELIVERY_STATUS_UNKNOWN", "message": "aviso comprensible fijo" }`; el valor de code es uno de los dos, no la frase literal. Para recuperación conservar exactamente `{ "message": "Si corresponde, recibirás instrucciones en tu correo." }`. La neutralidad cubre contenido/estado; este cambio no garantiza indistinguibilidad temporal de solicitudes síncronas y no debe afirmar que lo hace.

`deliveryStatus` mantiene PENDIENTE, ENVIADA y ERROR; PENDIENTE puede representar resultado incierto. Tras un 503 de alta, consultar la cuenta por los mecanismos existentes antes de crear otra; no implementar reintento ciego del POST. La API no retorna el token, contenido de correo ni diagnóstico privado.

## 5. Pruebas del contrato

- Tres contenidos y destinatarios correctos, sin mezcla de acciones, con caracteres válidos preservados y controles rechazados.
- STARTTLS/465 con CA válida; servidor sin STARTTLS, certificado no confiable o nombre incorrecto rechazados sin degradación.
- Rechazo RCPT/DATA, timeout/desconexión sin confirmación y datos accepted/rejected inconsistentes clasificados conservadoramente.
- Fallo de persistencia después de aceptación no cambia a ERROR ni provoca reenvío.
- Recuperación para los cuatro estados de cuenta conserva cuerpo/202 y emite diagnóstico privado solo cuando existe intento.
- Espiar transporte y registrar un solo intento; capturar logs para excluir secretos centinela y contenido bruto.
