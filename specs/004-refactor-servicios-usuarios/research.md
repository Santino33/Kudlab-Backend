# Investigación: refactor de Usuarios

## Decisión 1: Reorganizar por flujos existentes

- **Decisión**: mover los archivos actuales de cuentas (incluidos ciclo de vida y roles), invitaciones, cambio de correo, solicitudes de ascenso y recuperación a grupos con esos nombres; dejar validación, tipos, errores, auditoría, bloqueo y ámbito compartidos en `shared/`.
- **Motivo**: los 19 archivos de `src/modules/usuarios/` están al mismo nivel, aunque los nombres ya distinguen responsabilidades. Agruparlos aclara dónde buscar sin cambiar la arquitectura ni crear archivos puente.
- **Alternativas consideradas**: mantenerlos en un nivel con prefijos (no resuelve el problema descrito); crear capas genéricas para todos los flujos (añade navegación y dependencias innecesarias).
- **Consumidores**: `src/app.ts` importa rutas y errores; `src/auth/{active-identity,session-activity,credential-identity,session-guard}.ts`, `src/scripts/bootstrap-admin.ts` y varias pruebas importan directamente piezas del módulo. Ajustar esas importaciones al moverlas; no cambiar rutas HTTP.

## Decisión 2: Aclarar sin alterar las garantías

- **Decisión**: conservar `AccountError`, validaciones, `lockAccount`, `recordAudit`, transacciones y orden de los chequeos que influyen en seguridad o respuesta. Extraer una comprobación local solo si reduce lectura repetida sin ocultar un efecto o variar error/orden.
- **Motivo**: invitaciones, cambio de correo, ascenso y recuperación coordinan verificaciones de cuenta/identidad, bloqueo, expiración, mutación, revocación y auditoría; una extracción indiscriminada puede cambiar el comportamiento observable o dejar operaciones parciales. El servicio de invitaciones también interactúa con la identidad existente: preservar su secuencia y la semántica anterior, sin ampliar esta iteración a corregir reglas no solicitadas.
- **Alternativas consideradas**: un nuevo servicio de políticas o repositorio para todas las comprobaciones (más acoplamiento y alcance); reescribir los flujos junto con el movimiento (dificulta detectar regresiones).

## Decisión 3: Regresión al final, línea base al principio

- **Decisión**: usar `npm run typecheck` y `npm test` antes de cambiar código para registrar la línea base, y repetir la suite completa como fase final. Ampliar únicamente casos no cubiertos cuya equivalencia se ponga en riesgo; validar integración, contratos, unidad y desempeño ya existentes.
- **Motivo**: `vitest.config.ts` incluye los cuatro grupos de pruebas y ejecuta archivos secuencialmente; varias pruebas dependen de PostgreSQL aislado y `tests/setup.ts` captura mensajes. Los contratos de `specs/001`, `002` y `003` describen parte de la API; las rutas actuales son la referencia para los recorridos implementados que no figuren allí.
- **Alternativas consideradas**: probar solo los servicios editados (omite consumidores y rutas); generar una nueva suite paralela que replique pruebas existentes (duplica trabajo sin aumentar cobertura significativa).

## Dependencias y límites resueltos

- La implementación real usa TypeScript/Node, Hono, Better Auth, Drizzle/PostgreSQL, Zod y Vitest según `package.json`; no se decide un stack nuevo ni se aplica el diseño propuesto de módulos aún no implementados.
- No hacen falta migraciones ni cambios de modelo: se conservan las entidades y estados actuales. Contratos visibles y pruebas de equivalencia: [contracts/current-interfaces.md](contracts/current-interfaces.md).
- Las metas de tiempos de localización y lectura son criterios del [spec.md](spec.md), no pruebas automatizadas ni cifras heredadas del diseño.
