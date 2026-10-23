# RF-025 (V3, propuesta): anotaciones cualitativas

## Aplicación a este backend

**Diseño no implementado.** Seguimiento conserva texto contextual separado de observación estructurada e indicador; la anotación no modifica ninguna medida calculada ni nota escolar. Autor/fecha se obtienen del contexto de servidor, no se concede acceso por un ID de profesor en el cuerpo.

**Bloqueo SE-02:** persistencia que falta en ERD, longitud/contenido, creación/edición y auditoría; definir si requiere periodo o enlace a una sesión además del estudiante, sin inventarlo desde un gráfico de ejemplo. No usar `observation_text` como sustituto silencioso de la entidad faltante.

**Pruebas del API:** texto vacío/límites según contrato, profesor ajeno, autor manipulado, consulta tras guardar, fallo sin registro parcial y evidencia original sin cambios. Ver [modelo](../domain-model.md) y [pendientes](../../../unresolved-issues.md).

## Flujo original y evidencia

**Actor:** docente autenticado en ficha de estudiante bajo su responsabilidad. Propósito: contextualizar evolución sin cambiar indicadores o observaciones originales. [V3 RF-025](../../../../original/requisitos_V3.xlsx), [A CU06 pp. 35–36](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf).

**Pasos:** abrir ficha → seleccionar anotación → ingresar texto → validar contenido no vacío y ámbito → registrar estudiante, autor y fecha → confirmar y mostrar en historial. Texto vacío → pedir contenido; alumno ajeno → denegar; fallo de persistencia → informar sin crear anotación parcial. Solo autorizados pueden consultar/modificar; modificación detallada no definida. No es diagnóstico ni altera valor calculado. **Pruebas/criterios:** anotación aparece con autor/estudiante/fecha después de recarga; valor de indicador permanece igual; contenido vacío y acceso ajeno rechazados; fallo no deja parcial. [ERD](../domain-model.md) carece de entidad de anotación; definir persistencia, longitud y política de edición antes de implementar. Dependencias [autorización](../../usuarios/features/autorizacion.md) y [consulta](consultar-resultados.md).
