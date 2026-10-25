# Usuarios: identidad y autorización

## Responsabilidad y estado actual

**Implementado en esta base:** cuentas de profesores con rol único TEACHER/ADMIN, invitaciones, edición/cambio confirmado de correo, activación/inactivación, solicitudes de ascenso, autenticación, recuperación y auditoría de cuentas. `ADMIN` expresa permisos administrativos; estudiante y acudiente no son cuentas de este backend. No implementar su login por código a partir de diagramas históricos.

La cuenta de negocio (`user_accounts.id`) es distinta de la identidad Better Auth (`authUserId`). No crear grupos/estudiantes aquí ni inferir responsabilidad docente desde un token. Académico proveerá la decisión de ámbito; ver [frontera interna](../../../../src/modules/usuarios/shared/scope-authorization.ts).

### Código y contratos

- [src/modules/usuarios/](../../../../src/modules/usuarios/): `accounts/` (cuentas, roles y ciclo de vida), `invitations/`, `email-changes/`, `promotion-requests/`, `recovery/`, `shared/`. Esta es la estructura real, no una propuesta de migración.
- [src/auth/](../../../../src/auth/): integración de autenticación y guardas; [schema](../../../../src/db/schema/accounts.ts) y [actividad/recuperación](../../../../src/db/schema/authentication.ts).
- [Rutas compuestas](../../../../src/app.ts), [contratos y consumidores existentes](../../../../specs/004-refactor-servicios-usuarios/contracts/current-interfaces.md), [guía de pruebas](../../implementation-guide.md).

### No reabrir como incógnitas históricas

El código actual crea cuentas pendientes TEACHER por invitación, no cuentas activas con contraseña administrativa. Mantiene rol único; el ascenso requiere solicitud y aprobación, no un `PUT` genérico a ADMIN. Valida correo institucional `.edu.co`, nombre 1–200 y contraseña 8–128 con mayúscula, minúscula y número. Tiene reactivación y bootstrap del primer administrador. Las guardas resuelven sesión persistida, cuenta/identidad concordantes y actividad en servidor; Google no está habilitado. Confirmar detalles contra los archivos enlazados antes de modificar.

Las cuatro fichas RF siguientes conservan trazabilidad de V3, pero no cubren solas todas las features actuales. Para invitaciones/ascenso/correo/recuperación usar también [flujos complementarios](features/flujos-complementarios.md). No trasladar automáticamente estas reglas a la autorización del servicio de juegos.

La [documentación OpenAPI/Swagger UI](features/documentacion-api-swagger.md) consolida Usuarios y las cinco operaciones de estudiantes de Académico. Esas operaciones son del profesor TEACHER en su ámbito propio; no representan acceso de estudiantes ni permisos ADMIN universales. Contrato canónico en `docs/api/openapi.yaml`, UI disponible solo en desarrollo/pruebas.

## Referencia funcional de las fuentes

1. **Propósito:** gestionar cuentas, sesiones y permisos de acceso al piloto (V3 RF-001…004; A CU01-S1…S4/CU02/CU03, pp. 26–32).
2. **Alcance/límites:** alta/edición, rol, activación/inactivación, autenticación y ámbito del personal. El código de acceso del estudiante pertenece al servicio externo; su integración con la API requiere contrato, no una cuenta de Usuarios.
3. **Actores/permisos:** administrador gestiona cuentas/roles; docente accede a su grupo; usuario activo inicia sesión; consulta de permisos se verifica en servidor, no solo UI (V3 RF-004, A CU03).
4. **Vocabulario:** cuenta activa, rol ADMIN/TEACHER en ERD, sesión de usuario distinta de sesión de tarea, ámbito = grupo/estudiante asignado.
5. **Reglas compartidas:** correo/identificador único; cuenta activa con rol válido; no retirar último rol; inactivar exige confirmación, revoca acceso y preserva historial; sesión expira tras 30 minutos inactiva; fallar cerrado cuando no se verifica autorización (A CU01–03 pp. 27–32). Política concreta de contraseña pendiente.
6. **Entidades:** `users` 1:N `user_sessions`, `groups`, `audit_logs`; [modelo](domain-model.md).
7. **Flujo histórico:** alta → validación/unicidad → cuenta activa/rol → auditoría (A pp. 44–45). **Actual:** cuenta pendiente → invitación válida aceptada → identidad activa; login y consulta protegida verifican identidad/estado/ámbito conforme al código y contratos.
8. **Integraciones:** Académico provee grupo/docente; Seguimiento filtra panel; Tareas comprueba consentimiento y sesión; el PUML usuarios propone Better Auth y JWT intercambiado.
9. **Arquitectura/seguridad:** controles RBAC y ámbito en servidor; el [PUML usuarios](../../../original/C4/UML/users-jwt-code-diagram.puml) propone JWT/SID y Google. Consultar estado actual arriba antes de aplicarlo; auditoría de cuentas tiene código/migraciones, no prueba de auditoría global de menores.
10. **Dependencias:** grupos y asignaciones correctos; aprobación del mecanismo de credenciales, roles y expiración (V3 D-08).
11. **Features:** [cuentas](features/cuentas.md), [validación](features/validacion-acceso.md), [autenticación](features/autenticacion.md), [autorización](features/autorizacion.md); [arquitectura](../../architecture-summary.md).
12. **Fuentes:** [V3 hoja RF filas 2–5](../../../original/requisitos_V3.xlsx) (propuestas); [A §6.1.1 pp. 26–32 y §7.3 pp. 44–45](../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf); [D §§3, 6 pp. 8–16](../../../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf); [ERD](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/ERD-plantuml.puml).
