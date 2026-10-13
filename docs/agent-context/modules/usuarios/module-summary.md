# Usuarios: identidad y autorización

1. **Propósito:** gestionar cuentas, sesiones y permisos de acceso al piloto (V3 RF-001…004; A CU01-S1…S4/CU02/CU03, pp. 26–32).
2. **Alcance/límites:** alta/edición, rol, activación/inactivación, autenticación y ámbito; el acceso del estudiante por código no está resuelto ([pendientes](../../unresolved-issues.md)).
3. **Actores/permisos:** administrador gestiona cuentas/roles; docente accede a su grupo; usuario activo inicia sesión; consulta de permisos se verifica en servidor, no solo UI (V3 RF-004, A CU03).
4. **Vocabulario:** cuenta activa, rol ADMIN/TEACHER en ERD, sesión de usuario distinta de sesión de tarea, ámbito = grupo/estudiante asignado.
5. **Reglas compartidas:** correo/identificador único; cuenta activa con rol válido; no retirar último rol; inactivar exige confirmación, revoca acceso y preserva historial; sesión expira tras 30 minutos inactiva; fallar cerrado cuando no se verifica autorización (A CU01–03 pp. 27–32). Política concreta de contraseña pendiente.
6. **Entidades:** `users` 1:N `user_sessions`, `groups`, `audit_logs`; [modelo](domain-model.md).
7. **Flujo:** alta → validación/unicidad → cuenta activa/rol → auditoría; login → validar cuenta/credenciales → sesión → consulta protegida → comprobar rol y ámbito → respuesta autorizada o denegada (A secuencias pp. 44–45).
8. **Integraciones:** Académico provee grupo/docente; Seguimiento filtra panel; Tareas comprueba consentimiento y sesión; el PUML usuarios propone Better Auth y JWT intercambiado.
9. **Arquitectura/seguridad:** controles RBAC y ámbito en servidor; JWT/SID y revocación propuestos en [PUML usuarios](../../../original/C4/UML/users-jwt-code-diagram.puml), stack ambiguo; auditoría no editable prevista D §5 ADR-04.
10. **Dependencias:** grupos y asignaciones correctos; aprobación del mecanismo de credenciales, roles y expiración (V3 D-08).
11. **Features:** [cuentas](features/cuentas.md), [validación](features/validacion-acceso.md), [autenticación](features/autenticacion.md), [autorización](features/autorizacion.md); [arquitectura](../../architecture-summary.md).
12. **Fuentes:** [V3 hoja RF filas 2–5](../../../original/requisitos_V3.xlsx) (propuestas); [A §6.1.1 pp. 26–32 y §7.3 pp. 44–45](../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf); [D §§3, 6 pp. 8–16](../../../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf); [ERD](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/ERD-plantuml.puml).
