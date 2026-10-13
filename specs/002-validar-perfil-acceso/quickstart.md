# Guía de validación: perfil y acceso

Esta guía valida el comportamiento sobre la implementación de cuentas de 001. Consultar [modelo](data-model.md), [contrato de perfil](contracts/validation.openapi.yaml) y [límite de ámbito](contracts/scope-authorization.md). No se afirma que RF-002 V3 esté aprobado o que ya exista una ruta de estudiantes.

## Prerrequisitos y arranque

1. Node.js 24, PostgreSQL 17, base de pruebas vacía y variables de `.env.example` suministradas de forma segura; credenciales de ADMIN inicial, `DATABASE_URL` y configuración de correo de pruebas según [quickstart de 001](../001-gestionar-cuentas-roles/quickstart.md). Nunca usar cuentas reales de menores ni guardar secretos en artefactos.
2. Instalar, migrar y ejecutar las verificaciones existentes desde la raíz:

```bash
npm ci
npm run db:migrate
npm run typecheck
npm test
npm run dev
```

El entorno de pruebas de 001 requiere PostgreSQL y configuración válida de correo. `MAIL_MODE=capture` solo está admitido bajo `NODE_ENV=test`; no enviar invitaciones a personas reales en este recorrido.

### Línea base previa a cambios de 002 (2026-10-13)

- `npm run typecheck`: correcto, sin errores.
- `npm test` sin PostgreSQL en `127.0.0.1:55432`: 43 fallos de conexión `ECONNREFUSED` en suites existentes y 1 prueba unitaria aprobada; no son regresiones de esta feature.
- Con PostgreSQL 17-alpine local de pruebas (`kudlab_test`) disponible, `DATABASE_URL` de pruebas, `npm run db:migrate` y `npm test`: migraciones aplicadas; **44/44 pruebas aprobadas en 13 archivos**. Servidor de correo capturado exclusivamente en `NODE_ENV=test`.

## Recorridos que pueden validarse con el backend de 001

1. Como ADMIN activo, crear por `POST /api/v1/accounts` un perfil TEACHER con nombre completo y correo `.edu.co`: esperar 201, cuenta PENDIENTE y nueva invitación; comprobar que no permite acceso antes de activarse.
2. Repetir sin nombre, correo o rol; con solo espacios, dirección mal formada, dominio diferente o duplicado de cuenta pendiente, activa o inactiva. Esperar rechazo sin cuentas nuevas; una vez implementada la ampliación de error de esta feature, confirmar que solo ADMIN recibe el campo a corregir sin revelar direcciones ajenas. Probar simultáneamente diez pares por el mismo correo, con un solo ganador.
3. Como ADMIN, `PATCH /api/v1/accounts/{id}` con nombre válido; comprobar que conserva rol/estado. Enviar nombre y correo juntos con uno inválido; ninguno se modifica. Cambiar correo de PENDIENTE y comprobar nueva invitación; cambiar correo de ACTIVA y comprobar `pendingEmail` mientras `email` sigue igual hasta `POST /api/v1/account-email-changes/confirm` con enlace del titular. Una confirmación inválida no lo cambia.
4. Aceptar invitación con contraseña válida y luego con menos de ocho caracteres, sin mayúscula, minúscula o número; cada contraseña inválida se rechaza sin consumir invitación ni activar cuenta. Los cambios y restablecimientos futuros requieren la misma regla cuando la feature de autenticación defina sus flujos.
5. Probar GET/POST/PATCH de cuentas sin sesión, con TEACHER, con cuenta inactiva y con ADMIN que pierde rol durante la sesión. Las solicitudes denegadas no muestran datos de cuentas ni actualizan registros; confirmar que `POST /api/auth/sign-up/email` y operaciones directas del plugin admin siguen bloqueadas.

Las suites disponibles `tests/unit/identity-policy.test.ts`, `tests/integration/accounts-convergence.test.ts`, `tests/integration/auth-boundaries.test.ts` y `tests/contract/accounts-openapi.test.ts` sirven como línea base; nuevos casos se añaden en tareas de implementación y se vuelven a ejecutar con `npm test`.

## Escenarios que dependen de otras features

- **Estado de US3: PENDIENTE / BLOQUEADA.** T026 y T027 son parte de US3 y no se pueden completar por separado ni antes de que existan un proveedor autoritativo de asignaciones y un consumidor real de estudiantes/grupos. Aunque puedan verificarse las denegaciones de gestión de cuentas y el límite interno con dobles, US3 y SC-003 no se consideran completadas hasta realizar esa integración y sus pruebas de ámbito con Académico.
- **FR-007/SC-003**: con dos docentes asignados a grupos distintos por Académico, intentar consulta y modificación del estudiante ajeno, así como ID/filtro manipulado, en un consumidor real de estudiantes/Seguimiento. Ningún dato ajeno debe aparecer; si el proveedor de asignaciones falla, toda solicitud protegida se deniega. Hoy no existe ese proveedor ni esas rutas en el backend: una prueba con dobles solo puede comprobar el límite de autorización, no cerrar el escenario integrado.
- **FR-005 (cambio/restablecimiento)**: volver a ejecutar pruebas de política y titularidad cuando autenticación exponga esos flujos; no publicar un restablecimiento sin ese contrato.
- **Política compartida verificada**: `tests/integration/auth-boundaries.test.ts` rechaza bootstrap con contraseña inválida sin crear identidad, `tests/integration/account-invitation.test.ts` rechaza la activación inválida sin consumir invitación, y `src/auth/credential-identity.ts` utiliza el mismo `passwordSchema` para hash de Better Auth. Cambio/restablecimiento siguen sin ruta expuesta: su feature deberá definir comprobación de titularidad antes de abrirlos.
- **SC-005**: con al menos cinco administradores del piloto y SPA conectada al entorno de prueba, medir intentos de corregir un perfil rechazado. Registrar número de intentos, tiempos y ayuda requerida; el umbral propuesto es ≥90 % en <3 minutos. No sustituir esta prueba presencial con una prueba automatizada.
- **Rendimiento**: medir p95 con 30 sesiones contra la referencia de ≤2 s de A §3.2 pp. 16–18, consignando resultados y entorno, sin presentarla como criterio institucional aprobado de esta feature.

## Verificación tras implementar lo disponible (2026-10-13)

- Node.js 24, PostgreSQL 17-alpine local de pruebas y envío capturado: `npm run typecheck` correcto; `npm test` **56/56 pruebas aprobadas en 14 archivos** (línea base previa: 44/44). Se añadieron pruebas de contrato, errores de campo, 10 pares de altas y ediciones, contraseña inválida sin consumir invitación, sesión/rol vigente y límite de responsabilidad denegado por defecto.
- `npx vitest run tests/performance/accounts-load.test.ts --reporter verbose --silent=false`: 30 sesiones independientes, GET cuentas p95 **148,2 ms** en entorno local. La referencia documental de ≤2 s no está aprobada como criterio institucional para RF-002.
- **Pendiente**: no se ejecutaron T026/T027 de US3 porque todavía no hay asignaciones ni rutas de estudiantes reales en Académico/Seguimiento; `tests/unit/scope-authorization.test.ts` prueba solamente el límite con un doble del proveedor. T031 tampoco se realizó: requiere SPA y cinco administradores humanos. Cambio/restablecimiento de contraseña se validará al existir los flujos de autenticación. No declarar SC-003 ni SC-005 superados.
