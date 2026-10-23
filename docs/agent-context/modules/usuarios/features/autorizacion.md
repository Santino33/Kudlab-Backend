# RF-004 (V3, propuesta): autorización por rol y responsabilidad

## Frontera actual y responsabilidad futura

Usuarios verifica sesión/identidad/cuenta y rol; **Académico posee la responsabilidad docente**. El helper [authorizeScope](../../../../../src/modules/usuarios/shared/scope-authorization.ts) recibe ID de cuenta, operación `read/write` y objetivo `student/group`. Sin proveedor, con identidad inválida, rol distinto de TEACHER o fallo de consulta, deniega. No hay datos académicos para implementar un proveedor real en esta base.

Una futura ruta protegida debe usar las guardas y la decisión actual de ámbito inmediatamente antes de acceder al recurso, también para filtros/listados y escrituras. No inventar asignaciones a partir de `studentId` del request. El acceso ADMIN sobre datos de menores requiere matriz explícita: el helper actual no concede ese permiso automáticamente.

## Contrato y pruebas

Ver [scope-authorization.md](../../../../../specs/002-validar-perfil-acceso/contracts/scope-authorization.md), [guardas](../../../../../src/auth/session-guard.ts) y [pruebas unitarias](../../../../../tests/unit/scope-authorization.test.ts). Probar dos profesores/grupos, filtro o ID ajeno, proveedor ausente/fallido y cuenta revocada. La autorización de integración con juegos es otro contrato, no una sesión profesor asignada al estudiante.

## Antecedente original y permisos académicos por acordar

**Resultado:** cada petición y consulta está filtrada por rol y ámbito, también en servidor/API. Actor: usuario autenticado con rol válido. [V3 RF-004](../../../../original/requisitos_V3.xlsx), [A CU03 p. 32 y secuencia p. 45](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf). [Dominio](../domain-model.md).

**Flujo:** 1) recibir solicitud de recurso protegido; 2) validar sesión; 3) identificar rol y operación; 4) si docente, confirmar que grupo/estudiante está asignado; 5) entregar solo datos permitidos o denegar. Sin sesión, rol insuficiente, estudiante ajeno o verificación no disponible → denegación sin filtrar datos. El administrador solo ejecuta funciones de gestión asignadas. **Criterios/pruebas:** crear dos docentes y grupos distintos: cada uno lee/modifica únicamente su ámbito; probar además URL/ID ajeno, filtro manipulado y llamadas directas API. Un rol nuevo debe cambiar permisos efectivos y no filtrar registros previos del otro docente. Dependencias: grupos/estudiantes de [Académico](../../academico/module-summary.md), autenticación y [panel](../../seguimiento/features/visualizar-filtrar.md). Matriz exacta de permisos pendiente; sin endpoint concreto.
