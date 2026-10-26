# RF-007 (V3, propuesta): validar y consultar estudiantes

## Aplicación a este backend

**Diseño no implementado.** Académico provee listado/ficha de participantes autorizado en servidor. Validar alta/edición reutiliza sus reglas, no requiere un segundo almacenamiento de estudiantes. Usuarios entrega identidad, no un listado de menores obtenido desde el login.

**Antes de diseñar contrato:** campos visibles/minimización, filtros permitidos, activos/históricos, paginación/orden y regla de consulta tras transferir responsabilidad (AC-01/SE-03 en [pendientes](../../../unresolved-issues.md)). No conceder un filtro `teacherId` irrestricto solo porque el original mencione filtro por docente.

**Pruebas del API:** lista/ficha/total/paginación no filtran datos ajenos; ID o filtro manipulado denegado; lista sin coincidencias distinta de error. Las reglas de ámbito son responsabilidad de Académico usando el [puente de Usuarios](../../usuarios/features/autorizacion.md).

## Flujo original y evidencia

**Actor:** usuario con rol y ámbito válidos. Resultado: listados y ficha individual filtrables por grupo/docente, sin PII ajena. [V3 RF-007](../../../../original/requisitos_V3.xlsx), [A §7.1 p. 40](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [CU PNG](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/02-casos-de-uso/02-cu-gestion-estudiantes/02-cu-gestion-estudiantes.png).

**Flujo:** validar datos obligatorios/formato en alta o actualización → para consultar, verificar sesión, rol y responsabilidad → ofrecer lista del ámbito y filtros grupo/docente → seleccionar ficha → mostrar únicamente campos almacenados permitidos. Errores de validación no guardan; filtro manipulado o estudiante ajeno no entrega datos; lista sin coincidencias expresa ausencia, no estudiante ajeno. **Pruebas/aceptación:** datos incompletos no persisten; comparar respuestas de dos docentes con grupos distintos en lista y ficha; pedir directamente ID ajeno y comprobar denegación. Campos de visualización y prioridad (A §4.2 p. 19 marca «pendiente») por confirmar. [Modelo](../domain-model.md), [autorización](../../usuarios/features/autorizacion.md). Sin API documentada.
