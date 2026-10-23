# RF-014 (V3, propuesta): disponibilidad del banco piloto

## Aplicación a este backend

**Diseño no implementado.** Tareas controla disponibilidad para nuevas asignaciones/inicios y conserva definición/historia; el servicio externo no debe decidir disponibilidad solo desde una copia de catálogo obsoleta. Deshabilitar no es borrar la tarea ni invalidar automáticamente resultados existentes.

**Pendiente TA-03:** continuación/reanudación de sesiones iniciadas y efecto sobre asignaciones existentes; distinguir negar un inicio nuevo de cancelar lo que ya está en ejecución. TG-06 es cierre sin métrica cognitiva conforme a F/constitución; su gestión operativa no lo convierte en indicador de memoria/atención.

**Pruebas del API:** nueva asignación/inicio rechazados al deshabilitar, historia preservada, rehabilitación y cambio concurrente según contrato. Los permisos administrativos no se deducen del productor externo. Ver [pendientes](../../../unresolved-issues.md).

## Regla original y evidencia

**Actor:** administrador autorizado; habilita/deshabilita tareas fijas sin eliminar definición ni historial. V3 RF-014 califica TG-01…06 como evaluativas, pero F §4 pp. 38–40 excluye TG-06 de indicadores; TG-00 es práctica. [V3](../../../../original/requisitos_V3.xlsx), [A CU-TD-02 p. 37](../../../../original/3%20ANALISIS%20DEL%20PROYECTO.docx.pdf), [F](../../../../original/Fundamento%20teorico.docx.pdf).

**Flujo:** elegir tarea fija → comprobar permiso → cambiar disponibilidad → guardar versión/estado → dejar de ofrecer tarea deshabilitada a nuevas asignaciones o inicios; historia ya registrada permanece. **Pruebas/criterios:** deshabilitada no recibe nuevas asignaciones ni nuevas ejecuciones; al rehabilitar vuelve a mostrarse a autorizados; resultados anteriores consultables; tarea inexistente o usuario no autorizado no modifica estado. **Pendiente explícito de V3:** comportamiento de asignaciones ya hechas y sesiones en curso; definición de qué TG cuentan como evaluativas. [Modelo](../domain-model.md), [configuración](recursos-configuracion.md).
