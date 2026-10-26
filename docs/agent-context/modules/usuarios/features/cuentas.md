# RF-001 (V3, propuesta): gestionar cuentas y roles

## Implementación actual y responsabilidad

Gestiona **cuentas de profesores**, no participantes estudiantes. Ver [rutas](../../../../../src/modules/usuarios/accounts/accounts.routes.ts) y [servicio](../../../../../src/modules/usuarios/accounts/accounts.service.ts). Crear admite TEACHER y genera cuenta pendiente/invitación; no habilita automáticamente una cuenta activa como en A CU01-S1. El primer ADMIN usa bootstrap; el ascenso posterior usa solicitud/aprobación. Rol único, no colección de roles.

`GET/POST /api/v1/accounts`, `GET/PATCH /api/v1/accounts/:id`, auditoría, cambio a TEACHER y acciones de inactivación/reactivación están compuestas bajo guardas de cuenta activa y ADMIN en [app.ts](../../../../../src/app.ts). Aceptar por token es otro flujo, no una creación pública libre. Ver [flujos complementarios](flujos-complementarios.md).

## Qué verificar antes de cambiar

Conservar contratos de [cuentas](../../../../../specs/001-gestionar-cuentas-roles/contracts/accounts.openapi.yaml) y [validación](../../../../../specs/002-validar-perfil-acceso/contracts/validation.openapi.yaml), unicidad/concurrencia, sincronía con identidad, revocación y auditoría. Probar creación pendiente, aceptación, solicitud de ascenso, inactivación/reactivación y conflictos de correo. Las políticas implementadas están en [validación](validacion-acceso.md); los pendientes del antecedente siguiente no describen el estado actual.

## Antecedente funcional original (no contrato actual)

**Resultado/alcance:** administrador autorizado crea, consulta, edita, activa/inactiva usuarios ADMIN/TEACHER y asigna roles permitidos; no autoescalamiento ni borrado del historial. Precondición: sesión activa con permiso de gestión. [V3 hoja «RF corregidos», fila RF-001](../../../../original/requisitos_V3.xlsx), [A CU01-S1…S4 pp. 27–31](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf). Modelo: [usuarios](../domain-model.md); reglas de ámbito en [módulo](../module-summary.md).

**Flujo:** 1) presentar formulario; 2) administrador ingresa nombre/correo institucional/rol inicial (A secuencia p. 44); 3) validar obligatorios/formato/identificador y correo únicos, política de contraseña y rol existente/activo; 4) crear cuenta activa y rol, registrar auditoría; 5) confirmar/listar. Edición vuelve a validar unicidad si cambia identificador, guarda solo campos permitidos, audita. Cambio de rol actualiza permisos efectivos y audita. Inactivación exige confirmación, revoca sesiones activas, conserva historia y audita. Alternos: inválido/duplicado/rol inactivo → rechazo sin guardar; retirar último rol → rechazo; cancelación → sin cambio; persistencia fallida → estado anterior; ya inactiva → informar. A CU01-S1…S4.

**Verificación:** cuenta válida aparece con permisos del rol; duplicado o escalamiento rechazado; cuenta inactiva no accede y su auditoría permanece; cambio fallido no cambia permisos. Pruebas: alta válida, correo repetido, rol inexistente, retiro del último rol, inactivación cancelada y con sesión vigente, acceso tras inactivar. **Pendiente:** política concreta, multiplicidad de roles (ERD enum único), reactivación y canal de credenciales. Sin ruta API documentada.
