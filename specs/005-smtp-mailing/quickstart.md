# Quickstart: Validación de correo SMTP

Guía de validación del diseño, no evidencia de ejecución. Los tests nuevos y EMAIL_CHANGE_BASE_URL estarán disponibles después de implementar. Contratos: [mail.md](contracts/mail.md); estados: [data-model.md](data-model.md).

## Prerrequisitos

- Node.js 24 y npm; PostgreSQL aislado, migrado y sin datos reales. Los helpers truncan tablas: nunca apuntar pruebas a producción.
- Para aceptación externa: proveedor con DNS/certificado válido, remitente autorizado y buzones exclusivamente controlados del personal de prueba. No usar menores ni datos académicos.
- SPA con las tres pantallas de acción acordadas; si no existe, se puede validar el transporte y confirmar mediante las rutas existentes, pero no declarar el recorrido completo de usuario aprobado.

## Preparación

Desde la raíz del worktree:

```bash
npm ci
cp .env.example .env
```

No sobrescribir un `.env` existente: omitir la copia si ya está preparado. Editar localmente DATABASE_URL, secretos y bootstrap con valores ficticios. Definir el origen SPA y tres URLs según el contrato; tras implementar, incluir EMAIL_CHANGE_BASE_URL. No pegar credenciales en comandos guardados, capturas o Git.

```bash
npm run db:migrate
npm run typecheck
npm test -- tests/unit
npm test -- tests/contract
npm test -- tests/integration
```

Inyectar DATABASE_URL de la base aislada en el proceso de pruebas: Vitest no carga automáticamente el `.env` de npm start. `tests/setup.ts` utiliza por defecto `127.0.0.1:55432/kudlab_test` y activa capture. Las migraciones sí cargan `.env`: comprobar que ambas operaciones apuntan a la misma base aislada. La feature no requiere migraciones nuevas.

## Matriz automatizada esperada

1. **Contenido/captura**: crear invitación, activar una cuenta ficticia, solicitar cambio de correo y recuperación usando helpers existentes. Inspeccionar captura: propósito, destinatario, asunto, cuerpo y enlace correctos, una entrada por intento. No enviar externamente.
2. **Configuración**: campos ausentes, blancos, puerto inválido, URLs ajenas al origen y controles producen errores redactados; capture fuera de test impide arranque antes de bootstrap/listen. Nunca imprimir el objeto de configuración.
3. **SMTP cifrado local**: servidor de pruebas smtp-server con CA/certificado ficticios para localhost; confiar solo esa CA en el proceso de test mediante NODE_EXTRA_CA_CERTS si se usa proceso hijo. Probar STARTTLS y TLS implícito sin desactivar verificación. Preparar archivos/certificados en tests/fixtures/smtp durante implementación; no usar claves reales.
4. **TLS negativo**: servidor sin STARTTLS y certificado no confiable/nombre incorrecto no reciben el cuerpo del mensaje; no hay fallback inseguro.
5. **Clasificación**: rechazo RCPT o DATA produce fallo confirmado. Servidor que lee DATA y cierra sin confirmación final produce unknown y un solo intento, nunca ERROR por suposición. Comprobar cierre de conexiones y servidor al terminar.
6. **Persistencia**: reutilizar prueba de fallo al guardar ENVIADA; debe conservar PENDIENTE y devolver DELIVERY_STATUS_UNKNOWN aunque el mensaje se haya aceptado. La cuenta no se duplica ni se activa.
7. **Recuperación**: comparar respuesta para cuentas activa, pendiente, inactiva y desconocida, también con rechazo/unknown. Siempre el 202 neutro del contrato para solicitudes válidas; solo cuenta apta recibe enlace.
8. **Privacidad**: introducir secretos, direcciones, tokens y texto centinela; comprobar ausencia en diagnósticos. Mantener logs del transporte desactivados. Captura completa solo para datos ficticios.
9. **Regresiones**: verificación vencida/usada/sustituida rechazada; cambio de correo no sustituye el vigente antes de confirmar; recuperación completada revoca sesiones; sin permiso no hay invitación ni cambio de correo.

Los casos nuevos se incorporarán a los directorios ya descubiertos por Vitest. Actualizar el caso actual que usa SMTP sin STARTTLS y espera 201: la nueva política ya no permite ese éxito.

## Ensayo con proveedor real

1. Usar despliegue de prueba y buzones controlados, no los tests de captura. Configurar MAIL_MODE=smtp, credenciales, puerto 465 o STARTTLS obligatorio, y URLs SPA. Mantener las credenciales fuera del repositorio.
2. Iniciar el servicio:

   ```bash
   npm start
   ```

