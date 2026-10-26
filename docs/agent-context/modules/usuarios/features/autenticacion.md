# RF-003 (V3, propuesta): autenticar usuarios

## Implementación actual y responsabilidad

Solo profesores con identidad/cuenta activas. [auth.ts](../../../../../src/auth/auth.ts) habilita correo/contraseña y plugins admin/bearer/jwt; no Google ni registro público. [app.ts](../../../../../src/app.ts) permite `POST /api/auth/sign-in/email`, `/sign-out` y `GET /api/auth/get-session`, `/jwks`, `/token`, no toda operación del framework.

La guarda [requireActive](../../../../../src/auth/session-guard.ts) resuelve **sesión persistida**, verifica cuenta/identidad y actividad en servidor. Un JWT firmado solo no basta para rutas actuales. [session-activity.ts](../../../../../src/auth/session-activity.ts) controla 30 minutos desde referencia de actividad; no suponer que pedir/renovar JWT revive una sesión vencida. Distinguir el límite de sesión configurado en Better Auth de la verificación adicional de inactividad.

## Contratos y pruebas

P-01/P-02 incorporados en la rama de catálogo con autorización del responsable
(2026-10-26), desde los cambios locales de `fix/session-cookie-guarantees-restored`.
El cierre espera al proveedor y confirma la eliminación persistida antes del éxito;
un fallo devuelve 503 sin cookies de cierre, sin prometer rollback. Nunca se borra
antes de los controles de origen/CSRF del proveedor. Consulta y guarda propagan
Set-Cookie tras validar acceso, sin JWT/set-auth-token ni actividad por consultar sesión.
Ver `tests/integration/frontend-auth-validation.test.ts`: 8 casos revalidados sobre
base `c3cd581`, junto a contratos/fronteras (21/21), tipos y docs (22/22).
No acredita despliegue HTTPS ni merge a main.

Ver [contrato auth](../../../../../specs/003-autenticar-usuarios/contracts/auth.openapi.yaml), [pruebas de integración](../../../../../tests/integration/authentication.test.ts), [fronteras](../../../../../tests/integration/auth-boundaries.test.ts) y [actividad](../../../../../tests/unit/session-activity.test.ts). Probar cuenta pendiente/inactiva, credencial inválida, expiración/revocación, JWT aislado y fallo de dependencia. Recuperación por correo tiene [flujo propio](flujos-complementarios.md), no un login de estudiante.

## Antecedente original (JWT/Google son propuestas, no comportamiento vigente)

**Actor:** usuario autorizado con cuenta activa; propósito: acceso únicamente a áreas permitidas. [V3 RF-003](../../../../original/requisitos_V3.xlsx); [A CU02 p. 31 y secuencia p. 45](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf). **Flujo:** ingresar credenciales → validar cuenta, credencial y estado → crear sesión autenticada → cargar permisos → abrir áreas autorizadas. Inválidas/inactiva/fallo de autenticación → no crear acceso; 30 min de inactividad → exigir autenticación nueva; cierre de sesión controlado.

**Datos/seguridad:** `users.is_active` y `user_sessions.last_activity/expires_at` en [modelo](../domain-model.md). [D §6 pp. 14–16](../../../../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf) propone Better Auth contraseña/Google y flujo token opaco inicial → JWT para `/api/v1/*`; [PUML usuarios](../../../../original/C4/UML/users-jwt-code-diagram.puml) precisa que JWT no revive sesión vencida y que inactivar revoca sesiones. La política de credenciales y emisión efectiva son decisiones pendientes. **Verificar:** acceso válido, contraseña errónea, cuenta inactiva, expiración y revocación, caída del servicio; nunca conceder acceso en fallo. Dependencia [autorización](autorizacion.md). D propone rutas `/api/auth/*`, sin operación concreta documentada.
