# Modelo de Usuarios: implementación y antecedente ERD

## Implementación observada

Fuente de verdad de estructura: [accounts.ts](../../../../src/db/schema/accounts.ts), [authentication.ts](../../../../src/db/schema/authentication.ts), [auth.ts](../../../../src/db/schema/auth.ts) y sus migraciones. No generar estas tablas otra vez con nombres del ERD.

| Elemento actual | Relación e invariante importante |
| --- | --- |
| `user_accounts` | ID UUID de negocio; `auth_user_id` texto único referencia la identidad Better Auth. Rol único ADMIN/TEACHER; estado PENDIENTE/ACTIVA/INACTIVA; correo normalizado único `.edu.co`. Pendiente no tiene identidad vinculada, activa/inactiva sí. |
| `user`, `account`, `session`, `verification`, `jwks` de Better Auth | Identidad, credenciales/proveedor, sesión y soporte del framework. `account` no es la cuenta de negocio `user_accounts`; consultar el esquema generado exacto antes de tocarlo. No almacenar otra contraseña en el módulo. |
| `session_activity` | Una fila por sesión, FK a `session`; registra última petición aceptada. Inactividad y revocación se controlan en servidor, no solo con vencimiento de JWT. |
| `account_invitations` | Cuenta destinataria, hash del token, vencimiento de siete días y consumo/invalidación/estado de entrega. El token en claro no se persiste como evidencia de acceso. |
| `admin_role_requests` | Solicitante, estado PENDIENTE/APROBADA/RECHAZADA, decisión/decisor/fecha. Una solicitud pendiente por cuenta; ascenso no es autoasignación de rol. |
| `account_email_changes` | Nuevo correo normalizado, token resumido, actor solicitante y vencimiento/consumo/invalidación. El correo pendiente no reemplaza inmediatamente la identidad vigente. |
| `password_recovery_verifications` | Cuenta/correo/token resumido, vencimiento de 30 minutos y estado de uso/invalidación; no implica una sesión nueva sin autenticarse. |
| `account_audit_events` | Destinatario cuenta de negocio, actor identidad, acción/antes/después/fecha. No equivale a una auditoría global de todos los dominios futuros. |

**Para integrar módulos:** escoger y declarar la referencia de docente/autor; no intercambiar UUID de cuenta y texto de identidad. El proveedor de ámbito recibe ID de cuenta. No asociar automáticamente `students` con `user` ni crear una identidad por menor.

## Modelo histórico (no implementación)

| Tabla | Atributos tipados explícitos | Relación/invariante |
| --- | --- | --- |
| `users` | `id UUID PK`, `email VARCHAR(255) UNIQUE`, `password_hash VARCHAR(255)`, `full_name VARCHAR(150)`, `role ENUM(ADMIN,TEACHER)`, `is_active BOOLEAN`, `created_at TIMESTAMP` | 1:N sesiones, grupos, observaciones, notas, asignaciones y logs; cuentas inactivas sin acceso. |
| `user_sessions` | `id UUID PK`, `user_id UUID FK`, `token VARCHAR(500) UNIQUE`, `last_activity TIMESTAMP`, `expires_at TIMESTAMP` | Una sesión por registro; 30 min de inactividad propuestos. |
| `audit_logs` | `id BIGINT PK AUTOINCREMENT`, `user_id UUID FK`, `action VARCHAR(100)`, `target_table VARCHAR(50)`, `ip_address VARCHAR(45)`, `timestamp TIMESTAMP` | 1 usuario:N logs; append-only declarado en D, V3 D-07 exige garantía por diseñar. |

El ERD y A usan vocabulario ambiguo de roles; la implementación actual tiene **uno** por cuenta. La política y nulabilidad reales se verifican arriba y en [validación](features/validacion-acceso.md), no se deducen de esa ambigüedad. Conservar la trazabilidad histórica sin fusionar el ERD con las tablas generadas de Better Auth. [DBML líneas 5–51, 89–98, 154–156](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml), [A pp. 27–31](../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [D pp. 14–15](../../../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf).