3. Entrar como administrador mediante el cliente autorizado existente. Emitir cinco invitaciones a cuentas ficticias y completar sus acciones; usar cuentas activas para cinco cambios de correo y cinco recuperaciones. Es posible reutilizar buzones/alias controlados que cumplan la política institucional. Si solo hay cliente HTTP, respetar origen/sesión establecidos en contratos existentes.
4. Anotar por referencia de operación: instante de solicitud, aceptación y aparición en buzón. No guardar enlaces ni capturas con tokens. Verificar destino correcto y acción completada. SC-001 exige 15/15 recibidos, 15/15 con <60 s en este tamaño de muestra; si falla, registrar incidencia, no equiparar ENVIADA con recepción.
5. Revisar logs con acceso de operación: propósito, referencia, resultado y categoría; cero secretos/contenido. Probar una credencial errónea en el entorno aislado y restaurarla; debe verse fallo operativo, no datos sensibles.
6. Pedir a cinco adultos de prueba que identifiquen acción y forma de continuar de los tres mensajes sin ayuda. SC-006 exige al menos cuatro personas que lo hagan correctamente en los tres casos.
7. Registrar resultados y limitaciones sin cambiar automáticamente estado de aprobación de spec. Destruir o revocar credenciales de prueba mediante el procedimiento operativo existente; no introducir políticas nuevas de conservación en esta feature.

## Aceptación y límites

SC-002–005 requieren matriz automatizada y revisión de logs; SC-001/006 requieren los ensayos anteriores. Un test SMTP local no prueba recepción externa. `verify()` puede ayudar a diagnosticar conexión/autenticación, pero no sustituye enviar al buzón ni prueba que se acepte un destinatario. No hay endpoint de envío de prueba ni reintentos automáticos.

## Registro de implementación — fase 2 (2026-10-25)

Prueba roja previa: `npm test -- tests/unit/mail-env.test.ts tests/unit/transactional-mail.test.ts` detectó 14 fallos de validación existentes y ausencia del nuevo módulo. Tras implementar: 36/36 pruebas pasan. Los emisores recibieron la adaptación mínima de propósito/ID real y URL de cambio para no duplicar transporte; el manejo explícito de resultados en servicios se completa en fases 3–4. No desplegar esa adaptación intermedia como aceptación completa.

## Registro de implementación — fase 3 (2026-10-25)

Base desechable exclusiva en el contenedor `kudlab-smtp-tests-20261025`, puerto local dinámico, migraciones existentes aplicadas. No se usaron bases previas ni envíos externos. Prueba roja: contrato unknown y cierre SMTP tras DATA devolvían DELIVERY_FAILED incorrectamente. Después de migrar el emisor: `npm test -- tests/contract/mail-invitation.test.ts tests/integration/account-invitation.test.ts tests/integration/accounts-convergence.test.ts tests/contract/accounts-create-list.test.ts` pasa 28/28 con DATABASE_URL de esa base; `npm run typecheck` pasa. Se verificó además el código originalCode de Nodemailer para no confundir conexión inicialmente rechazada con desconexión incierta.

## Registro de implementación — fase 4 (2026-10-25)

Prueba roja: cambio de correo unknown todavía devolvía DELIVERY_FAILED (dos casos). Tras manejar resultados explícitos, los contratos de mail-verifications, password-recovery, accounts-openapi y accounts-create-list, más integración mail-verifications y password-recovery pasan 30/30 sobre la base desechable. Se verificaron TLS SMTP real local para ambos propósitos, referencias existentes, acciones separadas, correo vigente conservado, rechazo sin permiso, verificación reutilizada/ajena al correo vigente y revocación de sesiones al recuperar. TypeScript pasa. Se retiró el adaptador de envío: solo queda reexportación de captura para compatibilidad de tests.

## Registro de implementación — fase 5 (2026-10-25)

Matriz SMTP: STARTTLS y TLS implícito con confianza de CA solo en test pasan; ausencia de STARTTLS, CA no confiable, nombre incorrecto, auth/RCPT/DATA rechazados no generan aceptación falsa; cierre tras DATA produce unknown. Captura no crea transporte y sink de diagnóstico fallido no altera aceptación. Arranque inválido se detiene antes de acceder a base y arranque válido no verifica disponibilidad SMTP. Se reforzó redacción ante URLs completamente malformadas, incluidas las de origen. Las cinco suites de configuración/transporte/arranque/diagnóstico y cuatro suites de regresión US1/US2 pasan 82/82; `npm run typecheck` pasa. Ningún contacto con Gmail.
