# Trazabilidad e implicaciones del modelo — gestionar estudiantes

Fecha: 2026-10-23. Documento de contexto para la planificación; no sustituye los requisitos funcionales de [spec.md](spec.md) ni implementa cambios de base de datos.

## Fuentes verificadas y precedencia

1. Decisiones explícitas del responsable en esta sesión: estudiantes no son usuarios interactivos; el docente realiza las operaciones; solo operaciones sobre estudiantes, sin tareas; mantener fidelidad al modelo original. El documento adjunto `docs/agent-context/modules/usuarios/features/acceso-estudiante.md` fue refinado bajo esas instrucciones en el repositorio `/home/santino/Universidad/TrabajoCampo/Kudlab-backend/` y utilizado como fuente principal.
2. Original adjunto `docs/original/DIAGRAMAS-ANALISIS/DIAGRAMAS/03-modelo-datos/01-modelo-logico/ERD-plantuml.puml`: líneas 16–19 y 30–37, entidades de personal, grupos, estudiantes y cardinalidades; líneas 22 y 40, consentimiento 1:1. Es propuesta de diseño, no esquema desplegado.
3. Original `esquema.dbml`, en el mismo directorio del repositorio adjunto: líneas 26–59, campos, tipos, roles y código único; líneas 80–87, consentimiento. El comentario inicial indica que el ERD no fija nulabilidad general. Se consultaron los originales en el repositorio adjunto porque no están presentes en este worktree; las referencias anteriores permiten localizar los pasajes en el repositorio fuente.
4. Constitución local `.specify/memory/constitution.md`, versión 1.1.0, principio II: activación exige consentimiento vigente. Prevalece sobre cualquier lectura de la descripción que pretendiese activar sin validarlo.
5. Código local `src/db/schema/accounts.ts`, `auth.ts`, `authentication.ts`, `src/db/client.ts` y migraciones registradas en `src/db/migrations/meta/_journal.json`: evidencia de implementación en el repositorio, no de migraciones efectivamente aplicadas a una instancia externa. No se inspeccionó una base desplegada.
6. `src/modules/usuarios/shared/scope-authorization.ts` contiene una frontera de autorización para proveedores académicos; sin proveedor o ante fallo deniega. No implementa grupos/estudiantes ni constituye por sí sola autorización académica completa.

## Contraste mínimo con el diseño original

| Aspecto | ERD/DBML original | Implementación local y consecuencia para esta feature |
| --- | --- | --- |
| Personal | `users.id UUID`, roles `ADMIN`/`TEACHER` | Cuenta de negocio `user_accounts.id UUID`, vinculada a identidad Better Auth `user`. Reutilizarla; no crear otra tabla `users`. |
| Grupo | `id UUID`, `teacher_id UUID`, `name VARCHAR(50)`, `grade VARCHAR(20)`, `school_year INT` | No existe aún. Incorporar `groups` con estos campos; adaptar únicamente la referencia del docente a `user_accounts.id`. |
| Estudiante | `id UUID`, `group_id UUID`, `student_code VARCHAR(50) UNIQUE`, `first_name VARCHAR(100)`, `last_name VARCHAR(100)`, `is_active BOOLEAN` | No existe aún. Incorporar `students` conservando esos campos y tipos y su referencia a `groups.id`; no agregar identidad de autenticación. |
| Cardinalidad | Docente 1:N grupos; grupo 1:N estudiantes | Mantener un responsable por grupo y un grupo por estudiante. No introducir relaciones múltiples ni destinatarios individuales de tareas. |
| Código | Único en `students`, no acotado al grupo | Mantener unicidad global, incluidos inactivos. La normalización de espacios externos y comparación sensible a mayúsculas son supuestos funcionales explícitos, no reglas afirmadas por el ERD. |
| Nulabilidad/estado inicial | Nulabilidad general y valor inicial no definidos | La propuesta funcional requiere grupo, código, nombres y apellidos; propone alta inactiva para no eludir consentimiento. Son precisiones de esta feature, no transcripción literal del ERD. |
| Consentimiento | Entidad 1:1 propuesta | No incorporarla aquí. La ausencia de su implementación no autoriza activar: la feature no expone activación/reactivación. Resolver su modelo temporal en la feature correspondiente. |
| Auditoría | `audit_logs` general | La implementación tiene `account_audit_events` específica de cuentas. No insertar estudiantes allí ni crear cuentas ficticias como destinos; una auditoría académica requiere su propio acuerdo de alcance. |

## Cambios mínimos previstos para la planificación

- Agregar únicamente la representación de grupos y estudiantes y sus relaciones/restricciones necesarias, conservando los atributos y tamaños del original. El plan definirá las migraciones, índices y contratos concretos.
- No alterar cuentas, sesiones, credenciales, invitaciones ni recuperación para representar estudiantes. El rol y estado actuales del responsable se verifican al autorizar; una FK por sí sola no prueba que el titular siga siendo docente activo.
- No introducir tablas de consentimiento, tareas, eventos, historial de grupos o sesiones estudiantiles. Tampoco agregar campos personales no previstos, como documento de identidad, correo del menor o credenciales.
- La preparación de grupos es una dependencia operativa explícita: no crear automáticamente un grupo por alta ni ampliar esta feature a administración de grupos sin decisión adicional.
- Las especificaciones anteriores que hablan de acceso estudiantil por código son antecedentes incompatibles con la decisión actual. Su actualización transversal no está incluida en esta invocación.

## Puntos propuestos a revisar

Alta inactiva sin activación, campos obligatorios, tratamiento del código, alcance de edición e inactivación y provisión inicial de grupos. Son defaults documentados para validar, no decisiones históricas atribuidas a las fuentes. Cambiar la regla de activación exigiría integrar consentimiento o tramitar una enmienda constitucional; no habilitar silenciosamente un bypass.
