# RF-012 (V3, propuesta): límite de intentos

## Aplicación a este backend

**Diseño no implementado.** Tareas controla en servidor intentos por participante/tarea; el servicio externo muestra la decisión y no puede saltarla recargando o reenviando. Una sesión profesor no es un intento de juego.

**Bloqueo TA-01:** definir por tarea qué consume intento (inicio, completitud, abandono, invalidez, incidente), relación con asignación y batería y reglas de TG-00/TG-06. No usar `DEFAULT 2` del ERD como política universal. Reanudar no debe crear un intento nuevo por accidente.

**Pruebas del API:** dos inicios concurrentes al último cupo, inicio repetido, recarga, pausa/reanudación y abandono/incidente; no exceder cupo ni perder evidencia. Definir reserva/consumo y respuesta de límite en el contrato; no basta contar sesiones antes de insertar sin garantía de concurrencia.

## Regla original y evidencia

**Resultado:** servidor aplica máximo configurado por tarea y participante, sin permitir evasión por recarga o envíos repetidos. [V3 RF-012](../../../../original/requisitos_V3.xlsx), [estado de sesión PNG](../../../../original/DIAGRAMAS-ANALISIS/DIAGRAMAS/04-estados/01-estado-seccion-tarea/01-estado-sesion-tarea.png). [ERD](../domain-model.md) propone `task_assignments.max_attempts INT DEFAULT 2`, `task_sessions.attempt_number` y `status` no enumerado completamente; «2» es default del diseño lógico, no regla aprobada universal.

**Flujo:** recibir inicio → validar asignación, consentimiento, estado y sesiones existentes → calcular intentos *consumidos según regla por tarea todavía no documentada* → si hay cupo, iniciar y registrar estado; si se alcanzó límite, no crear sesión. Pausa/reanudación e incompletitud deben conservar intento sin duplicarlo. **Aceptar/probar:** límite configurado alcanzado rechaza nuevo inicio; recarga y peticiones concurrentes no lo superan; estados visibles y trazables. Probar completada/pausada/abandonada/inválida; **pendiente:** qué estados consumen intento, límites por TG-00/TG-06 y efecto de incidencia. Dependencias [recuperación](recuperacion.md), [asignación](asignacion.md).
