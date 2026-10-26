# Responsabilidades y propiedad de datos

Este mapa aplica el alcance confirmado por el responsable a los cinco módulos de V3 D-02, C4 `componentes.jpeg` y la constitución §IV. Es una guía de separación, no un contrato HTTP aprobado ni prueba de implementación de módulos futuros.

## Regla de propiedad

Un módulo es responsable de las reglas y escrituras de sus datos. Que otro módulo los consulte o tenga una FK no lo vuelve propietario. La BD puede ser compartida; no se exige crear microservicios ni llamadas HTTP internas. Preferir funciones/servicios explícitos del módulo propietario; acordar las consultas conjuntas necesarias para Seguimiento sin duplicar sus reglas.

| Módulo | Responsabilidad propia | Consume | No le corresponde |
| --- | --- | --- | --- |
| Usuarios | Cuentas de profesores, roles, identidad, sesiones, invitaciones, recuperación, cambios de correo y auditoría de cuentas | Decisión de responsabilidad docente provista por Académico | Crear estudiantes como cuentas; gestionar grupos/asignaciones pedagógicas; conceder automáticamente a ADMIN lectura de todo dato de menores |
| Académico | Participantes, grupos, responsabilidad docente, consentimiento/evidencia y notas escolares | Identidad y permisos de Usuarios; adaptador de archivos cuando se implemente | Cuentas/contraseñas; asignaciones de juegos; observaciones estructuradas; indicadores digitales |
| Tareas | Registro/configuración del banco fijo, versiones, disponibilidad, asignaciones, intentos, sesiones, recepción de evidencia/progreso/incidencias | Identidad/autorización; estado, ámbito y consentimiento de Académico; datos del servicio externo | Ejecutar/renderizar juegos; decidir suficiencia metodológica o fórmulas; interpretar clínicamente resultados |
| Evolución | Catálogo/fichas de indicadores, suficiencia/exclusiones, resultados derivados, procedencia y comparabilidad longitudinal | Evidencia y condiciones conservadas por Tareas; identidad/ámbito para consulta | Recibir una segunda copia de los mismos eventos en otro endpoint; cambiar respuestas originales; sumar notas y observaciones para fabricar un índice global |
| Seguimiento | Consultas pedagógicas integradas y filtros; escritura de observaciones estructuradas y anotaciones cualitativas | Participantes/notas de Académico, recorrido de Tareas e indicadores de Evolución | Modificar notas desde su propia persistencia, recalcular fórmulas por su cuenta o renderizar gráficos en este backend |

**Servicio externo de juegos:** interacción del estudiante, estímulos, respuestas y medición temporal local. Las fichas TG documentan esas condiciones para entender y validar la evidencia. Su autenticación e integración deben acordarse; no es un usuario profesor ni una nueva cuenta STUDENT.

## Flujo de referencia

1. Profesor autenticado → Académico identifica estudiante/grupo, responsabilidad y consentimiento.
2. Profesor asigna → Tareas valida ámbito, actividad habilitada y condiciones del participante.
3. Servicio de juegos solicita/informa ejecución mediante contrato autorizado → Tareas controla sesión, intentos y versión; conserva los envíos confirmados.
4. Evidencia disponible → Evolución aplica reglas aprobadas o valida los resultados externos según el contrato por acordar. Conserva valor o ausencia con motivo y procedencia.
5. Profesor consulta → Seguimiento reúne fuentes sin cambiar valores originales; Evolución aporta historia/comparabilidad.

Los pasos 3–4 describen responsabilidades, no garantizan que existan endpoints, jobs ni transacciones entre módulos. D §2.2, A §§6.2–6.3 y V3 RF-011…020 respaldan el recorrido; no definen el contrato entre los dos servicios actuales.

## Tres validaciones distintas

- **Usuarios:** identidad activa y permiso para operar; Académico resuelve la responsabilidad docente actual.
- **Tareas:** el envío corresponde a una sesión/asignación autorizada, respeta esquema, versión, estado e integridad de ingesta; un reenvío no duplica evidencia.
- **Evolución:** los registros son suficientes y metodológicamente utilizables para **cada indicador**; una sesión persistida o completada no garantiza todos sus indicadores.

Una incidencia se conserva en Tareas; su efecto sobre una métrica lo decide la ficha de Evolución. Seguimiento comunica ambos sin transformar ausencia en cero. La propiedad y garantía técnica de auditoría fuera de cuentas requieren una decisión explícita, no copiar la tabla de Usuarios para todos los dominios.
