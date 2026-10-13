# Modelo de usuarios (propuesta ERD)

| Tabla | Atributos tipados explícitos | Relación/invariante |
| --- | --- | --- |
| `users` | `id UUID PK`, `email VARCHAR(255) UNIQUE`, `password_hash VARCHAR(255)`, `full_name VARCHAR(150)`, `role ENUM(ADMIN,TEACHER)`, `is_active BOOLEAN`, `created_at TIMESTAMP` | 1:N sesiones, grupos, observaciones, notas, asignaciones y logs; cuentas inactivas sin acceso. |
| `user_sessions` | `id UUID PK`, `user_id UUID FK`, `token VARCHAR(500) UNIQUE`, `last_activity TIMESTAMP`, `expires_at TIMESTAMP` | Una sesión por registro; 30 min de inactividad propuestos. |
| `audit_logs` | `id BIGINT PK AUTOINCREMENT`, `user_id UUID FK`, `action VARCHAR(100)`, `target_table VARCHAR(50)`, `ip_address VARCHAR(45)`, `timestamp TIMESTAMP` | 1 usuario:N logs; append-only declarado en D, V3 D-07 exige garantía por diseñar. |

El ERD describe un rol único por usuario; A CU01-S3 habla de «al menos un rol» y «último rol», lo que implica posible multiplicidad, sin tabla puente. Better Auth D §6 propone `user/account/session/verification/jwks`, diferente del esquema ERD; no fusionar sin diseño. Nulabilidad y política de contraseñas sin definir. [DBML líneas 5–51, 89–98, 154–156](../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/esquema.dbml), [A pp. 27–31](../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [D pp. 14–15](../../../original/DESCRIPCI%C3%93N%20DE%20DISE%C3%91O%20DE%20SOFTWARE.docx.pdf).
