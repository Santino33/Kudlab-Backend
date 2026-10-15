# Overlay de autorización del contrato HTTP de cuentas

**Estado**: rutas existentes de 001–003; este documento describe solamente el permiso, no redefine campos ni crea operaciones. Especificación de entradas, salidas y errores: [accounts.openapi.yaml](../../001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml). Fuente funcional: [spec.md](../spec.md) FR-001/002/006–008; decisión de rol único en `specs/001-gestionar-cuentas-roles/spec.md` y sesión vigente en `specs/003-autenticar-usuarios/spec.md`.

| Operación existente | Actor autorizado | Datos/efectos ante denegación |
| --- | --- | --- |
| `GET /api/v1/accounts` y `GET /api/v1/accounts/{id}` | Solo ADMIN activo con sesión vigente. | Sin lista, detalle ni conteos de cuentas; sin cambios. |
| `POST /api/v1/accounts`, `PATCH /api/v1/accounts/{id}`, `PUT /api/v1/accounts/{id}/role`, `POST /api/v1/accounts/{id}/deactivate` y `.../reactivate` | Solo ADMIN activo con sesión vigente; rigen además validación, confirmación y reglas de 001. | Ninguna cuenta modificada ni auditoría de cambio de negocio por solicitud rechazada. |
| `GET /api/v1/accounts/{id}/audit` | Solo ADMIN activo con sesión vigente, según contrato de 001. | Sin datos históricos ni detalles de otra cuenta. |
| Solicitudes de ascenso desde TEACHER y aceptación de invitación | Mantener expresamente las excepciones y comprobaciones ya definidas en el contrato de 001. | La política ADMIN para gestión de cuentas no debe bloquear estas operaciones autorizadas ni habilitar un ascenso directo. |

La verificación de sesión opaca, ACTIVA y rol concordante precede al acceso. Una petición sin sesión válida retorna la denegación de autenticación definida por 001/003; rol insuficiente o cuenta no autorizada retorna la denegación genérica de 001/003, sin revelar la existencia de un ID objetivo. Si cambia el rol durante una sesión, la primera solicitud posterior usa el rol vigente. `GET /api/auth/get-session` no es una operación protegida que renueve la inactividad (regla confirmada en 003). La implementación de este overlay debe mantener el contrato JSON/códigos existentes y verificarse con pruebas HTTP de 001–003.

**Límite**: la capacidad ADMIN para gestionar cuentas no es permiso para consultar, exportar o modificar registros de estudiantes. No se crean rutas públicas nuevas para Académico o Seguimiento con este documento.
