# Data model: grupos y estudiantes

Estado: implementado y validado en bases aisladas de prueba para feature 005; no desplegado en producción. Fuentes: [source-context.md](source-context.md), [research.md](research.md) y [validation.md](validation.md).

## 1. Cuenta del docente — existente, sin cambios

`user_accounts.id UUID` es la identidad de negocio referenciada por Académico. `auth_user_id` enlaza con Better Auth. Para operar, la cuenta debe estar `ACTIVA` y tener rol `TEACHER`; una FK no garantiza esos valores, por lo que se verifican al autorizar. No se crea fila de cuenta para estudiante ni se altera el esquema de autenticación.

## 2. `groups` — nueva

| Campo | Tipo | Restricciones y significado |
| --- | --- | --- |
| `id` | UUID | PK, generado por servidor, estable. |
| `teacher_id` | UUID | NOT NULL, FK a `user_accounts.id`, sin cascada de borrado. Un responsable por grupo. |
| `name` | VARCHAR(50) | NOT NULL, no vacío tras trim. Nombre del grupo. |
| `grade` | VARCHAR(20) | NOT NULL, no vacío tras trim. Grado académico, sin inventar catálogo. |
| `school_year` | INT | NOT NULL. Año escolar; no se introduce rango institucional no aprobado. |

Índice no único sobre `teacher_id`. No hay unicidad adicional de nombre/grado/año: el ERD no la define. No hay endpoints ni cargas automáticas de grupos en esta feature. Requisitos de no-vacío y NOT NULL precisan el uso funcional donde el original no establece nulabilidad; la preparación operativa debe respetarlos.

## 3. `students` — nueva

| Campo | Tipo | Restricciones y significado |
| --- | --- | --- |
| `id` | UUID | PK, generado por servidor; no editable. |
| `group_id` | UUID | NOT NULL, FK a `groups.id`, sin cascada de borrado; no editable en esta feature. |
| `student_code` | VARCHAR(50), collation `C` | NOT NULL, único globalmente; 1–50 caracteres tras trim; comparación sensible a mayúsculas. |
| `first_name` | VARCHAR(100) | NOT NULL, 1–100 caracteres tras trim; editable. |
| `last_name` | VARCHAR(100) | NOT NULL, 1–100 caracteres tras trim; editable. |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT false. Solo transición hacia false en estos endpoints. |

Índice no único en `group_id`, además de PK e índice único del código. CHECK de datos no vacíos y sin espacios externos comunes en persistencia; la normalización Unicode completa se realiza en la validación. No truncar valores para hacerlos caber. La longitud se cuenta en puntos de código Unicode, alineada con VARCHAR de PostgreSQL. No cambiar mayúsculas, ceros iniciales ni acentos.

## 4. Relaciones y fidelidad

```text
user_accounts 1 ─── N groups 1 ─── N students
```

Se conservan nombres, atributos, tamaños y cardinalidades del ERD; la adaptación necesaria es `users.id` → `user_accounts.id` en la FK docente. Se precisan nulabilidad obligatoria, generación de IDs y alta inactiva conforme a los requisitos de esta feature. No agregar `user_id`, `auth_user_id`, contraseña, correo, tokens, fechas o tablas puente a estudiantes.

## 5. Transiciones

| Operación | Estado previo | Resultado |
| --- | --- | --- |
| Alta válida | No existe | Registro inactivo. |
| Corregir código/nombres/apellidos | Activo o inactivo | Mismo ID, grupo y estado; datos permitidos corregidos. |
| Inactivar | Activo | Inactivo, conservando datos. |
| Repetir inactivación | Inactivo | Inactivo, sin duplicar registros. |
| Activar/reactivar/cambiar estado en edición | Cualquiera | Rechazado, sin cambios. |
| Cambiar ID/grupo o borrar | Cualquiera | No permitido por estos contratos. |

Un código de registro inactivo no queda disponible. No se implementa transición desde inactivo hacia activo ni se sustituye el consentimiento por un booleano.

## 6. Escrituras e integridad

- Transacciones con autorización vigente, operación y registro de actividad aceptada en la misma unidad; orden de bloqueos cuenta → identidad auth → sesión → grupo → estudiante. Consultas de ámbito siempre filtradas por docente autenticado. Los bloqueos y la aceptación final se detallan en research §8; un fallo de sesión revierte la escritura.
- Alta usa el grupo propio bloqueado y solo campos permitidos; edición bloquea el registro dentro del ámbito y no acepta ID/grupo/estado.
- La restricción única del código resuelve altas/correcciones simultáneas. Mapear solo su violación a `STUDENT_CODE_CONFLICT` y responder sin identificar al titular.
- Ante fallo, rollback completo. Las FK evitan huérfanos; no borrar grupos o cuentas con dependencias mediante cascada.
- Los estados actuales de cuenta/rol son condiciones de autorización, no campos duplicados en estudiantes.

## 7. Migración e instalación

Se agregó `src/db/schema/academic.ts` y se registró en `src/db/client.ts`. Drizzle generó `src/db/migrations/0008_early_wild_child.sql`, su snapshot y journal, después de `0007_password_recovery`. Solo agrega dos tablas, restricciones e índices; sin cambios en autenticación. No renumerar ni editar migraciones aplicadas.

Se verificaron instalación desde cero y upgrade con cuentas/sesiones existentes. Si una instancia tiene tablas académicas ajenas al historial, no sobreescribirlas: aislar o reconciliar explícitamente. Esto ocurrió con la base compartida anterior y se resolvió usando bases nuevas, no alterando sus datos.
