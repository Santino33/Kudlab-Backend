# Research: Correo transaccional SMTP

**Fecha**: 2026-10-23. **Estado**: decisiones técnicas propuestas para esta feature; incógnitas técnicas resueltas. La selección de proveedor y credenciales es configuración de despliegue, no una dependencia de diseño pendiente.

## 1. Reutilizar implementación y dependencias

- **Decision**: Conservar Nodemailer 10.1.0; crear un módulo compartido pequeño en Usuarios. No cambiar autenticación, esquema ni dependencias.
- **Rationale**: `invitations.mailer.ts` ya transporta los tres flujos, pero solo distingue el asunto de recuperación. Los emisores ya generan verificaciones y envían después de su transacción. `package.json` ya incluye smtp-server y Vitest.
- **Alternatives considered**: SDK específico, cola/outbox, nuevas tablas o framework de notificaciones: añaden alcance sin satisfacer requisitos adicionales.

## 2. TLS obligatorio y verificable

- **Decision**: `secure: true` en puerto 465; en otros puertos `secure: false, requireTLS: true`. Verificación de certificado activa, TLS mínimo 1.2, sin `ignoreTLS`, modo oportunista ni `rejectUnauthorized: false`. Host de despliegue debe ser nombre DNS del certificado. Para CA privada de pruebas usar confianza explícita del proceso.
- **Rationale**: `secure: false` por sí solo no exige STARTTLS. La configuración actual puede enviar sin cifrar. Esta garantía cubre el salto al proveedor, no toda la ruta hasta el destinatario.
- **Alternatives considered**: Bandera para desactivar TLS o excepciones para localhost: rechazadas, las pruebas deben comprobar la política real.
- **Source**: https://nodemailer.com/smtp#tls-options

## 3. Clasificación conservadora de resultados

- **Decision**: Aceptar solo promesa resuelta y destinatario único en `accepted`, sin evidencia contradictoria. Respuestas negativas pertinentes 4xx/5xx o rechazo explícito del destinatario representan fallo confirmado. Fallos comprobablemente anteriores a enviar (validación, DNS inicial, auth, TLS) se clasifican `rejected` con categoría técnica: aquí significa intento no aceptado, no necesariamente rechazo del buzón. Errores de red sin prueba de etapa, especialmente tras DATA, son `unknown`.
- **Rationale**: `354` no acepta el mensaje; es necesaria confirmación final positiva. `command: CONN` y un timeout no prueban que aún no se transmitió. `messageId` tampoco demuestra entrega. No depender de `err.permanent`, ausente en el código consultado de 10.1.0 pese a documentación actual.
- **Alternatives considered**: Tratar toda excepción como rechazo (comportamiento actual), o todo éxito de conexión como entrega: producen afirmaciones falsas. No instrumentar un parser SMTP propio; si falta evidencia, conservar incertidumbre.
- **Sources**: https://nodemailer.com/#response-object ; https://nodemailer.com/errors ; https://www.rfc-editor.org/rfc/rfc5321.html#section-4.2.5 ; https://unpkg.com/nodemailer@10.1.0/dist/esm/smtp-connection/index.js

## 4. Esperas y ausencia de reintentos

- **Decision**: SMTP directo no pooled; un `sendMail` por intento. Timeouts DNS/conexión/saludo de 30 s, inactividad de socket de 600 s. Sin Promise.race ni reenvío después de unknown. Mantener sincronía HTTP existente y documentar sus límites operativos.
- **Rationale**: Acortar espera final puede generar incertidumbre y duplicados. El RFC recomienda hasta diez minutos de espera por la confirmación final. La meta de recepción normal <60 s no obliga a inventar un deadline total durante fallos.
- **Alternatives considered**: Pool con reencolado, timeout global sin cancelación o cola persistente: innecesarios o incompatibles con ausencia de reintentos/alcance.
- **Sources**: https://nodemailer.com/smtp#connection-options ; https://nodemailer.com/smtp/pooled#transport-options ; https://www.rfc-editor.org/rfc/rfc5321.html#section-4.5.3.2.6

## 5. Compatibilidad y persistencia

- **Decision**: Conservar `PENDIENTE/ENVIADA/ERROR`. En invitaciones unknown deja `PENDIENTE`, responde `503 DELIVERY_STATUS_UNKNOWN` y registra categoría privada; fallo confirmado marca `ERROR`; aceptación marca `ENVIADA`. No añadir estado público. Error al guardar después de aceptación conserva la distinción ya existente de resultado desconocido. Cambio de correo usa los mismos dos códigos; recuperación conserva `202` neutro.
- **Rationale**: El esquema y clientes ya consumen tres estados y el código unknown existe. `PENDIENTE` no demuestra que no se haya enviado: documentar esa limitación, no prometer consultas posteriores con certeza.
- **Alternatives considered**: Cuarto estado con migración o tabla de intentos: no requerido; logs permiten diagnóstico sin persistir cuerpos o enlaces.
- **Evidence**: `src/modules/usuarios/invitations/invitations.service.ts`, `accounts/accounts.service.ts`, `email-changes/email-changes.service.ts`, `recovery/recovery.service.ts`, `src/db/schema/accounts.ts`.

## 6. Mensajes y destino público de acciones

- **Decision**: Propósitos cerrados `invitation/email-change/password-recovery`, texto español y remitente visible Kudlab. Mantener INVITATION_BASE_URL y RESET_BASE_URL, agregar EMAIL_CHANGE_BASE_URL obligatoria; las tres deben ser HTTPS (HTTP solo loopback local), del origen SPA y sin credenciales/query/hash. URLs de invitación y cambio deben ser distintas para evitar que un token se abra en la pantalla equivocada.
- **Rationale**: Cambio de correo usa hoy la URL de invitación y asunto genérico; no se debe presuponer que una pantalla de activación comprende otro tipo de token. Se explicita la dependencia del cliente, sin construir pantallas aquí.
- **Alternatives considered**: Reutilizar URL sin discriminador o inventar automáticamente una ruta SPA: ocultaría una integración inexistente. Una URL configurada permite utilizar la pantalla que el operador y cliente acuerden.
- **Impact**: Actualización obligatoria de configuración de despliegue y tests; consumidor SPA debe enrutar cada enlace al flujo indicado en contracts/mail.md. No cambiar TTL ni autorización.

## 7. Diagnóstico mínimo y pruebas

- **Decision**: Desactivar logger/debug/transactionLog del transporte; emitir un evento JSON propio con referencia interna, propósito, fecha, resultado y categoría normalizada. Sin dirección, configuración, cuerpo, URL, token, error completo, `response` ni `message` original. Usar stdout/stderr capturado por operador con acceso restringido. No crear API de logs ni política nueva de retención.
- **Rationale**: Debug puede registrar el cuerpo y transactionLog puede revelar destinatarios. Las pruebas deben introducir secretos centinela para demostrar que no se filtran. Captura permite contenido completo únicamente en pruebas ficticias.
- **Alternatives considered**: Serializar error/info o activar logs SMTP: riesgo de filtración. Registrar diagnóstico en auditoría funcional de cuentas: mezcla responsabilidades.
- **Sources**: https://nodemailer.com/smtp#debug-options ; pruebas actuales `tests/integration/account-invitation.test.ts`, `tests/helpers.ts`, `tests/setup.ts`.

## Limitaciones y revisión

No se consultó documentación Better Auth porque no se cambia su integración. Los originales institucionales citados por contexto no están disponibles; no se adopta ninguna regla nueva desde esos resúmenes. Metas humanas y de recepción necesitan ensayo posterior; investigación no equivale a verificación ejecutada ni aprobación del responsable.
