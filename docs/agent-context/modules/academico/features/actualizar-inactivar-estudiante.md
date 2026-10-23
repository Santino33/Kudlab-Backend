# RF-006 (V3, propuesta): actualizar e inactivar estudiante

## Aplicación a este backend

**Diseño no implementado.** Académico modifica datos permitidos y estado del participante tras verificar responsabilidad; Tareas consume ese estado para bloquear nuevas asignaciones/inicios. No inactivar una cuenta Better Auth: el estudiante no es usuario de este proyecto.

**Antes de diseñar contrato:** definir campos editables, permisos para inactivar/reactivar y efecto de cambio de grupo sobre historia/responsabilidad (AC-01). Inactivación conserva historia; revocación/retención/retiro legal requiere decisión separada (AC-02), no borrado en cascada. Efecto en sesiones de juegos ya iniciadas pendiente TA-03.

**Pruebas del API:** dos profesores, actualización inválida sin cambios, inactivación idempotente según contrato acordado, historial conservado y denegación de nuevas actividades. No exigir un modal de UI como único control del servidor. Ver [límites](../../../module-boundaries.md).

## Flujo original y evidencia

**Actor:** usuario autorizado; A §7.1 p. 40 y [CU PNG](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/02-casos-de-uso/02-cu-gestion-estudiantes/02-cu-gestion-estudiantes.png) asignan edición a docente e inactivación adicional a administrador; V3 RF-006 no fija roles específicos. [V3](../../../../original/requisitos_V3.xlsx), [dominio](../domain-model.md).

**Flujo de edición:** seleccionar ficha dentro del ámbito → modificar datos permitidos → validar obligatorios, formato y unicidad → guardar y mostrar cambios; dato inválido/duplicado o ámbito ajeno → sin modificación. **Inactivar:** seleccionar activo → confirmar acción → marcar inactivo sin borrar historial → retirar de lista de activos → impedir nuevas asignaciones e inicios de tareas; cancelar → sin efecto. **Criterios/pruebas:** historia previa aún visible solo a autorizados; editar válido/duplicado, intentar asignar/iniciar después de inactivar, consultar histórico, cancelar inactivación y comprobar mismo estado. [Actividad draw.io](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/05-actividades/02-Actividades-gestion-estudiantes/02-Actividades-gestion-estudiantes). Conflicto: diagrama de estado propone retiro de consentimiento → exclusión/eliminación o anonimización; diferenciar inactivación ordinaria de retiro legal antes de implementarlo. [Pendientes](../../../unresolved-issues.md).
